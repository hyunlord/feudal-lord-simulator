#!/usr/bin/env bash
# DGX side of the remote runner (REMOTE-1). Called by scripts/remote/run.sh; not meant to be run by hand.
#   remote-exec.sh launch <run>        start the run detached inside a resource-limited systemd user scope, print its pid
#   remote-exec.sh run <run> <unit>    (inside the scope) prepare the run folder, run the command, record results
# Layout under ~/fls-runs: <run>/ (one per <label>-<shortsha>), _cache/{repo.git,nm-<hash>/}, _tools/ (setup-dgx.sh),
# _locks/, _slots/ (heavy-run slots and their queue), _ports/, _clones/, _kept/. Folders starting with "_" are never pruned.
# A kept run (run.sh --keep) copies its .remote/ and result files to _kept/<run>/ and marks its folder .remote/keep:
# the prune skips a marked folder and never touches _kept/, whichever branch's copy of this script prunes.
set -uo pipefail

BASE=$HOME/fls-runs
MODE=${1:?mode}
RUN=${2:?run}
RUN_DIR=$BASE/$RUN
MEMORY_MAX=${FLS_REMOTE_MEMORY_MAX:-48G}
CPU_QUOTA=${FLS_REMOTE_CPU_QUOTA:-1200%}
KEEP_RUNS=${FLS_REMOTE_KEEP:-10}
KEEP_NM_CACHES=4
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
  echo "$rc" > .remote/exit-code.tmp && mv .remote/exit-code.tmp .remote/exit-code
  keep_results
  stop_dev_servers
  prune_runs
  clean_disk "after $RUN"
  exit "$rc"
}
# A run used for a judgement (run.sh --keep): its results survive the prune — in _kept/<run>/ even if an older copy of
# this script (another branch) prunes the folder itself.
keep_results() {
  [ "${KEEP_RUN:-0}" = 1 ] || return 0
  local dest="$BASE/_kept/$RUN"
  mkdir -p "$dest/.remote" && touch .remote/keep
  rsync -a .remote/ "$dest/.remote/"
  [ -s .remote/changed-files.txt ] && rsync -a --files-from=.remote/changed-files.txt ./ "$dest/"
  echo "remote-exec: kept results in _kept/$RUN (release: run.sh --release $RUN)"
}
fail() { echo "remote-exec: $*" >&2; finish 2; }

# Disk upkeep (scripts/remote/diskClean.sh, decision RR15): every run cleans after itself; a heavy run checks the free
# space before it starts and, under DC_LOW_GB, cleans tight first.
# shellcheck disable=SC1091
. "$RUN_DIR/scripts/remote/diskClean.sh"

# Dev servers left behind (2026-10-03: capture scripts that did not stop their Vite left 24 on the DGX, each holding a
# port of 4300-4399): a node process running vite whose working directory is in a run folder ($BASE/<run>/… or
# $BASE/_clones/<run>/…) of a run that is no longer going — this run's, now that its command has ended, or another run's
# whose lock is free. Each is named in this run's log and stopped (TERM, then KILL). Anything outside $BASE, such as the
# play server, and the servers of runs still going are never touched. By pid, not group: a server started without its own
# group shares this script's.
stop_dev_servers() {
  local pid args cwd rel name stopped=""
  for pid in $(pgrep -u "$(id -u)" node 2>/dev/null); do
    args=$(tr '\0' ' ' < "/proc/$pid/cmdline" 2>/dev/null) || continue
    case "$args" in *vite*) ;; *) continue ;; esac
    cwd=$(readlink "/proc/$pid/cwd" 2>/dev/null) || continue
    case "$cwd" in "$BASE"/*) rel=${cwd#"$BASE"/} ;; *) continue ;; esac
    case "$rel" in _clones/*) rel=${rel#_clones/} ;; _*) continue ;; esac
    name=${rel%%/*}
    [ -n "$name" ] || continue
    # A run still going holds its lock; a pruned run's lock file is gone (opened for reading: never created here).
    if [ "$name" != "$RUN" ] && [ -e "$BASE/_locks/$name.lock" ]; then
      ( flock -n 9 ) 9<"$BASE/_locks/$name.lock" || continue
    fi
    echo "remote-exec: stopping a dev server left by $name (pid $pid: ${args:0:140})"
    kill -TERM "$pid" 2>/dev/null && stopped="$stopped $pid"
  done
  [ -n "$stopped" ] || return 0
  sleep 3
  for pid in $stopped; do kill -0 "$pid" 2>/dev/null && kill -KILL "$pid" 2>/dev/null; done
  return 0
}

exec 8>"$BASE/_locks/$RUN.lock"
# run.sh holds this lock through the upload and lets it go right after the launch: wait for it (a minute), so the folder
# is never unlocked between upload and run. A run that really is already going still holds it past the minute.
flock -w 60 8 || { echo "remote-exec: $RUN is already running" >&2; exit 3; }

prune_runs() {
  local count=0 dir name
  for dir in $(ls -1dt "$BASE"/*/ 2>/dev/null); do
    name=$(basename "$dir")
    case "$name" in _*) continue ;; esac
    [ -f "$dir/.remote/keep" ] && continue
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

