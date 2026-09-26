#!/usr/bin/env bash
# Remote runner (REMOTE-1): edit on the Mac, run heavy verification on the DGX Spark, bring back only the results.
#
#   scripts/remote/run.sh <label> [--slot guardrail] [--detach] -- <command ...>
#   scripts/remote/run.sh --task test|guardrail|browser|perf|clone-check [task args ...]   (label: $FLS_REMOTE_LABEL or branch)
#   scripts/remote/run.sh --attach <run>     follow a detached/interrupted run, then fetch its results
#   scripts/remote/run.sh --fetch <run>      fetch results only
#   scripts/remote/run.sh --status           active remote runs and run folders
#
# One run:
#  1. The working tree as git sees it (tracked + untracked-not-ignored; never node_modules, .git, dist) is rsynced to
#     DGX ~/fls-runs/<label>-<shortsha>/. Unchanged files are copied on the DGX from the newest previous run folder
#     (--copy-dest + --checksum), so only edits cross the network. Commits not on origin travel as a git bundle.
#  2. On the DGX, scripts/remote/remote-exec.sh runs inside a systemd user scope in fls-runs.slice
#     (MemoryMax=48G, CPUQuota=1200% = 12 of 20 cores, nice 10): git metadata for the run folder, node_modules from the
#     lockfile-hash cache, a port from 4300-4399, a guardrail slot (2 at a time), then the command.
#  3. The run's .remote/ folder (logs, summaries, guardrail/perf raw) comes back to .remote-runs/<run>/, and files the
#     command created or changed under docs/ seeds/ perf/ output/ fixtures/ come back into this working tree
#     (rsync --update: a file edited here during the run is never overwritten).
#  4. The DGX keeps the 10 newest run folders. The exit status is the command's.
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
  rsync -a -e "ssh $SSH_OPTS" "$HOST:$RROOT/$run/.remote/" "$local_dir/" || { echo "remote: could not fetch $run/.remote" >&2; return 1; }
  if [ -s "$local_dir/changed-files.txt" ]; then
    # --update: never replace a file that is newer here (edited while the run was going).
    rsync -a --update -e "ssh $SSH_OPTS" --files-from="$local_dir/changed-files.txt" "$HOST:$RROOT/$run/" "$REPO/"
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
  ""|-h|--help) sed -n '2,23p' "$0"; exit 0 ;;
  --status)
    rsh "systemctl --user list-units 'fls-run-*' --no-pager --no-legend; systemctl --user status fls-runs.slice --no-pager 2>/dev/null | sed -n '1,8p'; ls -1t $RROOT | grep -v '^_'"
    exit 0 ;;
  --fetch) [ -n "${2:-}" ] || die "--fetch <run>"; finish "$2"; exit $? ;;
  --attach) [ -n "${2:-}" ] || die "--attach <run>"; follow "$2" || true; finish "$2"; exit $? ;;
esac

SLOT=""; DETACH=0
if [ "$1" = "--task" ]; then
  TASK=${2:-}; shift 2 || die "--task <name>"
  LABEL=${FLS_REMOTE_LABEL:-$(default_label)}
  case "$TASK" in
    guardrail) SLOT=guardrail ;;
    test|browser|perf|clone-check) ;;
    *) die "unknown task: $TASK (test|guardrail|browser|perf|clone-check)" ;;
  esac
  [ "${FLS_REMOTE_DETACH:-0}" = 1 ] && DETACH=1
  set -- bash scripts/remote/tasks.sh "$TASK" "$@"
else
  LABEL=$1; shift
  while [ $# -gt 0 ] && [ "$1" != "--" ]; do
    case "$1" in
      --slot) SLOT=${2:-}; shift 2 ;;
      --detach) DETACH=1; shift ;;
      *) die "unknown option $1 (did you forget -- before the command?)" ;;
    esac
  done
  [ "${1:-}" = "--" ] || die "usage: run.sh <label> [--slot guardrail] [--detach] -- <command ...>"
  shift
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
  printf 'CMD=%q\n' "$(printf '%q ' "$@")"
} > "$TMP/meta.env"

state=$(rsh "mkdir -p $RROOT/_locks $RROOT/$RUN/.remote-in && \
  { flock -n $RROOT/_locks/$RUN.lock true 2>/dev/null || echo BUSY; }; \
  ls -1dt $RROOT/*/ 2>/dev/null | sed 's#/\$##; s#.*/##' | grep -v '^_' | grep -vx '$RUN' | head -1 | sed 's/^/PREV=/'")
case "$state" in *BUSY*) die "$RUN is already running on the DGX (scripts/remote/run.sh --attach $RUN)";; esac
PREV=$(printf '%s\n' "$state" | sed -n 's/^PREV=//p')
COPY_DEST=""; [ -n "$PREV" ] && COPY_DEST="--copy-dest=../$PREV"

echo "remote: $RUN ($(wc -l < "$TMP/files.txt" | tr -d ' ') files, dirty=$DIRTY${PREV:+, local copies from $PREV}) -> $HOST"
rsync -a --checksum $COPY_DEST -e "ssh $SSH_OPTS" --files-from="$TMP/files.txt" "$REPO/" "$HOST:$RROOT/$RUN/"
rsync -a -e "ssh $SSH_OPTS" "$TMP/meta.env" "$TMP/in-files.txt" $( [ -f "$TMP/head.bundle" ] && echo "$TMP/head.bundle" ) "$HOST:$RROOT/$RUN/.remote-in/"
SYNC_S=$(since "$T0")
echo "SYNC_S=$SYNC_S" > "$TMP/sync.env"; rsync -a -e "ssh $SSH_OPTS" "$TMP/sync.env" "$HOST:$RROOT/$RUN/.remote-in/"

rsh "bash $RROOT/$RUN/scripts/remote/remote-exec.sh launch $RUN" >/dev/null || die "launch failed"
if [ "$DETACH" = 1 ]; then
  echo "remote: $RUN running detached. Follow: scripts/remote/run.sh --attach $RUN   Fetch: scripts/remote/run.sh --fetch $RUN"
  exit 0
fi
follow "$RUN" || true
finish "$RUN" "$T0"
