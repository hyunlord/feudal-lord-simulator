#!/usr/bin/env bash
# Self-test of the merge checks (REVIEW-1): bash scripts/checks/selfTest.sh
# In a throwaway repository with this checkout's scripts/checks, scripts/git-hooks and tools/eslint, pushes to the
# trunk are refused for each violation kind (pin without decision, lint exception without "// why:", native control
# in src/ui, type error, inbox ledger replaced_by that is not a ledger row, a simulation folder importing src/ui,
# a new Korean string outside *.ko.ts, a new ledger row with another row's sha256 and no canonical mark or a mark
# naming other bytes, an inbox image without a ledger row or a row whose image moved away) and pass for their fixed
# versions, ordinary changes and work branches.
# Needs npm ci here.
set -u
REPO=$(cd "$(dirname "$0")/../.." && pwd)
T=$(mktemp -d /tmp/fls-review1-gate.XXXXXX)
TRUNK=codex/phase15-organic-ground
cd "$T" && git init -q --bare remote.git && git init -q -b "$TRUNK" work && cd work
git config user.email gate@test; git config user.name gate
mkdir -p scripts tools/eslint src/ui/kit src/engine seeds docs/decisions tests assets-inbox
cp -R "$REPO/scripts/checks" "$REPO/scripts/git-hooks" scripts/
cp "$REPO"/tools/eslint/{package.json,package-lock.json,eslint.config.mjs,uiControls.mjs,layers.mjs} tools/eslint/
echo '{}' > tools/eslint/eslint-suppressions.json
echo '{"exceptions":[]}' > scripts/checks/lint-exceptions-baseline.json
echo '{"files":{}}' > scripts/checks/korean-strings-baseline.json
printf 'export const answer = 42;\n' > src/engine/answer.ts
ln -s "$REPO/node_modules" node_modules
printf 'node_modules\n' > .gitignore
cat > tsconfig.json <<'J'
{ "compilerOptions": { "jsx": "react-jsx", "strict": true, "noEmit": true, "module": "esnext", "moduleResolution": "bundler", "target": "es2022", "skipLibCheck": true, "types": [] }, "include": ["src"] }
J
cat > src/ui/kit/Button.tsx <<'J'
export function Button(props: { label: string }) { return <button type="button">{props.label}</button>; }
J
cat > src/ui/Panel.tsx <<'J'
import { Button } from "./kit/Button";
export function Panel() { return <div><Button label="ok" /></div>; }
J
echo '{"seed":1,"tick":1000}' > seeds/baseline-a.json
printf '# 결정 목록\n\n| 번호 | 제목 |\n|---|---|\n' > docs/decisions/README.md
cat > tests/pin.test.ts <<'J'
export const PINNED = "0123456789abcdef0123456789abcdef";
J
printf 'wave,file,sha256,status,replaced_by,verdict_note,installed_by\r\nw1,w1/a-v1.png,00,superseded,w1/a-v2.png,"old, first",\r\nw1,w1/a-v2.png,11,confirmed,,,\r\n' > assets-inbox/INBOX_LEDGER.csv
img() { for f in "$@"; do mkdir -p "assets-inbox/$(dirname "$f")"; printf 'png %s\n' "$f" > "assets-inbox/$f"; done; }   # one image per ledger row
img w1/a-v1.png w1/a-v2.png
git add -A && git commit -qm init && git remote add origin "$T/remote.git"
git push -q --no-verify origin "$TRUNK" && git fetch -q origin   # bootstrap only
sh scripts/git-hooks/install.sh > /dev/null
pass=0; fail=0
try() { # try <name> <expect: refused|passes> <push args...>
  local name=$1 expect=$2; shift 2
  if "$@" > "$T/out" 2>&1; then got=passes; else got=refused; fi
  local reason; reason=$(grep -hE "NOROW|NOFILE|MISSING|UNMARKED|BADMARK|no-restricted-syntax|no-restricted-imports|refused a push|error TS|FAILED" "$T/out" | head -2 | sed 's/^ *//' | cut -c1-110 | tr '\n' ' ')
  if [ "$got" = "$expect" ]; then pass=$((pass+1)); mark=OK; else fail=$((fail+1)); mark=WRONG; fi
  printf '%-5s %-58s %-8s %s\n' "$mark" "$name" "$got" "$reason"
}
trunk_push() { FLS_PUSH_OK=1 git push -q origin HEAD:$TRUNK; }
branch() { git fetch -q origin; git checkout -q -B "case/$1" "origin/$TRUNK"; }
commit() { git add -A && git commit -qm "$1"; }

branch pin; echo '{"seed":1,"tick":1200}' > seeds/baseline-a.json; commit "re-pin"
try "1 pin file re-recorded, no decision"            refused trunk_push
perl -pi -e 's/0123456789abcdef0123456789abcdef/fedcba9876543210fedcba9876543210/' tests/pin.test.ts; commit "test pin"
printf '| T1 | seeds/baseline-a.json 재기록: 틱 1200까지 관측 |\n' >> docs/decisions/README.md; commit "decision for one"
try "1b decision names the baseline, test pin unnamed" refused trunk_push
printf '| T2 | pin.test.ts 해시 재기록: 입력 형식 변경 |\n' >> docs/decisions/README.md; commit "decision for both"
try "1c both pins named in the decision list"        passes  trunk_push

