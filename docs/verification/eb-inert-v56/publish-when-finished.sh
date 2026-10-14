#!/usr/bin/env bash
set -euo pipefail
source_checkout=/Users/rexxa/fls-astra-engineB-v56
publish_checkout=/Users/rexxa/fls-astra-engineB-v56-publish
host=${FLS_REMOTE_HOST:-hyunlord@100.70.109.50}
run=engineB-V56-inert-d4c9249
cd "$publish_checkout"
expected=$(git rev-parse HEAD)
test -z "$(git status --porcelain)"
remote_path=''
while [ -z "$remote_path" ]; do
  remote_path=$(ssh -o BatchMode=yes -o ConnectTimeout=15 "$host" 'for base in /home/hyunlord/fls-runs /home/hyunlord/fls-runs/_kept; do if [ -f "$base/engineB-V56-inert-d4c9249/.remote/exit-code" ]; then echo "$base/engineB-V56-inert-d4c9249/.remote/"; break; fi; done') || remote_path=''
  [ -n "$remote_path" ] || sleep 60
done
stage="$publish_checkout/.remote-runs/$run"
mkdir -p "$stage"
rsync -a -e 'ssh -o BatchMode=yes -o ConnectTimeout=15' "$host:$remote_path" "$stage/"
test "$(git rev-parse HEAD)" = "$expected"
test -z "$(git status --porcelain)"
cd "$source_checkout"
node "$publish_checkout/docs/verification/eb-inert-v56/archive.mjs" "$stage/eb-inert-125" \
  "$publish_checkout/docs/verification/eb-inert-v56/official-125" d4c924986f1755c398ec30e643a3864e358ad233
cd "$publish_checkout"
node --input-type=module - <<'JS'
import { readFileSync, writeFileSync } from 'node:fs';
const base = 'docs/verification/eb-inert-v56/official-125';
const c = JSON.parse(readFileSync(`${base}/comparison.json`));
const report = `# v56 INERT 통합 판정\n\n관문: **${c.gate.pass ? 'PASS' : 'FAIL'}**\n\n`;
writeFileSync('docs/requests/engine-B-v56-result.md', report + readFileSync(`${base}/README.md`, 'utf8') +
  '\n청원별 전후 및 선례 대체 답 증거: `docs/verification/eb-inert-v56/official-125/petition-comparison.json`.\n\nTRACE-LINK 네 시험의 소스 판정: `docs/requests/engine-B-v56-four-tests.md`. 네 시험의 별도 실행 결과는 해당 실행이 끝난 뒤 판단한다.\n');
JS
git diff --check
git add docs/verification/eb-inert-v56/official-125 docs/requests/engine-B-v56-result.md
git commit -m 'Deliver verified v56 INERT results for engine review' -m 'Retain pass or fail, raw source provenance and petition substitution evidence.' -m 'Tested: Original/replay and source hashes checked; cohort gate independently recomputed from retained answers.
Constraint: Publish only codex/engine-b-v56-pins; trunk remains engine-owned.'
git push origin HEAD:refs/heads/codex/engine-b-v56-pins || true
published=$(git ls-remote --heads origin codex/engine-b-v56-pins | cut -f1)
test "$published" = "$(git rev-parse HEAD)"
printf 'Published verified INERT artifacts: %s\n' "$published"
