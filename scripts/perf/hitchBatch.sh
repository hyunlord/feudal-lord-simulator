#!/usr/bin/env bash
# SMOOTH-1 batch: every scene at 1x, 3x and 5x through scripts/perf/hitchAudit.ts, one after another (never two at once:
# they would measure each other). Serves a production build (vite build --minify false) on its own port.
#   bash scripts/perf/hitchBatch.sh --machine <label> --states <dir of *.save.json> --out <summary dir> --traces <dir>
#     [--headed] [--port 4390] [--seconds 180] [--moment-seconds 60] [--only scene[,scene…]] [--speeds 1,3,5] [--no-trace]
# On the DGX: scripts/remote/run.sh infra-SMOOTH1 --detach -- bash scripts/perf/hitchBatch.sh --machine dgx-headless ...
set -uo pipefail
machine=""; states=""; out=""; traces=""; headed=""; notrace=""; port=${FLS_REMOTE_PORT:-4390}; seconds=180; moment=60; only=""; speeds="1 3 5"
while [ $# -gt 0 ]; do
  case "$1" in
    --machine) machine=$2; shift 2 ;; --states) states=$2; shift 2 ;; --out) out=$2; shift 2 ;; --traces) traces=$2; shift 2 ;;
    --headed) headed=--headed; shift ;; --no-trace) notrace=--no-trace; shift ;; --port) port=$2; shift 2 ;; --seconds) seconds=$2; shift 2 ;;
    --moment-seconds) moment=$2; shift 2 ;; --only) only=",$2,"; shift 2 ;; --speeds) speeds=${2//,/ }; shift 2 ;;
    *) echo "unknown option $1" >&2; exit 2 ;;
  esac
done
[ -n "$machine" ] && [ -n "$states" ] && [ -n "$out" ] && [ -n "$traces" ] || { echo "--machine --states --out --traces required" >&2; exit 2; }
mkdir -p "$out" "$traces"
build=$(mktemp -d "${TMPDIR:-/tmp}/fls-smooth1-build.XXXXXX")
node_modules/.bin/vite build --minify false --outDir "$build" --emptyOutDir > "$out/build.log" 2>&1 || { tail -20 "$out/build.log"; exit 1; }
. scripts/remote/devServers.sh   # the preview server stops on any exit, failures and Ctrl-C included
fls_serve "$out/preview.log" preview --outDir "$build" --host 127.0.0.1 --port "$port" --strictPort
fls_on_exit 'rm -rf "$build"'
for _ in $(seq 1 60); do curl -sf "http://127.0.0.1:$port/" > /dev/null && break; sleep 1; done
{ echo "machine=$machine commit=$(git rev-parse HEAD 2>/dev/null) node=$(node -v) date=$(date -Iseconds)"; uname -a; } > "$out/run-info.txt"

# scene | save file (- = a new game) | action | seconds. ch2-1340 is chapter 2's winter of 1339 (seed 2: chapter 2 ends in
# 1340), so its run also crosses the chapter change 400 ticks in: the chapter-change moment is measured there.
SCENES="
ch1-new|-|none|$seconds
ch2-1340|pre-chapter3|none|$seconds
ch3-plague|ch3-plague|none|$seconds
ch4-1380|ch4-1380|none|$seconds
ch5-1440|ch5-1440|none|$seconds
ops-camera|ch4-1380|camera|$seconds
ops-placement|ch4-1380|placement|$seconds
ops-drawers|ch4-1380|drawers|$seconds
moment-petition|pre-petition|none|$moment
"
for row in $SCENES; do
  IFS='|' read -r scene savefile action secs <<< "$row"
  [ -z "$only" ] || [[ "$only" == *",$scene,"* ]] || continue
  saveArgs=()
  if [ "$savefile" != "-" ]; then
    [ -f "$states/$savefile.save.json" ] || { echo "skip $scene: no $states/$savefile.save.json"; continue; }
    saveArgs=(--save "$states/$savefile.save.json")
  fi
  for speed in $speeds; do
    echo "== $(date +%H:%M:%S) $scene x$speed ($action, ${secs}s)"
    NODE_OPTIONS=--max-old-space-size=8192 node_modules/.bin/tsx scripts/perf/hitchAudit.ts --url "http://127.0.0.1:$port/" --scene "$scene" \
      ${saveArgs[@]+"${saveArgs[@]}"} --speed "$speed" --seconds "$secs" --action "$action" --machine "$machine" --out "$out" --traces "$traces" $headed $notrace \
      2>&1 | tail -3
  done
done
echo "== $(date +%H:%M:%S) done"
