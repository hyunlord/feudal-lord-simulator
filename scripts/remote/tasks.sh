#!/usr/bin/env bash
# Named remote tasks (REMOTE-1). Runs on the DGX inside the run folder, under remote-exec.sh (scope, node_modules,
# port, Chromium already prepared). Everything a task writes for the Mac goes to .remote/ (comes back to
# .remote-runs/<run>/) or, for committed evidence, to docs/ seeds/ perf/ output/ fixtures/ (comes back into the tree).
#
#   test         [--typecheck]                              full regression: npm test (all tests/*.test.ts)
#   guardrail    [--seeds 1,2,3,4,5] [--ticks 1200000] [--lots 24] [--checkpoint]
#                                                            seeds in parallel: scripts/efficientGrowthRun.ts per seed
#   browser      [--repeat 10] [test files ...]              browser tests N times in a row (default: Part7 proof)
#   perf         [--cells lots24:1:still,...] [--rounds 3] [--baseline perf/baseline-dgx-<sha>.json]
#                without --baseline: records perf/baseline-dgx-<sha>.json; with it: compares p95 (DGX vs DGX only)
#   clone-check                                              fresh clone of the commit (+LFS), npm ci, typecheck, test, build
set -uo pipefail
TASK=${1:?task}; shift
OUT=$PWD/.remote
mkdir -p "$OUT"

summarise_tap() {  # node --test totals as one line: TAP ("# pass 12", Node 20) or spec ("ℹ pass 12", Node 23+)
  grep -E '^(#|ℹ) (tests|pass|fail|cancelled|skipped|todo|duration_ms) ' "$1" | awk '{printf "%s=%s ", $2, $3} END {print ""}'
}

case "$TASK" in
test)
  rc=0
  if [ "${1:-}" = --typecheck ]; then
    npm run -s typecheck > "$OUT/typecheck.log" 2>&1; rc=$?
    echo "typecheck exit $rc"; [ $rc = 0 ] || tail -30 "$OUT/typecheck.log"
  fi
  npm test > "$OUT/test.log" 2>&1; test_rc=$?
  summary=$(summarise_tap "$OUT/test.log")
  echo "npm test exit $test_rc: $summary" | tee "$OUT/summary.txt"
  if [ $test_rc != 0 ]; then
    grep -E '^(not ok |✖ )' "$OUT/test.log" | head -40 | tee -a "$OUT/summary.txt"
  fi
  [ $rc = 0 ] && rc=$test_rc
  exit $rc
  ;;

