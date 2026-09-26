#!/usr/bin/env bash
# DGX side of the remote runner (REMOTE-1). Called by scripts/remote/run.sh; not meant to be run by hand.
#   remote-exec.sh launch <run>        start the run detached inside a resource-limited systemd user scope, print its pid
#   remote-exec.sh run <run> <unit>    (inside the scope) prepare the run folder, run the command, record results
# Layout under ~/fls-runs: <run>/ (one per <label>-<shortsha>), _cache/{repo.git,nm-<hash>/}, _tools/ (setup-dgx.sh),
# _locks/, _slots/, _ports/, _clones/. Folders starting with "_" are never pruned.
set -uo pipefail

BASE=$HOME/fls-runs
MODE=${1:?mode}
RUN=${2:?run}
RUN_DIR=$BASE/$RUN
MEMORY_MAX=${FLS_REMOTE_MEMORY_MAX:-48G}
CPU_QUOTA=${FLS_REMOTE_CPU_QUOTA:-1200%}
KEEP_RUNS=${FLS_REMOTE_KEEP:-10}
KEEP_NM_CACHES=4
GUARDRAIL_SLOTS=2
PORT_FIRST=4300
PORT_LAST=4399
PULL_DIRS="docs seeds perf output fixtures"
GITHUB_URL=https://github.com/hyunlord/feudal-lord-simulator

if [ "$MODE" = launch ]; then
  mkdir -p "$RUN_DIR/.remote"
  rm -f "$RUN_DIR/.remote/exit-code" "$RUN_DIR/.remote/pid"
  unit="fls-run-$RUN-$(date +%s)"
  # nice applies to everything below it; the scope limits apply per run and the slice caps all runs together.
  setsid nohup systemd-run --user --scope --quiet --unit="$unit" --slice=fls-runs.slice \
    -p MemoryMax="$MEMORY_MAX" -p CPUQuota="$CPU_QUOTA" \
    nice -n 10 bash "$RUN_DIR/scripts/remote/remote-exec.sh" run "$RUN" "$unit" \
    > "$RUN_DIR/.remote/run.log" 2>&1 < /dev/null &
  echo $! > "$RUN_DIR/.remote/pid"
  echo "$unit" > "$RUN_DIR/.remote/unit"
  cat "$RUN_DIR/.remote/pid"
  exit 0
fi
[ "$MODE" = run ] || { echo "unknown mode $MODE" >&2; exit 2; }
UNIT=${3:-}

cd "$RUN_DIR" || exit 2
# shellcheck disable=SC1091
. .remote-in/meta.env
# shellcheck disable=SC1091
[ -f .remote-in/sync.env ] && . .remote-in/sync.env
T_START=$(date +%s.%N)
elapsed() { awk -v now="$(date +%s.%N)" -v start="$1" 'BEGIN { printf "%.1f", now - start }'; }
finish() {
  local rc=$1
  {
    echo "SYNC_S=${SYNC_S:-}"; echo "PREPARE_S=${PREPARE_S:-}"; echo "WAIT_S=${WAIT_S:-0}"
    echo "COMMAND_S=${COMMAND_S:-}"; echo "NM_CACHE=${NM_CACHE:-}"; echo "PORT=${FLS_REMOTE_PORT:-}"
  } > .remote/timing.env
  prune_runs
  echo "$rc" > .remote/exit-code.tmp && mv .remote/exit-code.tmp .remote/exit-code
  exit "$rc"
}
fail() { echo "remote-exec: $*" >&2; finish 2; }

exec 8>"$BASE/_locks/$RUN.lock"
flock -n 8 || { echo "remote-exec: $RUN is already running" >&2; exit 3; }

