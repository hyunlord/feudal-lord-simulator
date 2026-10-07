#!/usr/bin/env bash
# Remote runner (REMOTE-1): edit on the Mac, run heavy verification on the DGX Spark, bring back only the results.
#
#   scripts/remote/run.sh <label> [--heavy|--light] [--gate|--experiment] [--detach] [--keep] -- <command ...>
#   scripts/remote/run.sh --task test|guardrail|browser|perf|ui-geometry|clone-check|trend [--gate|--experiment] [task args ...]   (label: $FLS_REMOTE_LABEL or branch)
#   --gate: a check a push needs (the changed rows' geometry audit, test:changed run heavy): the gate line, which has a
#   slot of its own; anything else heavy is an experiment (the default). Decision RR20, scripts/remote/heavySlots.sh.
#   scripts/remote/run.sh --attach <run>     follow a detached/interrupted run, then fetch its results
#   scripts/remote/run.sh --fetch <run>      fetch results only
#   scripts/remote/run.sh --status           active remote runs, run folders and kept runs
#   scripts/remote/run.sh --release <run>    let a kept run go (the prune may take its folder again)
#
# One run:
#  1. The working tree as git sees it (tracked + untracked-not-ignored; never node_modules, .git, dist) is rsynced to
#     DGX ~/fls-runs/<label>-<shortsha>/. Unchanged files are copied on the DGX from the newest previous run folder
#     (--copy-dest + --checksum), so only edits cross the network. Commits not on origin travel as a git bundle.
#  2. On the DGX, scripts/remote/remote-exec.sh runs inside a systemd user scope in fls-runs.slice
#     (MemoryMax=48G, CPUQuota=1200% = 12 of 20 cores, nice 10): git metadata for the run folder, node_modules from the
#     lockfile-hash cache, two ports from 4300-4399 (FLS_REMOTE_PORT and FLS_REMOTE_BASE_PORT), a heavy-run slot when
#     the run is heavy (at most 2 heavy runs at once across all sessions; the others wait in line and log their place),
#     then the command. Heavy: --task test|guardrail|ui-geometry|clone-check, and a command run with --heavy or
#     --detach or calling a known heavy script (uiGeometryAudit, efficientGrowthRun) unless --light. Light: --task
#     browser|perf|trend (measuring never waits, RR3), single test files and short probes.
#  3. The run's .remote/ folder (logs, summaries, guardrail/perf raw) comes back to .remote-runs/<run>/, and files the
#     command created or changed under docs/ seeds/ perf/ output/ fixtures/ come back into this working tree
#     (rsync --update: a file edited here during the run is never overwritten).
#  4. The DGX keeps the 10 newest run folders. A run started with --keep (or FLS_REMOTE_KEEP_RUN=1 for --task) is a
#     judgement run: its folder is not pruned and its results are also copied to ~/fls-runs/_kept/<run>/, which no
#     prune touches; --fetch reads from there once the folder is gone. The exit status is the command's.
# The play server (port 4173, ~/fls-play) is never touched. Usage and rules: docs/REMOTE_RUNS.md.
set -euo pipefail

HOST=${FLS_REMOTE_HOST:-hyunlord@100.70.109.50}
RROOT=fls-runs
SSH_OPTS="-o BatchMode=yes -o ServerAliveInterval=30 -o ServerAliveCountMax=10 -o ConnectTimeout=15"
REPO=$(git rev-parse --show-toplevel)
cd "$REPO"

die() { echo "remote: $*" >&2; exit 2; }
rsh() { ssh $SSH_OPTS "$HOST" "$@"; }
now() { perl -MTime::HiRes=time -e 'printf "%.1f\n", time'; }
since() { perl -e "printf '%.1f', $(now) - $1"; }

default_label() {
  git rev-parse --abbrev-ref HEAD | sed -e 's#/#-#g' -e 's#[^A-Za-z0-9._-]##g' -e 's#^[._-]*##'
}