guardrail)
  seeds=1,2,3,4,5; ticks=1200000; lots=24; checkpoint=""
  while [ $# -gt 0 ]; do
    case "$1" in
      --seeds) seeds=$2; shift 2 ;; --ticks) ticks=$2; shift 2 ;; --lots) lots=$2; shift 2 ;;
      --checkpoint) checkpoint=--checkpoint; shift ;;
      *) echo "unknown guardrail option $1" >&2; exit 2 ;;
    esac
  done
  mkdir -p "$OUT/guardrail"
  pids=()
  for seed in ${seeds//,/ }; do
    rm -rf "$OUT/guardrail/seed-$seed"
    echo "seed $seed: efficientGrowthRun.ts $lots $ticks seed $seed $checkpoint"
    ( start=$(date +%s)
      node_modules/.bin/tsx scripts/efficientGrowthRun.ts "$lots" "$ticks" "$OUT/guardrail/seed-$seed" "$seed" $checkpoint \
        > "$OUT/guardrail/seed-$seed.log" 2>&1
      rc=$?; echo "$rc $(( $(date +%s) - start ))" > "$OUT/guardrail/seed-$seed.exit" ) &
    pids+=($!)
  done
  wait "${pids[@]}"
  node -e '
    const fs = require("fs"); const dir = process.argv[1]; const rows = [];
    for (const seed of process.argv[2].split(",")) {
      const [exit, seconds] = fs.readFileSync(`${dir}/seed-${seed}.exit`, "utf8").trim().split(" ").map(Number);
      let s = null; try { s = JSON.parse(fs.readFileSync(`${dir}/seed-${seed}/summary.json`, "utf8")); } catch {}
      rows.push({ seed: Number(seed), exit, seconds, stopReason: s?.stopReason ?? null, tick: s?.final?.tick ?? null, maxTicks: s?.maxTicks ?? null,
        simulationPassed: s?.simulationPassed ?? null, guardrail: s?.guardrail?.status ?? null,
        checks: s?.guardrail?.checks ?? null, finalStateSha256: s?.finalStateSha256 ?? null });
    }
    fs.writeFileSync(`${dir}/summary.json`, JSON.stringify(rows, null, 2) + "\n");
    for (const r of rows) console.log(`seed ${r.seed}: exit ${r.exit} ${r.seconds}s stop=${r.stopReason} tick=${r.tick} guardrail=${r.guardrail}` +
      (r.maxTicks !== null && r.maxTicks < 1200000 ? " (short run: the verdict compares with full 1,200,000-tick baselines and is not a gate result)" : ""));
    process.exit(rows.every(r => r.exit === 0) ? 0 : 1);
  ' "$OUT/guardrail" "$seeds"
  ;;

browser)
  repeat=10; files=()
  while [ $# -gt 0 ]; do
    case "$1" in --repeat) repeat=$2; shift 2 ;; *) files+=("$1"); shift ;; esac
  done
  [ ${#files[@]} -gt 0 ] || files=(tests/phase13Part7BrowserProof.test.ts)
  mkdir -p "$OUT/browser"
  pass=0; streak=0; best=0
  : > "$OUT/browser/iterations.tsv"
  for i in $(seq 1 "$repeat"); do
    start=$(date +%s.%N)
    CHROME_PATH=${CHROME_PATH:-$FLS_CHROMIUM_PATH} node_modules/.bin/tsx --test "${files[@]}" > "$OUT/browser/iter-$i.log" 2>&1; rc=$?
    secs=$(awk -v now="$(date +%s.%N)" -v start="$start" 'BEGIN { printf "%.1f", now - start }')
    if [ $rc = 0 ]; then pass=$((pass + 1)); streak=$((streak + 1)); else streak=0; fi
    [ $streak -gt $best ] && best=$streak
    printf '%s\t%s\t%s\t%s\n' "$i" "$rc" "$secs" "$(summarise_tap "$OUT/browser/iter-$i.log")" | tee -a "$OUT/browser/iterations.tsv"
  done
  echo "browser: ${files[*]} passed $pass/$repeat, longest consecutive pass run $best" | tee "$OUT/summary.txt"
  [ $pass = "$repeat" ]
  ;;

perf)
  cells=lots24:1:still,lots24:1:drag,lots24:2:still,pop176:1:still,newgame:1:still; rounds=3; baseline=""
  while [ $# -gt 0 ]; do
    case "$1" in
      --cells) cells=$2; shift 2 ;; --rounds) rounds=$2; shift 2 ;; --baseline) baseline=$2; shift 2 ;;
      *) echo "unknown perf option $1" >&2; exit 2 ;;
    esac
  done
  raw=.remote/perf/raw; rm -rf "$OUT/perf"; mkdir -p "$raw"
  node_modules/.bin/vite --host 127.0.0.1 --port "$FLS_REMOTE_PORT" --strictPort > "$OUT/perf/vite.log" 2>&1 &
  vite=$!
  trap 'kill $vite 2>/dev/null' EXIT
  url="http://127.0.0.1:$FLS_REMOTE_PORT/"
  for _ in $(seq 1 60); do curl -sf "$url" > /dev/null && break; sleep 1; done
  curl -sf "$url" > /dev/null || { echo "vite did not come up on $url"; cat "$OUT/perf/vite.log"; exit 1; }
  rc=0
  for cell in ${cells//,/ }; do
    IFS=: read -r city dpr camera <<< "$cell"
    echo "perf cell $city dpr$dpr $camera"
    node scripts/renderStageBenchmark.mjs --output "$raw" --url "$url" --city "$city" --dpr "$dpr" --camera "$camera" \
      --rounds "$rounds" --trace false >> "$OUT/perf/benchmark.log" 2>&1 || { rc=1; echo "  failed (see perf/benchmark.log)"; }
  done
  if [ -n "$baseline" ]; then
    node scripts/remote/perf-baseline.mjs --raw "$raw" --out "$OUT/perf/current.json" --compare "$baseline" --report "$OUT/perf/compare.md" || rc=1
    cat "$OUT/perf/compare.md"
  else
    node scripts/remote/perf-baseline.mjs --raw "$raw" --out "perf/baseline-dgx-$SHORT_SHA.json" --report "$OUT/perf/summary.md" || rc=1
    cat "$OUT/perf/summary.md"
  fi
  exit $rc
  ;;

clone-check)
  base=$HOME/fls-runs/_clones; mkdir -p "$base"
  dir="$base/$FLS_REMOTE_RUN"; rm -rf "$dir"
  trap 'rm -rf "$dir"' EXIT
  [ "$DIRTY" = 1 ] && echo "note: the Mac tree has uncommitted changes; clone-check verifies commit $SHORT_SHA only"
  step() { local name=$1; shift; local start; start=$(date +%s)
    "$@" > "$OUT/clone-$name.log" 2>&1; local rc=$?
    echo "$name: exit $rc ($(( $(date +%s) - start ))s)" | tee -a "$OUT/summary.txt"
    [ $rc = 0 ] || { tail -40 "$OUT/clone-$name.log"; exit $rc; }; }
  : > "$OUT/summary.txt"
  # The commit comes from the DGX mirror (refs/remote-runs/<run>, which holds unpushed commits too); LFS files come
  # from GitHub, so LFS objects must be pushed.
  step clone sh -c "git init -q '$dir' && cd '$dir' && git fetch -q '$FLS_REMOTE_MIRROR' 'refs/remote-runs/$FLS_REMOTE_RUN' \
    && git checkout -q FETCH_HEAD && git remote add origin https://github.com/hyunlord/feudal-lord-simulator \
    && git config lfs.url https://github.com/hyunlord/feudal-lord-simulator.git/info/lfs \
    && git lfs install --local >/dev/null && git lfs pull \
    && test \"\$(git rev-parse HEAD)\" = '$FLS_REMOTE_COMMIT'"
  cd "$dir" || exit 2
  step npm-ci npm ci --no-audit --no-fund --loglevel=error
  step typecheck npm run -s typecheck
  step test npm test
  echo "test: $(summarise_tap "$OUT/clone-test.log")" | tee -a "$OUT/summary.txt"
  step build npm run -s build
  echo "clone-check $SHORT_SHA: passed" | tee -a "$OUT/summary.txt"
  ;;

*) echo "unknown task $TASK" >&2; exit 2 ;;
esac
