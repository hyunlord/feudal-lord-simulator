#!/usr/bin/env bash
# Play server updater (PLAY-1), run by fls-play-update.timer every 5 minutes (or by hand: update.sh [--force]).
#  1. git fetch the trunk; if its head equals the serving commit (and no --force), record "unchanged" and stop.
#  2. Reset the build checkout to that head, npm ci, npm run build.
#  3. On success: copy dist/ into releases/<time>-<sha>, add the commit badge and build.json, and swap the `current`
#     symlink atomically (ln -s to a temp name + mv -T). The server resolves `current` per request: no restart.
#     Keep the 3 newest releases besides the serving one. Then refresh bin/ from the new commit.
#  4. On failure: `current` is untouched (the previous build keeps serving) and status.json says failed:<stage>.
# Runs from $FLS_PLAY_ROOT/bin (a copy), never from the checkout it resets. One run at a time (flock).
set -uo pipefail

ROOT=${FLS_PLAY_ROOT:-$HOME/fls-play}
BRANCH=${FLS_PLAY_BRANCH:-codex/phase15-organic-ground}
BUILD_CMD=${FLS_PLAY_BUILD_CMD:-npm run build}
REPO=$ROOT/repo
STATE=$ROOT/state
FORCE=${1:-}
mkdir -p "$STATE" "$ROOT/releases" "$ROOT/bin"
exec 9>"$STATE/update.lock"
flock -n 9 || { echo "another update is running"; exit 0; }

now() { date -u +%Y-%m-%dT%H:%M:%SZ; }
log() { echo "$(now) $*" | tee -a "$STATE/updates.log"; }
serving_commit() { cat "$(readlink -f "$ROOT/current" 2>/dev/null)/build.json" 2>/dev/null | sed -n 's/.*"commit": *"\([0-9a-f]*\)".*/\1/p'; }
serving_built_at() { cat "$(readlink -f "$ROOT/current" 2>/dev/null)/build.json" 2>/dev/null | sed -n 's/.*"builtAt": *"\([^"]*\)".*/\1/p'; }

# status.json: what is served (commit, builtAt), what this run did (lastUpdate, lastResult, attempted commit).
write_status() {
  local result=$1 attempted=${2:-} detail=${3:-}
  local commit; commit=$(serving_commit)
  local built; built=$(serving_built_at)
  local tmp="$STATE/status.json.tmp"
  printf '{\n  "commit": "%s",\n  "commitShort": "%s",\n  "builtAt": "%s",\n  "branch": "%s",\n  "lastUpdate": "%s",\n  "lastResult": "%s",\n  "lastAttemptCommit": "%s",\n  "lastDetail": "%s",\n  "release": "%s"\n}\n' \
    "$commit" "${commit:0:7}" "$built" "$BRANCH" "$(now)" "$result" "$attempted" \
    "$(printf '%s' "$detail" | tr '\n"\\' '   ' | cut -c1-400)" "$(basename "$(readlink -f "$ROOT/current" 2>/dev/null)")" > "$tmp"
  mv -f "$tmp" "$STATE/status.json"
}

if ! git -C "$REPO" fetch --quiet origin "$BRANCH" 2>"$STATE/fetch.err"; then
  log "fetch failed: $(tail -1 "$STATE/fetch.err")"; write_status "failed:fetch" "" "$(tail -3 "$STATE/fetch.err")"; exit 1
fi
REMOTE=$(git -C "$REPO" rev-parse FETCH_HEAD)
if [ "$REMOTE" = "$(serving_commit)" ] && [ "$FORCE" != "--force" ]; then
  write_status "unchanged" "$REMOTE"; exit 0
fi
# A head whose build already failed is not rebuilt every 5 minutes; the failure stays on the status page until the
# trunk moves again (or --force).
if [ "$REMOTE" = "$(cat "$STATE/failed-commit" 2>/dev/null)" ] && [ "$FORCE" != "--force" ]; then
  write_status "$(cat "$STATE/failed-result" 2>/dev/null || echo failed)" "$REMOTE" "not rebuilt: this head already failed (update.sh --force to retry)"; exit 1