branch lint; printf 'export function f(x: unknown) { return (x as any).y; }\n' > src/ui/cast.ts; commit "as any"
try "2 new 'as any' without // why:"                 refused trunk_push
printf 'export function f(x: unknown) {\n  // why: fixture objects carry arbitrary fields\n  return (x as any).y;\n}\n' > src/ui/cast.ts; commit "why"
try "2b same cast with // why: on the line above"    passes  trunk_push

branch control; printf 'import { Button } from "./kit/Button";\nexport function Panel() { return <div><Button label="ok" /><select /></div>; }\n' > src/ui/Panel.tsx; commit "select"
try "3 native <select> in src/ui"                    refused trunk_push
printf 'export function Picker() { return <select />; }\n' > src/ui/kit/Select.tsx; git checkout -q "origin/$TRUNK" -- src/ui/Panel.tsx; commit "into kit"
try "3b native <select> inside src/ui/kit"           passes  trunk_push

branch plain; printf 'export const answer = 42;\n' > src/ui/answer.ts; commit "plain"
try "4 ordinary change"                              passes  trunk_push
branch types; printf 'export const broken: number = "no";\n' > src/ui/broken.ts; commit "type error"
try "5 type error"                                   refused trunk_push
try "6 same bad commit to a work branch"             passes  git push -q origin HEAD:refs/heads/work/types
branch nook; printf 'export const x = 1;\n' > src/ui/x.ts; commit "x"
try "7 trunk push without FLS_PUSH_OK"               refused git push -q origin HEAD:$TRUNK
branch ledger; img w1/b-v1.png; printf 'w1,w1/b-v1.png,22,superseded,w1/b-*.png(2장),,\r\n' >> assets-inbox/INBOX_LEDGER.csv; commit "pattern"
try "8 ledger replaced_by is a pattern, not a row"    refused trunk_push
img w1/b-v2.png w1/b-v3.png; printf 'w1,w1/b-v2.png,33,confirmed,,,\r\nw1,w1/b-v3.png,44,confirmed,,,\r\n' >> assets-inbox/INBOX_LEDGER.csv
perl -pi -e 's{w1/b-\*\.png\(2장\)}{w1/b-v2.png;w1/b-v3.png}' assets-inbox/INBOX_LEDGER.csv; commit "paths"
try "8b the two replacement rows joined with ;"        passes  trunk_push
branch layer; printf 'import { Panel } from "../ui/Panel";\nexport const panelForRules = Panel;\n' > src/engine/rules.ts; commit "engine imports ui"
try "9 src/engine imports src/ui"                     refused trunk_push
printf 'export const panelForRules = null;\n' > src/engine/rules.ts
printf 'import { answer } from "../engine/answer";\nexport const shown = answer;\n' > src/ui/answerView.ts; commit "ui imports engine"
try "9b src/ui imports src/engine (allowed direction)" passes  trunk_push

branch korean; printf 'export const harvestLabel = "\xea\xb0\x80\xec\x9d\x84 \xec\x88\x98\xed\x99\x95";\n' > src/engine/harvest.ts; commit "korean in engine"
try "10 new Korean string in src/engine/harvest.ts"   refused trunk_push
printf 'export const HARVEST_COPY = { label: "\xea\xb0\x80\xec\x9d\x84 \xec\x88\x98\xed\x99\x95" } as const;\n' > src/engine/harvestCopy.ko.ts
printf 'import { HARVEST_COPY } from "./harvestCopy.ko";\nexport const harvestLabel = HARVEST_COPY.label;\n' > src/engine/harvest.ts; commit "into ko.ts"
try "10b the same text moved to harvestCopy.ko.ts"    passes  trunk_push
branch dup; img w2/a-copy.png; printf 'w2,w2/a-copy.png,11,confirmed,,copy,\r\n' >> assets-inbox/INBOX_LEDGER.csv; commit "dup"
try "11 new ledger row with the bytes of w1/a-v2"      refused trunk_push
perl -pi -e 's{^(w2,w2/a-copy\.png,11,confirmed,,copy)}{$1 · a-v2.png와 동일 바이트(정본: w1/a-v1.png)}' assets-inbox/INBOX_LEDGER.csv; commit "wrong mark"
try "11b its mark names a row with other bytes"        refused trunk_push
perl -pi -e 's{정본: w1/a-v1\.png}{정본: w1/a-v2.png}' assets-inbox/INBOX_LEDGER.csv; commit "right mark"
try "11c its mark names the same-bytes row"            passes  trunk_push
branch rows; img retired/old.png; commit "image without a row"
try "12 inbox image added without a ledger row"        refused trunk_push
printf 'retired,retired/old.png,55,retired,,옛 그림,\r\n' >> assets-inbox/INBOX_LEDGER.csv; commit "its row"
try "12b the same image with its row"                  passes  trunk_push
branch move; mkdir -p assets-inbox/retired && git mv assets-inbox/w1/a-v1.png assets-inbox/retired/a-v1.png; commit "moved, row left"
try "13 image moved, its row still names the old path" refused trunk_push
perl -pi -e 's{^w1,w1/a-v1\.png,}{w1,retired/a-v1.png,}; s{,w1/a-v1\.png,}{,retired/a-v1.png,}g' assets-inbox/INBOX_LEDGER.csv; commit "row follows"
try "13b the row follows the file"                     passes  trunk_push
echo "gate: $pass as expected, $fail wrong"
cd / && rm -rf "$T"
[ "$fail" = 0 ]