prune_runs() {
  local count=0 dir name
  for dir in $(ls -1dt "$BASE"/*/ 2>/dev/null); do
    name=$(basename "$dir")
    case "$name" in _*) continue ;; esac
    count=$((count + 1))
    [ "$count" -le "$KEEP_RUNS" ] && continue
    [ "$name" = "$RUN" ] && continue
    # A run that is still going holds its lock: leave it.
    ( flock -n 9 || exit 1; rm -rf "$BASE/${name:?}" ) 9>"$BASE/_locks/$name.lock" || continue
    git -C "$BASE/_cache/repo.git" update-ref -d "refs/remote-runs/$name" 2>/dev/null
    rm -f "$BASE/_locks/$name.lock"
    echo "remote-exec: pruned old run folder $name"
  done
}

echo "== $RUN  unit=${UNIT:-none}  host=$(hostname)  commit=$FULL_SHA  dirty=$DIRTY  branch=$BRANCH"
echo "== limits: nice $(nice)  memory.max $(cat /sys/fs/cgroup"$(cut -d: -f3 /proc/self/cgroup)"/memory.max 2>/dev/null)  cpu.max $(cat /sys/fs/cgroup"$(cut -d: -f3 /proc/self/cgroup)"/cpu.max 2>/dev/null)"

# 1. The folder mirrors the Mac tree: drop files the Mac no longer has (rsync --files-from cannot delete).
find . \( -path ./node_modules -o -path ./.git -o -path ./.remote -o -path ./.remote-in \) -prune -o \( -type f -o -type l \) -print \
  | sed 's#^\./##' | sort > .remote/present.txt
sort -u .remote-in/in-files.txt > .remote/sent.txt
comm -23 .remote/present.txt .remote/sent.txt | while IFS= read -r stale; do rm -f -- "$stale"; done
rm -f .remote/present.txt .remote/sent.txt .remote/changed-files.txt .remote/start-marker

export PATH="$BASE/_tools/bin:$PATH"

# 2. Git metadata: the run folder becomes a work tree of $FULL_SHA whose objects live in the shared bare mirror
#    (alternates, no copy). `git status` then shows exactly the Mac's uncommitted changes.
MIRROR=$BASE/_cache/repo.git
(
  flock 7
  if [ ! -d "$MIRROR" ]; then
    git clone -q --bare "$GITHUB_URL" "$MIRROR" && git -C "$MIRROR" config remote.origin.fetch '+refs/heads/*:refs/heads/*'
  fi
  git -C "$MIRROR" cat-file -e "$FULL_SHA^{commit}" 2>/dev/null || {
    # Unpushed commits come in the bundle; its prerequisites are on origin (fetch first if the mirror lags).
    bundle() { [ -f .remote-in/head.bundle ] && git -C "$MIRROR" fetch -q "$RUN_DIR/.remote-in/head.bundle" "+HEAD:refs/remote-runs/$RUN" 2>/dev/null; }
    bundle || { git -C "$MIRROR" fetch -q --prune origin; bundle; }
  }
  git -C "$MIRROR" update-ref "refs/remote-runs/$RUN" "$FULL_SHA" 2>/dev/null
) 7>"$BASE/_locks/repo-mirror.lock"
rm -rf .git
if git -C "$MIRROR" cat-file -e "$FULL_SHA^{commit}" 2>/dev/null; then
  git init -q . && echo "$MIRROR/objects" > .git/objects/info/alternates
  git update-ref refs/heads/remote-run "$FULL_SHA" && git symbolic-ref HEAD refs/heads/remote-run
  git remote add origin "$GITHUB_URL"
  if command -v git-lfs >/dev/null; then
    git config filter.lfs.clean 'git-lfs clean -- %f'; git config filter.lfs.smudge 'git-lfs smudge -- %f'
    git config filter.lfs.process 'git-lfs filter-process'; git config filter.lfs.required true
  fi
  printf '.remote/\n.remote-in/\nnode_modules\n' >> .git/info/exclude
  git read-tree HEAD && git update-index -q --refresh >/dev/null 2>&1
  echo "== git: HEAD $(git rev-parse --short HEAD), $(git status --porcelain | wc -l) path(s) differ from HEAD"
else
  echo "== git: $FULL_SHA is not in the mirror; the run folder has no .git (commands that call git will fail)"
fi

# 3. node_modules from the lockfile-hash cache. The cache is filled once per (package-lock.json, node, arch) under a
#    lock, then hard-linked into the run (cp -al: a real directory inside the project, so Vite's fs rules and
#    node_modules/.vite stay per run).
NM_KEY="$(sha256sum package-lock.json | cut -c1-16)-node$(node -v | tr -d v)-$(uname -m)"
NM_CACHE_DIR=$BASE/_cache/nm-$NM_KEY
if [ -f node_modules/.fls-nm-key ] && [ "$(cat node_modules/.fls-nm-key)" = "$NM_KEY" ]; then
  NM_CACHE=hit
else
  exec 6>"$NM_CACHE_DIR.lock"; flock 6
  if [ -f "$NM_CACHE_DIR/.complete" ]; then NM_CACHE=hit; else
    NM_CACHE=miss
    echo "== node_modules cache miss ($NM_KEY): npm ci"
    rm -rf "$NM_CACHE_DIR.tmp" && mkdir -p "$NM_CACHE_DIR.tmp" && cp package.json package-lock.json "$NM_CACHE_DIR.tmp/"
    (cd "$NM_CACHE_DIR.tmp" && npm ci --no-audit --no-fund --loglevel=error) || fail "npm ci failed"
    rm -rf "$NM_CACHE_DIR" && mv "$NM_CACHE_DIR.tmp" "$NM_CACHE_DIR" && touch "$NM_CACHE_DIR/.complete"
  fi
  flock -u 6; exec 6>&-
  rm -rf node_modules && cp -al "$NM_CACHE_DIR/node_modules" node_modules && echo "$NM_KEY" > node_modules/.fls-nm-key
fi
touch "$NM_CACHE_DIR/.complete"
ls -1dt "$BASE"/_cache/nm-*/ 2>/dev/null | tail -n +$((KEEP_NM_CACHES + 1)) | while IFS= read -r old; do
  ( flock -n 9 && rm -rf "$old" ) 9>"${old%/}.lock"
done
echo "== node_modules: $NM_CACHE ($NM_KEY)"
PREPARE_S=$(elapsed "$T_START")

# 4. Guardrail slots: at most $GUARDRAIL_SLOTS guardrail runs at once across all sessions.
T_WAIT=$(date +%s.%N)
if [ "$SLOT" = guardrail ]; then
  mkdir -p "$BASE/_slots"; waited=0
  while :; do
    for n in $(seq 1 $GUARDRAIL_SLOTS); do
      exec 5>"$BASE/_slots/guardrail.$n.lock"
      if flock -n 5; then echo "== guardrail slot $n/$GUARDRAIL_SLOTS"; break 2; fi
      exec 5>&-
    done
    [ "$waited" = 0 ] && echo "== waiting for a guardrail slot (both busy)"
    waited=1; sleep 10
  done
fi
WAIT_S=$(elapsed "$T_WAIT")

# 5. A port of our own in 4300-4399 (the play server keeps 4173).
mkdir -p "$BASE/_ports"
for port in $(seq $PORT_FIRST $PORT_LAST); do
  exec 4>"$BASE/_ports/$port.lock"
  if flock -n 4; then
    if ! ss -Hltn "sport = :$port" | grep -q .; then export FLS_REMOTE_PORT=$port; break; fi
  fi
  exec 4>&-
done
[ -n "${FLS_REMOTE_PORT:-}" ] || fail "no free port in $PORT_FIRST-$PORT_LAST"

# 6. Browser: Playwright's linux-arm64 Chromium (Chrome has no linux-arm64 build). CHROME_PATH stays unset so tests
#    that assert the default path behave as on the Mac; the CDP proofs find Chromium at /usr/bin/google-chrome (a
#    symlink made once by the user, see setup-dgx.sh), and PLAYWRIGHT_MODULE points at a shim that maps
#    channel 'chrome' to it. Commands that want an explicit path use CHROME_PATH=$FLS_CHROMIUM_PATH.
export FLS_CHROMIUM_PATH=$(cat "$BASE/_tools/chromium-path" 2>/dev/null)
export FLS_PLAYWRIGHT_CORE=$BASE/_tools/node_modules/playwright-core/index.mjs
export PLAYWRIGHT_MODULE=$RUN_DIR/scripts/remote/playwright-chrome-shim.mjs
unset CHROME_PATH
# Node 20 has WebSocket only behind a flag (global from Node 22; the Mac runs newer Node). The CDP clients need it.
case "$(node -v)" in v20.*) export NODE_OPTIONS="${NODE_OPTIONS:+$NODE_OPTIONS }--experimental-websocket" ;; esac
[ -x "$FLS_CHROMIUM_PATH" ] || echo "== warning: no Chromium (run: npm run remote:setup)"
[ -e /usr/bin/google-chrome ] || echo "== warning: /usr/bin/google-chrome missing; tests that default to it fail (see docs/REMOTE_RUNS.md)"
export RUN LABEL SHORT_SHA FULL_SHA DIRTY BRANCH
export FLS_REMOTE=1 FLS_REMOTE_RUN=$RUN FLS_REMOTE_MIRROR=$MIRROR FLS_REMOTE_COMMIT=$FULL_SHA
echo "== port $FLS_REMOTE_PORT  chromium ${FLS_CHROMIUM_PATH:-none}  node $(node -v) ${NODE_OPTIONS:-}"
echo "== command: $CMD"
echo "== prepare ${PREPARE_S}s (node_modules $NM_CACHE), slot wait ${WAIT_S}s"
echo

touch .remote/start-marker
T_CMD=$(date +%s.%N)
bash -c "$CMD"
RC=$?
COMMAND_S=$(elapsed "$T_CMD")
echo
echo "== exit $RC after ${COMMAND_S}s"

# 7. Results that come back into the Mac working tree: files the command created or changed under $PULL_DIRS.
for dir in $PULL_DIRS; do
  [ -d "$dir" ] && find "$dir" -type f -newer .remote/start-marker -print
done | sort > .remote/changed-files.txt
[ -s .remote/changed-files.txt ] && echo "== $(wc -l < .remote/changed-files.txt) result file(s) to bring back"
finish "$RC"
