#!/usr/bin/env bash
# UX-0b method ⑤ on the DGX: each audit's desktop script replayed by touch at 1180×820, before (the trunk, $BASE_URL)
# and after the fixes (this build, $URL):
#   scripts/remote/run.sh ux0b-touch -- bash scripts/remote/with-base-build.sh <trunk-sha> -- bash scripts/coldStartTouchVerification.sh
set -u
out=docs/verification/ux0b
node scripts/coldStartTouchReplay.mjs "$out/audit/desktop-actions.jsonl" "$out/touch-before" --url "$BASE_URL" > "$out/touch-before.log" 2>&1; echo "touch-before exit $?"
node scripts/coldStartTouchReplay.mjs "$out/audit/desktop-actions-after.jsonl" "$out/touch-after" --url "$URL" > "$out/touch-after.log" 2>&1; echo "touch-after exit $?"
