#!/usr/bin/env bash
# Named remote tasks (REMOTE-1). Runs on the DGX inside the run folder, under remote-exec.sh (scope, node_modules,
# port, Chromium already prepared). Everything a task writes for the Mac goes to .remote/ (comes back to
# .remote-runs/<run>/) or, for committed evidence, to docs/ seeds/ perf/ output/ fixtures/ (comes back into the tree).
#
#   test         [--typecheck]                              full regression: npm test (all tests/*.test.ts)
#   guardrail    [--seeds 1,2,3,4,5] [--ticks 1200000] [--lots 24] [--checkpoint]
#                                                            seeds in parallel: scripts/efficientGrowthRun.ts per seed,
#                                                            and beside them the human path (tests/humanPath*.test.ts,
#                                                            command replay, no bot: CODE-1a) — a failure fails the run
#   browser      [--repeat 10] [test files ...]              browser tests N times in a row (default: Part7 proof)
#   perf         [--cells lots24:1:still,...] [--rounds 3] [--baseline perf/baseline-dgx-<sha>.json]
#                without --baseline: records perf/baseline-dgx-<sha>.json; with it: compares p95 (DGX vs DGX only)
#   ui-geometry  [audit args: --only id,prefix. --viewports … --copy … --numbers … --jobs 4]
#                UI-AUDIT-1 geometry audit (scripts/uiGeometryAudit.mjs) against the dev server (?pseudo-long=1 is a
#                dev-server transform) and the cached UI state folders: docs/verification/uiaudit1/geometry/<run>/ and
#                the committed summary docs/verification/uiaudit1/geometry.json come back into the tree
#   clone-check                                              fresh clone of the commit (+LFS), npm ci, typecheck, test, build
#   trend        [--commits sha,...] [--rounds 3] [--seconds 45]
#                                                            per-commit noise-resistant metrics (scripts/perf/trendRun.ts)
#                                                            into ~/fls-runs/_trend/<sha>.json and .remote/trend/
set -uo pipefail
TASK=${1:?task}; shift
OUT=$PWD/.remote
mkdir -p "$OUT"

summarise_tap() {  # node --test totals as one line: TAP ("# pass 12", Node 20) or spec ("ℹ pass 12", Node 23+)
  grep -E '^(#|ℹ) (tests|pass|fail|cancelled|skipped|todo|duration_ms) ' "$1" | awk '{printf "%s=%s ", $2, $3} END {print ""}'
}

case "$TASK" in
trend)
  # Trend runs are not --keep runs, so the prune takes their folders after ten newer runs; the results are in
  # ~/fls-runs/_trend/ and the log is copied to _trend/logs/ (folders starting with "_" are never pruned).
  node_modules/.bin/tsx scripts/perf/trendRun.ts "$@" 2>&1 | tee "$OUT/trend.log"
  rc=${PIPESTATUS[0]}
  mkdir -p "$HOME/fls-runs/_trend/logs" && cp "$OUT/trend.log" "$HOME/fls-runs/_trend/logs/$FLS_REMOTE_RUN.log"
  exit "$rc"
  ;;

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
  # CODE-1a: a person's path by commands (chapter 1 lives and fills its plots; a barn to barley and the first ale).
  echo "human path: tests/humanPath*.test.ts"
  ( start=$(date +%s)
    node_modules/.bin/tsx --test tests/humanPath*.test.ts > "$OUT/guardrail/human-path.log" 2>&1
    rc=$?; echo "$rc $(( $(date +%s) - start ))" > "$OUT/guardrail/human-path.exit"
    echo "$(summarise_tap "$OUT/guardrail/human-path.log")" > "$OUT/guardrail/human-path.txt" ) &
  pids+=($!)
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
    const [humanExit, humanSeconds] = fs.readFileSync(`${dir}/human-path.exit`, "utf8").trim().split(" ").map(Number);
    const humanTotals = fs.readFileSync(`${dir}/human-path.txt`, "utf8").trim();
    fs.writeFileSync(`${dir}/human-path.json`, JSON.stringify({ exit: humanExit, seconds: humanSeconds, totals: humanTotals }, null, 2) + "\n");
    console.log(`human path: exit ${humanExit} ${humanSeconds}s ${humanTotals}`);
    process.exit(rows.every(r => r.exit === 0) && humanExit === 0 ? 0 : 1);
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
  . scripts/remote/devServers.sh   # the server stops on any exit, failures and a stopped run included
  fls_serve "$OUT/perf/vite.log" --host 127.0.0.1 --port "$FLS_REMOTE_PORT" --strictPort
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

