#!/usr/bin/env bash
# The trunk's bundled clean clone (user order 2026-10-06). Runs on the DGX from the timer fls-trunk-clone (3 hours after
# the previous one ended, so every 3–4 hours); the timer loads this file from the trunk each time.
# Before a trunk push the sessions only run check:merge, the tests their change touches and the changed UI rows'
# geometry audit; the full clean-clone suite runs here, once over every commit since the last check:
#   1. the trunk head (mirror) gets a run folder like run.sh makes and runs `tasks.sh clone-check` (heavy slot, kept);
#   2. passed: _trunk/last-good = the head, _trunk/status "OK …";
#   3. failed: a second run bisects the first-parent commits last-good..head with the step that failed (the failing
#      test files, typecheck or build) and names the first bad commit, its subject and the branch it merged;
#      _trunk/status "FAILED …" — run.sh prints it at every run until a later trunk passes, so the session whose commit
#      broke it fixes or reverts it.
# Every result is a line in _trunk/history.log. Nothing new on the trunk since the last check: nothing runs.
set -uo pipefail
BASE=$HOME/fls-runs
MIRROR=$BASE/_cache/repo.git
TRUNK=${FLS_TRUNK:-codex/phase15-organic-ground}
ST=$BASE/_trunk
mkdir -p "$ST" "$BASE/_locks"
exec 9> "$ST/.lock"
flock -n 9 || { echo "trunk clone: another one is going"; exit 0; }
log() { echo "$(date '+%F %T') $*" | tee -a "$ST/history.log"; }

( flock 7; git -C "$MIRROR" fetch -q --prune origin ) 7> "$BASE/_locks/repo-mirror.lock"
head=$(git -C "$MIRROR" rev-parse -q --verify "refs/heads/$TRUNK") || { log "trunk clone: no $TRUNK in the mirror"; exit 1; }
[ "$head" = "$(cat "$ST/last-checked" 2> /dev/null)" ] && { echo "trunk clone: ${head:0:8} already checked"; exit 0; }
good=$(cat "$ST/last-good" 2> /dev/null || true)

# A run folder of <sha> from the mirror, launched like run.sh does (its lock is held until the launch so no clean can
# take the half-made folder). Prints the run's name.
launch() { # <label> <sha> <gate|experiment> <command ...>
  local label=$1 sha=$2 class=$3; shift 3
  local run="$label-${sha:0:7}" dir
  dir=$BASE/$run
  exec 8> "$BASE/_locks/$run.lock"; flock 8
  rm -rf "$dir"; mkdir -p "$dir/.remote-in"
  git -C "$MIRROR" archive "$sha" | tar -x -C "$dir"
  git -C "$MIRROR" ls-tree -r --name-only "$sha" > "$dir/.remote-in/in-files.txt"
  { printf 'RUN=%q\nLABEL=%q\nSHORT_SHA=%q\nFULL_SHA=%q\nDIRTY=0\nSLOT=heavy\nBRANCH=%q\nMAC_HOST=dgx-timer\nKEEP_RUN=1\nRUN_CLASS=%q\n' \
      "$run" "$label" "${sha:0:7}" "$sha" "$TRUNK" "$class"
    printf 'CMD=%q\n' "$(printf '%q ' "$@")"; } > "$dir/.remote-in/meta.env"
  bash "$dir/scripts/remote/remote-exec.sh" launch "$run" > /dev/null
  old "$dir"
  exec 8>&-
  echo "$run"
}
# A trunk run folder is made with `git archive`: its LFS files are pointers. As the newest folder it would be the copy
# source of the next session's upload (run.sh --copy-dest), and every LFS file would cross the network again (62 min for
# one upload, 2026-10-06). So it is kept looking old while it runs; run.sh also skips trunk-* folders.
old() { touch -d "2 days ago" "$1" 2> /dev/null; }
wait_run() { while [ ! -f "$BASE/$1/.remote/exit-code" ]; do old "$BASE/$1"; sleep 120; done; old "$BASE/$1"; cat "$BASE/$1/.remote/exit-code"; }

# The clone is long: the experiment line. The bisect that names a breaking commit is short and every session waits
# on a broken trunk: the gate line (decision RR20).
run=$(launch trunk-CLONE "$head" experiment bash scripts/remote/tasks.sh clone-check)
log "trunk clone ${head:0:8}: $run started (last good ${good:0:8})"
rc=$(wait_run "$run")
echo "$head" > "$ST/last-checked"
out=$BASE/$run/.remote
if [ "$rc" = 0 ]; then
  echo "$head" > "$ST/last-good"
  printf 'OK %s %s %s\n' "${head:0:8}" "$(date '+%F %T')" "$(grep -m1 '^test:' "$out/summary.txt" | cut -c1-120)" > "$ST/status"
  log "trunk clone ${head:0:8}: passed ($run)"
  exit 0
fi

# Which step failed, and the command that shows it on one commit.
step=$(grep -E ': exit [1-9]' "$out/summary.txt" | head -1 | cut -d: -f1)
files=""
case "$step" in
  test) files=$( { grep -ohE '^✖ tests/[^ ]+\.test\.ts' "$out/summary.txt" "$out/clone-test.log" 2> /dev/null | sed 's/^✖ //';
                   grep -ohE 'tests/[A-Za-z0-9_./-]+\.test\.ts' <(sed -n '/failing tests:/,$p' "$out/clone-test.log" 2> /dev/null); } | sort -u | tr '\n' ' ')
        check=(node_modules/.bin/tsx --test $files) ;;
  typecheck) check=(npm run -s typecheck) ;;
  build) check=(npm run -s build) ;;
  *) check=() ;;
esac
culprit="(not bisected)"
if [ -n "$good" ] && [ ${#check[@]} -gt 0 ] && { [ "$step" != test ] || [ -n "$files" ]; }; then
  brun=$(launch trunk-BISECT "$head" gate bash scripts/remote/tasks.sh trunk-bisect "$good" "$head" -- "${check[@]}")
  log "trunk clone ${head:0:8}: $step failed ($files); bisecting ${good:0:8}..${head:0:8} in $brun"
  wait_run "$brun" > /dev/null
  culprit=$(cat "$BASE/$brun/.remote/bisect.txt" 2> /dev/null || echo "(bisect gave no answer: see $brun)")
elif [ -z "$good" ]; then culprit="(no earlier passing trunk to bisect from)"
fi
printf 'FAILED %s %s | %s failed%s | first bad: %s | logs: _kept/%s\n' "${head:0:8}" "$(date '+%F %T')" "${step:-clone}" \
  "${files:+ ($files)}" "$culprit" "$run" > "$ST/status"
log "$(cat "$ST/status")"
exit 1
