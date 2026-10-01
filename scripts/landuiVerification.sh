#!/usr/bin/env bash
# LAND-UI gates on the DGX, this build ($URL) beside the trunk before it ($BASE_URL):
#   scripts/remote/run.sh render-LANDUI-gate --detach -- bash scripts/remote/with-base-build.sh <trunk-sha> -- bash scripts/landuiVerification.sh [states|captures|perf|all]
# states    the land states (scripts/landStates.ts: five lands × summer/winter, the fen works, the downs' fords; seed 1,
#           LANDUI_TICKS=30000 ticks of the bot) into $LAND_STATES (~/fls-land-states); built when its manifest.json is
#           missing, or always with `states`.
# captures  scripts/landCaptures.ts → $out/captures (shots, contact.jpg, shots.json); LANDUI_ONLY=fen_drainage,works,…
#           picks rows, LANDUI_BEFORE=1 shoots every view on the base build too.
# perf      the land cities (scripts/renderFixtureStates.ts LAND_CITIES, built once into $out/perf/cities.json) in
#           scripts/renderStageBenchmark.mjs, each cell on this build and then the base (LANDUI_PERF_CELLS, default the five
#           at dpr 1 still; LANDUI_PERF_ROUNDS=3), folded by scripts/remote/perf-baseline.mjs → $out/perf/compare.md
#           (DGX vs DGX, same run: frameWork p95 this / base).
# all       the three. $out is LANDUI_OUT (default .remote/landui: back in .remote-runs/<run>/, not the tree). Each step
#           runs even when one fails; the exit codes are in $out/gates/landui-exit-codes.txt.
set -u
mode=${1:-all}
out=${LANDUI_OUT:-.remote/landui}
lands=${LAND_STATES:-$HOME/fls-land-states}
mkdir -p "$out/gates" "$lands"
declare -a results=()
step() { local name=$1; shift; local start; start=$(date +%s); "$@" > "$out/gates/$name.log" 2>&1; local code=$?
  results+=("$name=$code"); echo "$name exit $code ($(( $(date +%s) - start ))s)"; }
case "$mode" in states|captures|perf|all) ;; *) echo "unknown mode $mode (states|captures|perf|all)" >&2; exit 2 ;; esac

if [ "$mode" = states ] || [ ! -f "$lands/manifest.json" ]; then
  step states npx tsx scripts/landStates.ts "$lands" "${LANDUI_TICKS:-30000}"
fi
if [ "$mode" = captures ] || [ "$mode" = all ]; then
  step captures npx tsx scripts/landCaptures.ts "$out/captures" --url "$URL" --states "$lands" \
    ${LANDUI_ONLY:+--only "$LANDUI_ONLY"} ${LANDUI_BEFORE:+--base "$BASE_URL"}
fi
if [ "$mode" = perf ] || [ "$mode" = all ]; then
  cells=${LANDUI_PERF_CELLS:-coastal_port:1:still,chalk_downs:1:still,forest_edge:1:still,fen_drainage:1:still,fen_works:1:still}
  mkdir -p "$out/perf/this" "$out/perf/base"
  cities=$(printf '%s\n' ${cells//,/ } | cut -d: -f1 | sort -u | paste -sd, -)
  step perf-cities sh -c "npx tsx scripts/renderFixtureStates.ts --cities $cities > $out/perf/cities.json"
  for cell in ${cells//,/ }; do
    IFS=: read -r city dpr camera <<< "$cell"
    for side in this base; do
      if [ $side = this ]; then build=$URL; else build=$BASE_URL; fi
      step "perf-$city-$dpr-$camera-$side" node scripts/renderStageBenchmark.mjs --output "$out/perf/$side" --url "$build" --states "$out/perf/cities.json" \
        --city "$city" --dpr "$dpr" --camera "$camera" --rounds "${LANDUI_PERF_ROUNDS:-3}" --trace false
    done
  done
  step perf-base node scripts/remote/perf-baseline.mjs --raw "$out/perf/base" --out "$out/perf/base.json" --report "$out/perf/base.md"
  step perf-compare node scripts/remote/perf-baseline.mjs --raw "$out/perf/this" --out "$out/perf/this.json" --compare "$out/perf/base.json" --report "$out/perf/compare.md"
  cat "$out/perf/compare.md" 2>/dev/null
fi
printf '%s\n' "${results[@]}" | tee "$out/gates/landui-exit-codes.txt"