# Node 24 LTS from _tools (setup-dgx.sh); the system /usr/bin/node (20) is not used by runs.
export PATH="$BASE/_tools/node/bin:$BASE/_tools/bin:$PATH"
[ -x "$BASE/_tools/node/bin/node" ] || fail "no Node 24 in $BASE/_tools/node (run: npm run remote:setup)"

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
  # One LFS object store for every run folder (a run that pulls LFS files kept 1.6 GB of them in its own .git/lfs).
  mkdir -p "$BASE/_cache/lfs" && git config lfs.storage "$BASE/_cache/lfs"
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

# 4. Heavy slots: at most HEAVY_SLOTS (2) heavy runs at once across all sessions; the others wait in line
#    (scripts/remote/heavySlots.sh). run.sh marks a run heavy (SLOT=heavy; the old SLOT=guardrail is the same).
T_WAIT=$(date +%s.%N)
case "$SLOT" in
  heavy|guardrail)
    if [ "$(dc__free_gb)" -lt "$DC_LOW_GB" ]; then clean_disk "before the heavy run $RUN: under $DC_LOW_GB GB free" tight; fi
    # shellcheck disable=SC1091
    . "$RUN_DIR/scripts/remote/heavySlots.sh"
    heavy_take_slot "$BASE" "$RUN" "$LABEL: ${CMD:0:120}" ;;
esac
WAIT_S=$(elapsed "$T_WAIT")

# 5. Two ports of our own in 4300-4399 (the play server keeps 4173).
mkdir -p "$BASE/_ports"
for port in $(seq $PORT_FIRST $PORT_LAST); do
  exec 4>"$BASE/_ports/$port.lock"
  if flock -n 4; then
    if ! ss -Hltn "sport = :$port" | grep -q .; then export FLS_REMOTE_PORT=$port; break; fi
  fi
  exec 4>&-
done
[ -n "${FLS_REMOTE_PORT:-}" ] || fail "no free port in $PORT_FIRST-$PORT_LAST"
# A second port in the same range for a second server (a base build beside this one, a driver): scripts take
# FLS_REMOTE_BASE_PORT instead of FLS_REMOTE_PORT + 50, which left 4300-4399 for ports over 4349 (2026-10-04).
for port in $(seq $PORT_FIRST $PORT_LAST); do
  [ "$port" = "$FLS_REMOTE_PORT" ] && continue
  exec 3>"$BASE/_ports/$port.lock"
  if flock -n 3; then
    if ! ss -Hltn "sport = :$port" | grep -q .; then export FLS_REMOTE_BASE_PORT=$port; break; fi
  fi
  exec 3>&-
done
[ -n "${FLS_REMOTE_BASE_PORT:-}" ] || fail "no second free port in $PORT_FIRST-$PORT_LAST"

# 6. Browser: Playwright's linux-arm64 Chromium (Chrome has no linux-arm64 build). CHROME_PATH stays unset so tests
#    that assert the default path behave as on the Mac; the CDP proofs find Chromium at /usr/bin/google-chrome (a
#    symlink made once by the user, see setup-dgx.sh), and PLAYWRIGHT_MODULE points at a shim that maps
#    channel 'chrome' to it. Commands that want an explicit path use CHROME_PATH=$FLS_CHROMIUM_PATH.
export FLS_CHROMIUM_PATH=$(cat "$BASE/_tools/chromium-path" 2>/dev/null)
export FLS_PLAYWRIGHT_CORE=$BASE/_tools/node_modules/playwright-core/index.mjs
export PLAYWRIGHT_MODULE=$RUN_DIR/scripts/remote/playwright-chrome-shim.mjs
unset CHROME_PATH
[ -x "$FLS_CHROMIUM_PATH" ] || echo "== warning: no Chromium (run: npm run remote:setup)"
[ -e /usr/bin/google-chrome ] || echo "== warning: /usr/bin/google-chrome missing; tests that default to it fail (see docs/REMOTE_RUNS.md)"
export RUN LABEL SHORT_SHA FULL_SHA DIRTY BRANCH
export FLS_REMOTE=1 FLS_REMOTE_RUN=$RUN FLS_REMOTE_MIRROR=$MIRROR FLS_REMOTE_COMMIT=$FULL_SHA
echo "== port $FLS_REMOTE_PORT  chromium ${FLS_CHROMIUM_PATH:-none}  node $(node -v) ($(command -v node))"
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
