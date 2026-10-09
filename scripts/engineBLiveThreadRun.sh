#!/usr/bin/env bash
# Controlled follow-up: original terminal failure preserved; diagnostic product baseline c5d2b35.
set -euo pipefail
[ "$(uname -s)" = Linux ]
[ "$(node --version)" = v24.21.0 ]
: "${FLS_REMOTE_PORT:?Remote runner port required}"
: "${EB_BROWSER_REVISION:?Clean committed tool revision required}"
: "${EB_HISTORICAL_MANIFEST_SHA256:?Externally verified completed historical manifest SHA required}"
: "${PLAYWRIGHT_MODULE:?Runner shim required}"
: "${FLS_PLAYWRIGHT_CORE:?Runner backing Playwright required}"
: "${FLS_CHROMIUM_PATH:?Runner Chromium required}"
grep -q '^SLOT=heavy$' .remote-in/meta.env
grep -q '^RUN_CLASS=experiment$' .remote-in/meta.env
[[ "$EB_BROWSER_REVISION" =~ ^[a-f0-9]{40}$ ]]
[[ "$EB_HISTORICAL_MANIFEST_SHA256" =~ ^[a-f0-9]{64}$ ]]
[[ "$FLS_REMOTE_PORT" =~ ^[0-9]+$ ]]
[ "$(git rev-parse HEAD)" = "$EB_BROWSER_REVISION" ]
[ -z "$(git status --porcelain)" ]
LIVE_SPEED_PREVIOUS=/home/hyunlord/fls-runs/engineB-live-thread-a51965f
if [ ! -d "$LIVE_SPEED_PREVIOUS" ]; then LIVE_SPEED_PREVIOUS=/home/hyunlord/fls-runs/_kept/engineB-live-thread-a51965f; fi
[ "$(cat "$LIVE_SPEED_PREVIOUS/.remote/exit-code")" = 1 ]
[ "$(systemctl --user show fls-run-engineB-live-thread-a51965f-1791522045.scope -p ActiveState --value)" = inactive ]
[ "$(sha256sum "$LIVE_SPEED_PREVIOUS/.remote/eb-live-speed/manifest.json" | cut -d ' ' -f 1)" = a8f9164f5294eb27bf8695f62ad7e7f38e4b249f6b7dfa81bce23e8316c1d8c1 ]
git diff --exit-code c5d2b35341dfb9c1a496d3f7bda532bf7e2d4fb8 HEAD -- src package.json package-lock.json
LIVE_SPEED_ROOT=$(pwd -P)
case "$LIVE_SPEED_ROOT" in /home/hyunlord/fls-runs/*) ;; *) exit 2;; esac
[ "$PLAYWRIGHT_MODULE" = "$LIVE_SPEED_ROOT/scripts/remote/playwright-chrome-shim.mjs" ]
[ "$FLS_PLAYWRIGHT_CORE" = /home/hyunlord/fls-runs/_tools/node_modules/playwright-core/index.mjs ]
[ -f "$PLAYWRIGHT_MODULE" ] && [ -f "$FLS_PLAYWRIGHT_CORE" ] && [ -x "$FLS_CHROMIUM_PATH" ]
export EB_PLAYWRIGHT_VERSION=1.62.1
[ "$(node -p 'JSON.parse(require("fs").readFileSync(require("path").join(require("path").dirname(process.env.FLS_PLAYWRIGHT_CORE),"package.json"))).version')" = "$EB_PLAYWRIGHT_VERSION" ]
LIVE_SPEED_HISTORICAL=/home/hyunlord/fls-runs/engineB-historical-null-27599bd
if [ ! -d "$LIVE_SPEED_HISTORICAL" ]; then LIVE_SPEED_HISTORICAL=/home/hyunlord/fls-runs/_kept/engineB-historical-null-27599bd; fi
[ "$(cat "$LIVE_SPEED_HISTORICAL/.remote/exit-code")" = 0 ]
[ "$(sha256sum "$LIVE_SPEED_HISTORICAL/.remote/eb-historical-56ee1d9/replay-manifest.json" | cut -d ' ' -f 1)" = "$EB_HISTORICAL_MANIFEST_SHA256" ]
[ "$(systemctl --user show fls-run-engineB-historical-null-27599bd-1791514801.scope -p ActiveState --value)" = inactive ]
LIVE_SPEED_ORIGINAL=/home/hyunlord/fls-runs/engineB-weight125-kept-clean-2485af4
if [ ! -d "$LIVE_SPEED_ORIGINAL" ]; then LIVE_SPEED_ORIGINAL=/home/hyunlord/fls-runs/_kept/engineB-weight125-kept-clean-2485af4; fi
[ "$(cat "$LIVE_SPEED_ORIGINAL/.remote/exit-code")" = 0 ]
LIVE_SPEED_CHECKPOINTS="$LIVE_SPEED_ORIGINAL/.remote/eb-weight-kept/checkpoints/seed-1"
LIVE_SPEED_MANIFEST=e4615d5a01c18d7b6adba9f3eec12c570f0ab14041266e947305674c04e2b93d
[ "$(sha256sum "$LIVE_SPEED_CHECKPOINTS/manifest.json" | cut -d ' ' -f 1)" = "$LIVE_SPEED_MANIFEST" ]
LIVE_SPEED_OUTPUT="$LIVE_SPEED_ROOT/.remote/eb-live-speed"
[ ! -e "$LIVE_SPEED_OUTPUT" ]
node_modules/.bin/tsx scripts/engineBLiveSpeedCapture.mjs \
 "$LIVE_SPEED_CHECKPOINTS" "$LIVE_SPEED_MANIFEST" "$LIVE_SPEED_OUTPUT" \
 "http://127.0.0.1:$FLS_REMOTE_PORT/" "$EB_BROWSER_REVISION"