fetch_results() {
  local run=$1 local_dir="$REPO/.remote-runs/$1"
  mkdir -p "$local_dir"
  local src="$RROOT/$run"
  # A kept run whose folder was pruned (by an older copy of remote-exec.sh) is read from _kept/.
  # A kept run packed by the disk upkeep (scripts/remote/diskClean.sh) is unpacked from _kept/_archive/ first.
  rsh "[ -d $src/.remote ]" 2>/dev/null || { rsh "[ -d $RROOT/_kept/$run/.remote ] || { [ -f $RROOT/_kept/_archive/$run.tar.zst ] && tar -C $RROOT/_kept --zstd -xf $RROOT/_kept/_archive/$run.tar.zst && rm -f $RROOT/_kept/_archive/$run.tar.zst; }" 2>/dev/null && rsh "[ -d $RROOT/_kept/$run/.remote ]" 2>/dev/null && src="$RROOT/_kept/$run"; }
  rsync -a -e "ssh $SSH_OPTS" "$HOST:$src/.remote/" "$local_dir/" || { echo "remote: could not fetch $run/.remote" >&2; return 1; }
  if [ -s "$local_dir/changed-files.txt" ]; then
    # --update: never replace a file that is newer here (edited while the run was going).
    rsync -a --update -e "ssh $SSH_OPTS" --files-from="$local_dir/changed-files.txt" "$HOST:$src/" "$REPO/"
    echo "remote: $(wc -l < "$local_dir/changed-files.txt" | tr -d ' ') result file(s) copied into the working tree (list: .remote-runs/$run/changed-files.txt)"
  fi
}

follow() {
  local run=$1 pid
  pid=$(rsh "cat $RROOT/$run/.remote/pid 2>/dev/null" || true)
  [ -n "$pid" ] || die "no pid for $run"
  # tail exits once the run's process is gone; an ssh drop leaves the run going (reattach with --attach).
  if ! rsh "tail -n +1 -F --pid=$pid $RROOT/$run/.remote/run.log 2>/dev/null"; then
    echo "remote: connection lost; the run continues on the DGX. Reattach: scripts/remote/run.sh --attach $run" >&2
    return 255
  fi
}

finish() {
  local run=$1 t0=${2:-} rc
  fetch_results "$run" || true
  rc=$(cat "$REPO/.remote-runs/$run/exit-code" 2>/dev/null || echo "")
  if [ -z "$rc" ]; then
    echo "remote: $run left no exit code (killed? memory limit?). Log: .remote-runs/$run/run.log" >&2; rc=255
  fi
  if [ -f "$REPO/.remote-runs/$run/timing.env" ]; then
    # shellcheck disable=SC1090
    . "$REPO/.remote-runs/$run/timing.env"
    echo "remote: $run exit=$rc  prepare=${PREPARE_S:-?}s (node_modules ${NM_CACHE:-?}) wait=${WAIT_S:-0}s command=${COMMAND_S:-?}s${t0:+  sync=${SYNC_S}s  total=$(since "$t0")s}"
  fi
  echo "remote: results in .remote-runs/$run/"
  return "$rc"
}

case "${1:-}" in
  ""|-h|--help) sed -n '2,24p' "$0"; exit 0 ;;
  --status)
    rsh "systemctl --user list-units 'fls-run-*' --no-pager --no-legend; systemctl --user status fls-runs.slice --no-pager 2>/dev/null | sed -n '1,8p'; ls -1t $RROOT | grep -v '^_'; echo '== kept:'; ls -1t $RROOT/_kept 2>/dev/null
      echo '== heavy slots (at most 3 at once, or the number in _slots/max; the last is kept for the gate line):'; for f in $RROOT/_slots/heavy.*.lock; do [ -e \"\$f\" ] && ! flock -n \"\$f\" true && tr '\\t' ' ' < \"\${f%.lock}.info\"; done; echo '== gate line:'; ls -1 $RROOT/_slots/queue-gate 2>/dev/null | grep -v _slotkeeper | sed 's/^[0-9]*-//'; echo '== experiment line:'; ls -1 $RROOT/_slots/queue 2>/dev/null | grep -v _slotkeeper | sed 's/^[0-9]*-//'; echo '== experiment line by session (waiting · served last):'; ls -1 $RROOT/_slots/queue 2>/dev/null | grep -v _slotkeeper | sed 's/^[0-9]*-//; s/-.*//' | sort | uniq -c | while read n s; do echo \"   \$s \$n waiting · served \$(date -r $RROOT/_slots/served/\$s +%H:%M 2>/dev/null || echo never)\"; done
      if [ -e $RROOT/_slots/keeper.lock ] && ! flock -n $RROOT/_slots/keeper.lock true; then echo '== the DGX slot keeper decides who goes (decision RR23):'; cat $RROOT/_slots/keeper.status 2>/dev/null; else echo '== the DGX slot keeper is not running: each run follows its own copy of the rules'; fi"
    exit 0 ;;
  --release) [ -n "${2:-}" ] || die "--release <run>"
    rsh "rm -rf $RROOT/_kept/${2:?}; rm -f $RROOT/${2:?}/.remote/keep"; echo "remote: released $2"; exit 0 ;;
  --fetch) [ -n "${2:-}" ] || die "--fetch <run>"; finish "$2"; exit $? ;;
  --attach) [ -n "${2:-}" ] || die "--attach <run>"; follow "$2" || true; finish "$2"; exit $? ;;
