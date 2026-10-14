#!/usr/bin/env bash
set -euo pipefail
node --import tsx --test tests/engineBInertMeasurement.test.ts
set +e
node --max-old-space-size=12288 --import tsx scripts/engineBInertRun.mjs --experiment \
  .remote/eb-inert-125 "$FULL_SHA" docs/design/engine-B-outcomes.json \
  docs/verification/eb-tlink-four-categories/official-71bc336/report.json.gz \
  5519e0d87775f5c48dd3629f36b676cdc49d7e4c35b32a1f5f4459bc03d14d33
score_exit=$?
set -e
printf '%s\n' "$score_exit" > .remote/v56-score-exit-code
if [ -f .remote/eb-inert-125/categories.json ]; then
  node docs/verification/eb-inert-v56/frequency.mjs .remote/eb-inert-125
fi
exit "$score_exit"
