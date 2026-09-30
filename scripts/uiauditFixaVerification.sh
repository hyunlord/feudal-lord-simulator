#!/usr/bin/env bash
# UI-AUDIT-1 fix group A on the DGX, this build beside the base before it (the base worktree outside the run folder, as
# scripts/uiauditTokensVerification.sh):
#   scripts/remote/run.sh render-UIAUDIT-fixa-<sha7> -- bash scripts/uiauditFixaVerification.sh <base-sha> hud|shots
# hud: the HUD area measure (scripts/measureHudCoverage.ts) of both builds; hud-shots: this build's with its masks
# (.remote/hud-shots); exec <command…>: that command with URL and BASE_URL set; shots: scripts/uiauditFixaCaptures.mjs.
set -u
base_sha=${1:?base sha}
what=${2:?hud or shots}
port=${FLS_REMOTE_PORT:?run through scripts/remote/run.sh}
base_port=$((port + 50))
dir=${TMPDIR:-/tmp}/fls-base-$port
out=docs/verification/uiaudit1/fixa
mkdir -p "$out"
git worktree remove --force "$dir" 2>/dev/null || true
git worktree add -q --detach "$dir" "$base_sha"
ln -sfn "$PWD/node_modules" "$dir/node_modules"
# No file watcher (scripts/viteNoWatch.config.ts): the base serves its own tree with its own config.
cp scripts/viteNoWatch.config.ts "$dir/scripts/viteNoWatch.config.ts"
node_modules/.bin/vite --config scripts/viteNoWatch.config.ts --host 127.0.0.1 --port "$port" --strictPort > .remote/vite-this.log 2>&1 &
this=$!
(cd "$dir" && exec node_modules/.bin/vite --config scripts/viteNoWatch.config.ts --host 127.0.0.1 --port "$base_port" --strictPort) > .remote/vite-base.log 2>&1 &
base=$!
trap 'kill $this $base 2>/dev/null; git worktree remove --force "$dir" 2>/dev/null || true' EXIT
export URL="http://127.0.0.1:$port/" BASE_URL="http://127.0.0.1:$base_port/"
for url in "$URL" "$BASE_URL"; do
  for _ in $(seq 1 90); do curl -sf "$url" > /dev/null && break; sleep 1; done
  curl -sf "$url" > /dev/null || { echo "vite did not come up on $url"; exit 1; }
done
echo "this $URL · base $BASE_URL ($base_sha)"
case "$what" in
  hud)
    # FIXA_HUD_ORDER=before-first measures the base first (the ch2 wall town's season card opens about a second after
    # load, so which build loads first can decide whether the measure's dismissal catches it).
    if [ "${FIXA_HUD_ORDER:-}" = "before-first" ]; then
      npx tsx scripts/measureHudCoverage.ts "$out/hud-coverage-before.json" --url "$BASE_URL" > .remote/hud-before.log 2>&1; echo "before exit $?"
    fi
    npx tsx scripts/measureHudCoverage.ts "$out/hud-coverage-after.json" --url "$URL" > .remote/hud-after.log 2>&1; echo "after exit $?"
    [ "${FIXA_HUD_ORDER:-}" = "before-first" ] || { npx tsx scripts/measureHudCoverage.ts "$out/hud-coverage-before.json" --url "$BASE_URL" > .remote/hud-before.log 2>&1; echo "before exit $?"; }
    ;;
  hud-shots)
    npx tsx scripts/measureHudCoverage.ts .remote/hud-coverage-shots.json --url "$URL" --shots .remote/hud-shots > .remote/hud-shots.log 2>&1; echo "exit $?"
    ;;
  cards) FIXA_CARDS_ONLY=1 node scripts/uiauditFixaCaptures.mjs "$out" --url "$URL" --base "$BASE_URL" --states "${UI5_STATES:-$HOME/fls-ui5-states-v22}" --states9 "$HOME/fls-ui9-states" ;;
  shots) node scripts/uiauditFixaCaptures.mjs "$out" --url "$URL" --base "$BASE_URL" --states "${UI5_STATES:-$HOME/fls-ui5-states-v22}" --states9 "$HOME/fls-ui9-states" ;;
  exec) shift 2; "$@" ;;
  *) echo "unknown: $what"; exit 2 ;;
esac
