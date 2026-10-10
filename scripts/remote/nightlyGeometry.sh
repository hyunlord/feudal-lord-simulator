#!/usr/bin/env bash
# The nightly full geometry audit (decision RR26, user ruling 2026-10-10). Runs on the DGX from the timer
# fls-nightly-geometry (01:00); the timer loads this file from the trunk each time. A full audit takes about 5 hours,
# so it runs at night, on the experiment line and last of all (the slot keeper lets session `nightly` in only when no
# other session's experiment may go; the gates keep their slot). It catches what the changed-rows audits do not: the
# cross effects of pushes on each other (RR26 covered gave up the chance re-measuring of an earlier push's rows) and
# the scene state folders, which the gate cannot see. Its result is the next shared result: nothing here pushes (the
# MacBook sleeps and an unwatched push is avoided) — the REMOTE session fetches the kept run the next day and commits it
# with RETRIES.md and SHADOW.md (docs/REMOTE_RUNS.md). A day missed is no harm: the gate keeps the last shared result.
#   1. the trunk head (mirror) gets a run folder like run.sh makes (git archive), its LFS files pulled, and runs
#      `tasks.sh ui-geometry` (experiment line, kept);
#   2. _nightly/status says "OK|FAILED <head> <time> <run> | <summary>", _nightly/history.log keeps every night.
# Nothing new on the trunk since the last audit: nothing runs.
set -uo pipefail
BASE=$HOME/fls-runs
MIRROR=$BASE/_cache/repo.git
TRUNK=${FLS_TRUNK:-codex/phase15-organic-ground}
LFS_URL=https://github.com/hyunlord/feudal-lord-simulator.git/info/lfs
ST=$BASE/_nightly
mkdir -p "$ST" "$BASE/_locks"
exec 9> "$ST/.lock"
flock -n 9 || { echo "nightly geometry: another one is going"; exit 0; }
log() { echo "$(date '+%F %T') $*" | tee -a "$ST/history.log"; }

( flock 7; git -C "$MIRROR" fetch -q --prune origin ) 7> "$BASE/_locks/repo-mirror.lock"
head=$(git -C "$MIRROR" rev-parse -q --verify "refs/heads/$TRUNK") || { log "nightly geometry: no $TRUNK in the mirror"; exit 1; }
[ "$head" = "$(cat "$ST/last-audited" 2> /dev/null)" ] && { echo "nightly geometry: ${head:0:8} already audited"; exit 0; }

# A run folder of <sha> from the mirror, launched like run.sh does (as scripts/remote/trunkClone.sh). Prints its name.
launch() { # <label> <sha> <command ...>
  local label=$1 sha=$2; shift 2
  local run="$label-${sha:0:7}" dir
  dir=$BASE/$run
  exec 8> "$BASE/_locks/$run.lock"; flock 8
  rm -rf "$dir"; mkdir -p "$dir/.remote-in"
  git -C "$MIRROR" archive "$sha" | tar -x -C "$dir"
  git -C "$MIRROR" ls-tree -r --name-only "$sha" > "$dir/.remote-in/in-files.txt"
  { printf 'RUN=%q\nLABEL=%q\nSHORT_SHA=%q\nFULL_SHA=%q\nDIRTY=0\nSLOT=heavy\nBRANCH=%q\nMAC_HOST=dgx-timer\nKEEP_RUN=1\nRUN_CLASS=experiment\n' \
      "$run" "$label" "${sha:0:7}" "$sha" "$TRUNK"
    printf 'CMD=%q\n' "$(printf '%q ' "$@")"; } > "$dir/.remote-in/meta.env"
  bash "$dir/scripts/remote/remote-exec.sh" launch "$run" > /dev/null
  old "$dir"
  exec 8>&-
  echo "$run"
}
# Made with git archive, the folder holds LFS pointers until its run pulls them: kept looking old so no session's upload
# takes it as its copy source (run.sh --copy-dest), as trunkClone.sh does.
old() { touch -d "2 days ago" "$1" 2> /dev/null; }
wait_run() { while [ ! -f "$BASE/$1/.remote/exit-code" ]; do old "$BASE/$1"; sleep 120; done; old "$BASE/$1"; cat "$BASE/$1/.remote/exit-code"; }

# The audit reads the pictures: pull the LFS files first (the shared store under _cache/lfs), then audit the clean tree.
run=$(launch nightly-GEOMETRY "$head" bash -c "git config lfs.url $LFS_URL && git lfs pull && bash scripts/remote/tasks.sh ui-geometry")
log "nightly geometry ${head:0:8}: $run started"
rc=$(wait_run "$run")
echo "$head" > "$ST/last-audited"
summary=$(grep -m1 'measured' "$BASE/$run/.remote/summary.txt" 2> /dev/null | cut -c1-200)
printf '%s %s %s %s | %s\n' "$([ "$rc" = 0 ] && echo OK || echo FAILED)" "${head:0:8}" "$(date '+%F %T')" "$run" "${summary:-exit $rc}" > "$ST/status"
log "$(cat "$ST/status")"
[ "$rc" = 0 ]