esac

SLOT=""; DETACH=0; KEEP_RUN=${FLS_REMOTE_KEEP_RUN:-0}; WEIGHT=; CLASS=${FLS_REMOTE_CLASS:-experiment}
if [ "$1" = "--task" ]; then
  TASK=${2:-}; shift 2 || die "--task <name>"
  LABEL=${FLS_REMOTE_LABEL:-$(default_label)}
  case "$TASK" in
    guardrail|test|ui-geometry|clone-check) SLOT=heavy ;;
    browser|perf|trend) ;;
    *) die "unknown task: $TASK (test|guardrail|browser|perf|ui-geometry|clone-check|trend)" ;;
  esac
  [ "${FLS_REMOTE_DETACH:-0}" = 1 ] && DETACH=1
  # --gate / --experiment may stand anywhere among the task's arguments; they are run.sh's, not the task's.
  rest=(); for a in "$@"; do case "$a" in --gate) CLASS=gate ;; --experiment) CLASS=experiment ;; *) rest+=("$a") ;; esac; done
  set -- bash scripts/remote/tasks.sh "$TASK" ${rest[@]+"${rest[@]}"}
else
  LABEL=$1; shift
  while [ $# -gt 0 ] && [ "$1" != "--" ]; do
    case "$1" in
      --slot) SLOT=heavy; shift 2 ;;   # the old --slot guardrail: a heavy run
      --heavy) WEIGHT=heavy; shift ;;
      --light) WEIGHT=light; shift ;;
      --detach) DETACH=1; shift ;;
      --keep) KEEP_RUN=1; shift ;;
      --gate) CLASS=gate; shift ;;
      --experiment) CLASS=experiment; shift ;;
      *) die "unknown option $1 (did you forget -- before the command?)" ;;
    esac
  done
  [ "${1:-}" = "--" ] || die "usage: run.sh <label> [--heavy|--light] [--detach] [--keep] -- <command ...>"
  shift
  # Heavy-run cap (scripts/remote/heavySlots.sh, decision RR14): explicit, or a detached run (runs over 20 minutes go
  # detached), or a known heavy script; --light keeps a short run outside the cap.
  case "$WEIGHT" in
    heavy) SLOT=heavy ;;
    light) SLOT="" ;;
    *) if [ "$SLOT" = heavy ] || [ "$DETACH" = 1 ] || printf '%s ' "$@" | grep -Eq 'uiGeometryAudit|efficientGrowthRun|tasks\.sh (test|guardrail|ui-geometry|clone-check)'; then SLOT=heavy; fi ;;
  esac