ui-geometry)
  mkdir -p "$OUT/ui-geometry"
  states5=${UI5_STATES:-$HOME/fls-ui5-states-v22}; states6=${UI6_STATES:-$HOME/fls-ui6-states}; states8=${UI8_STATES:-$HOME/fls-ui8-states}
  states9=${UI9_STATES:-$HOME/fls-ui9-states}; states10=${UI10_STATES:-$HOME/fls-ui10-states}; extra=$states10/extra
  lands=${LAND_STATES:-$HOME/fls-land-states}
  petitions=${LMR1_PETITION_STATES:-$HOME/fls-lmr1-petition-states}
  lord=${LORD_STATES:-$HOME/fls-lord-states}
  # The registry's scenes (src/ui/surfaces.registry.ts) read these; each folder is built by its scripts/ui*States.ts.
  missing=""
  for f in "$states5/merchant-town.json" "$states5/carrying.json" "$states5/famine-arrival.json" "$states5/petition-open.json" "$states5/chapter-end.json" \
    "$states6/wool_payment.json" "$states6/decline.json" "$states6/chapter2-end.json" "$states8/chapter3-end.json" \
    "$states9/reorg.alehouse_boom.json" "$states9/chapter4-end.json" "$states9/borough_charter.json" "$states9/rumour-chased.json" "$states9/reorg.wage_competition.json" \
    "$states10/chapter5-end.json" "$states10/borough_autonomy.json" "$extra/heir_choice.json" "$lands/fen_drainage-summer.json" \
    "$petitions/home-boundary_dispute.json" "$petitions/precedent.json" "$petitions/request.json" "$petitions/guardian.json" "$lord/lord-receipts.json" \
    "$lord/registry-offer.json"; do
    [ -f "$f" ] || missing="$missing $f"
  done
  if [ -n "$missing" ]; then
    echo "ui-geometry: state files missing:$missing (build them with scripts/ui5States.ts, ui6States.ts, ui8States.ts, ui9States.ts, ui10States.ts, ui10ExtraStates.ts, landStates.ts, lmr1PetitionStates.ts, lmr1LordStates.ts, eventArtStates.ts)" | tee "$OUT/summary.txt"
    exit 2
  fi
  # No file watching (scripts/remote/viteNoWatch.config.ts): the audit needs the dev transforms, not hot reload, and a
  # watched run folder takes thousands of the DGX's shared inotify watches. The server goes with the task on any exit.
  . scripts/remote/devServers.sh
  fls_serve "$OUT/ui-geometry/vite.log" --config scripts/remote/viteNoWatch.config.ts --host 127.0.0.1 --port "$FLS_REMOTE_PORT" --strictPort
  url="http://127.0.0.1:$FLS_REMOTE_PORT/"
  for _ in $(seq 1 60); do curl -sf "$url" > /dev/null && break; sleep 1; done
  curl -sf "$url" > /dev/null || { echo "vite did not come up on $url"; cat "$OUT/ui-geometry/vite.log"; exit 1; }
  out=docs/verification/uiaudit1/geometry/$FLS_REMOTE_RUN
  node_modules/.bin/tsx scripts/uiGeometryAudit.mjs "$out" --url "$url" --states5 "$states5" --states6 "$states6" --states8 "$states8" \
    --states9 "$states9" --states10 "$states10" --extra "$extra" --states-lands "$lands" --states-petitions "$petitions" --states-lord "$lord" "$@" > "$OUT/ui-geometry/audit.log" 2>&1
  rc=$?
  tail -n 3 "$OUT/ui-geometry/audit.log" | tee "$OUT/summary.txt"
  [ -f "$out/geometry.md" ] && sed -n '1,4p' "$out/geometry.md" | tee -a "$OUT/summary.txt"
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