fi
fail() { echo "$REMOTE" > "$STATE/failed-commit"; echo "$1" > "$STATE/failed-result"; write_status "$1" "$REMOTE" "$2"; exit 1; }

log "building ${REMOTE:0:7} (serving $(serving_commit | cut -c1-7))"
git -C "$REPO" reset --hard --quiet "$REMOTE" && git -C "$REPO" clean -fdq -e node_modules
BUILD_LOG="$STATE/build-${REMOTE:0:7}.log"
if ! (cd "$REPO" && npm ci --no-audit --no-fund --loglevel=error) >"$BUILD_LOG" 2>&1; then
  log "npm ci failed for ${REMOTE:0:7}, still serving $(serving_commit | cut -c1-7)"
  fail "failed:npm-ci" "$(tail -5 "$BUILD_LOG")"
fi
if ! (cd "$REPO" && $BUILD_CMD) >>"$BUILD_LOG" 2>&1 || [ ! -f "$REPO/dist/index.html" ]; then
  log "build failed for ${REMOTE:0:7}, still serving $(serving_commit | cut -c1-7)"
  fail "failed:build" "$(tail -5 "$BUILD_LOG")"
fi

BUILT_AT=$(now)
RELEASE="$ROOT/releases/$(date -u +%Y%m%dT%H%M%SZ)-${REMOTE:0:7}"
cp -a "$REPO/dist" "$RELEASE"
printf '{\n  "commit": "%s",\n  "builtAt": "%s",\n  "branch": "%s",\n  "node": "%s"\n}\n' "$REMOTE" "$BUILT_AT" "$BRANCH" "$(node -v)" > "$RELEASE/build.json"
# Commit badge (7 hex digits, top-left corner, links to /status): added to the release copy, not to the game code.
BADGE="<a id=\"fls-play-build\" href=\"/status\" title=\"본선 ${REMOTE:0:7} · 빌드 ${BUILT_AT}\" style=\"position:fixed;left:3px;top:1px;z-index:2147483647;font:10px/1.2 ui-monospace,monospace;color:#f4ecd8;background:rgba(33,24,16,.55);padding:1px 4px;border-radius:3px;text-decoration:none;opacity:.75\">${REMOTE:0:7}</a>"
sed -i "s|</body>|${BADGE}</body>|" "$RELEASE/index.html"
ln -sfn "$RELEASE" "$ROOT/current.next" && mv -Tf "$ROOT/current.next" "$ROOT/current"
log "serving ${REMOTE:0:7} from $(basename "$RELEASE")"
rm -f "$STATE/failed-commit" "$STATE/failed-result"
write_status "ok" "$REMOTE"

# Keep the 3 newest releases besides the serving one.
SERVING=$(readlink -f "$ROOT/current")
ls -1d "$ROOT"/releases/*/ 2>/dev/null | sed 's#/$##' | sort -r | grep -vx "$SERVING" | tail -n +4 | xargs -r rm -rf
ls -1t "$STATE"/build-*.log 2>/dev/null | tail -n +6 | xargs -r rm -f

# Refresh the installed scripts from the new commit (atomic per file); restart the server if serve.mjs changed.
for file in update.sh serve.mjs; do
  if [ -f "$REPO/deploy/play-server/$file" ] && ! cmp -s "$REPO/deploy/play-server/$file" "$ROOT/bin/$file"; then
    cp "$REPO/deploy/play-server/$file" "$ROOT/bin/$file.new" && chmod +x "$ROOT/bin/$file.new" && mv -f "$ROOT/bin/$file.new" "$ROOT/bin/$file"
    [ "$file" = serve.mjs ] && systemctl --user restart fls-play.service && log "server restarted for a new serve.mjs"
  fi
done
exit 0