fi
[ $# -gt 0 ] || die "no command"
echo "$LABEL" | grep -Eq '^[A-Za-z0-9][A-Za-z0-9._-]{0,60}$' || die "label must match [A-Za-z0-9][A-Za-z0-9._-]* (e.g. render-F0V): '$LABEL'"

T0=$(now)
SHORT=$(git rev-parse --short=7 HEAD)
FULL=$(git rev-parse HEAD)
RUN="$LABEL-$SHORT"
DIRTY=0; [ -z "$(git status --porcelain --untracked-files=no)" ] || DIRTY=1
TMP=$(mktemp -d "${TMPDIR:-/tmp}/fls-remote.XXXXXX")
trap 'rm -rf "$TMP"' EXIT

# Files to send: what git sees (tracked + untracked-not-ignored), minus deleted files and session state folders.
git -c core.quotePath=false ls-files -d | sort > "$TMP/deleted"
git -c core.quotePath=false ls-files -co --exclude-standard | sort -u | comm -23 - "$TMP/deleted" \
  | grep -Ev '^(\.omc|\.omx|\.remote-runs|\.remote|\.remote-in|node_modules|dist)/' > "$TMP/files.txt"
cp "$TMP/files.txt" "$TMP/in-files.txt"
# Commits the DGX mirror cannot fetch from origin go along as a bundle.
if git bundle create "$TMP/head.bundle" HEAD --not --remotes=origin >/dev/null 2>&1; then :; else rm -f "$TMP/head.bundle"; fi
{
  printf 'RUN=%q\nLABEL=%q\nSHORT_SHA=%q\nFULL_SHA=%q\nDIRTY=%q\nSLOT=%q\nBRANCH=%q\nMAC_HOST=%q\n' \
    "$RUN" "$LABEL" "$SHORT" "$FULL" "$DIRTY" "$SLOT" "$(git rev-parse --abbrev-ref HEAD)" "$(hostname -s)"
  printf 'KEEP_RUN=%q\nRUN_CLASS=%q\n' "$KEEP_RUN" "$CLASS"
  printf 'CMD=%q\n' "$(printf '%q ' "$@")"
} > "$TMP/meta.env"

# The run's lock is held from before its folder exists until the run itself holds it: an ssh session takes it and keeps
# it while its stdin (a fifo held open here) stays open. A prune from any run (any branch's remote-exec.sh) skips a
# locked folder, so the upload is never deleted under rsync (6e6b96eb's trend, 2026-10-02: its folder was pruned while
# files were still arriving). remote-exec.sh run waits for the lock, so releasing it after the launch leaves no gap.
mkfifo "$TMP/lock.fifo"
rsh "mkdir -p $RROOT/_locks && exec 9>$RROOT/_locks/$RUN.lock && { flock -n 9 || { echo BUSY; exit 1; }; } && echo LOCKED && cat >/dev/null" \
  < "$TMP/lock.fifo" > "$TMP/lock.out" 2>&1 &
LOCK_SSH=$!
exec 7>"$TMP/lock.fifo"
release_lock() { exec 7>&- 2>/dev/null; wait "$LOCK_SSH" 2>/dev/null; }
trap 'release_lock; rm -rf "$TMP"' EXIT
for _ in $(seq 1 300); do grep -q 'LOCKED\|BUSY' "$TMP/lock.out" 2>/dev/null && break; kill -0 "$LOCK_SSH" 2>/dev/null || break; sleep 0.1; done
grep -q BUSY "$TMP/lock.out" && die "$RUN is already running on the DGX (scripts/remote/run.sh --attach $RUN)"
grep -q LOCKED "$TMP/lock.out" || die "could not lock $RUN on the DGX: $(tail -1 "$TMP/lock.out")"
state=$(rsh "mkdir -p $RROOT/$RUN/.remote-in && \
  ls -1dt $RROOT/*/ 2>/dev/null | sed 's#/\$##; s#.*/##' | grep -v '^_' | grep -v '^trunk-' | grep -vx '$RUN' | head -1 | sed 's/^/PREV=/'; \
  { sed 's/^/TRUNK=/' $RROOT/_trunk/status 2>/dev/null || true; }")
PREV=$(printf '%s\n' "$state" | sed -n 's/^PREV=//p')
# The trunk's bundled clean clone (scripts/remote/trunkClone.sh) failed: every run says so until a later trunk passes.
TRUNK_STATE=$(printf '%s\n' "$state" | sed -n 's/^TRUNK=//p')
case "$TRUNK_STATE" in FAILED*) echo "== TRUNK CLONE FAILED — the session whose commit it names fixes or reverts it: ${TRUNK_STATE#FAILED }" >&2 ;; esac
COPY_DEST=""; [ -n "$PREV" ] && COPY_DEST="--copy-dest=../$PREV"

echo "remote: $RUN ($(wc -l < "$TMP/files.txt" | tr -d ' ') files, dirty=$DIRTY${PREV:+, local copies from $PREV}${SLOT:+, heavy $CLASS line}) -> $HOST"
rsync -a --checksum $COPY_DEST -e "ssh $SSH_OPTS" --files-from="$TMP/files.txt" "$REPO/" "$HOST:$RROOT/$RUN/"
rsync -a -e "ssh $SSH_OPTS" "$TMP/meta.env" "$TMP/in-files.txt" $( [ -f "$TMP/head.bundle" ] && echo "$TMP/head.bundle" ) "$HOST:$RROOT/$RUN/.remote-in/"
SYNC_S=$(since "$T0")
echo "SYNC_S=$SYNC_S" > "$TMP/sync.env"; rsync -a -e "ssh $SSH_OPTS" "$TMP/sync.env" "$HOST:$RROOT/$RUN/.remote-in/"

# rsync -a gave the folder the Mac's old modification time; the prune keeps the newest ten, so make it new.
rsh "touch $RROOT/$RUN" || true
rsh "bash $RROOT/$RUN/scripts/remote/remote-exec.sh launch $RUN" >/dev/null || die "launch failed"
release_lock   # remote-exec.sh run is waiting for it
if [ "$DETACH" = 1 ]; then
  echo "remote: $RUN running detached. Follow: scripts/remote/run.sh --attach $RUN   Fetch: scripts/remote/run.sh --fetch $RUN"
  exit 0
fi
follow "$RUN" || true
finish "$RUN" "$T0"
