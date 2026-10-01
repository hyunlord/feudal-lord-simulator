import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import { HUD_COPY } from "../src/ui/hud/hudCopy.ko";
import { moneyDelta, moneyFull, moneyObject, moneyParts, moneyPence, moneyShort, PENCE_PER_POUND } from "../src/ui/money.ko";

// UI-AUDIT-1: the engine counts pennies; the screens write English money (£1 = 20s = 240d). The short form drops the
// pence from £1 up and keeps them under it; the ledger's full form keeps every penny.

test("UI-AUDIT-1: the short form — pounds and shillings from £1 up, shillings and pence under it", () => {
  const cases: readonly (readonly [number, string])[] = [
    [0, "0d"], [7, "7d"], [11, "11d"], [12, "1s"], [40, "3s 4d"], [239, "19s 11d"], [240, "£1"], [243, "£1"], [479, "£1 19s"],
    [38_447, "£160 3s"], [48_000, "£200"], [9_999_999, "£41,666 13s"], [-7, "−7d"], [-38_447, "−£160 3s"], [-240, "−£1"],
  ];
  for (const [pence, text] of cases) assert.equal(moneyShort(pence), text, `${pence}d`);
});

test("UI-AUDIT-1: the full form keeps every penny, and the penny count has commas", () => {
  const cases: readonly (readonly [number, string])[] = [
    [0, "0d"], [7, "7d"], [11, "11d"], [12, "1s"], [239, "19s 11d"], [240, "£1"], [243, "£1 3d"],
    [38_447, "£160 3s 11d"], [9_999_999, "£41,666 13s 3d"], [-38_447, "−£160 3s 11d"],
  ];
  for (const [pence, text] of cases) assert.equal(moneyFull(pence), text, `${pence}d`);
  assert.equal(moneyPence(38_447), "38,447d");
  assert.equal(moneyPence(9_999_999), "9,999,999d");
  assert.equal(moneyPence(-7), "−7d");
  assert.deepEqual(moneyParts(38_447), { negative: false, pounds: 160, shillings: 3, pence: 11 });
});

test("UI-AUDIT-1: fractions are cut toward zero; nothing reads −0; not-a-number is a dash", () => {
  assert.equal(moneyShort(7.9), "7d");
  assert.equal(moneyShort(-0.4), "0d");
  assert.equal(moneyDelta(-0.4), "±0d");
  assert.equal(moneyShort(Number.NaN), "—");
});

test("UI-AUDIT-1: a change carries its sign; the object particle follows the last unit read aloud", () => {
  assert.equal(moneyDelta(38_447), "+£160 3s");
  assert.equal(moneyDelta(-40), "−3s 4d");
  assert.equal(moneyDelta(0), "±0d");
  assert.equal(moneyObject(38_447), "£160 3s을");
  assert.equal(moneyObject(48_000), "£200를");
  assert.equal(moneyObject(7), "7d를");
});

test("UI-AUDIT-1: the lord-mode terms (docs/design/lord-mode.md) print as the design writes them", () => {
  // The dowry £200 and the minimum income £40 (Paston 1444), the grant £10, the toll £6, the steward's £5 rule, the loan £437.
  for (const pounds of [200, 40, 10, 6, 5, 437]) assert.equal(moneyShort(pounds * PENCE_PER_POUND), `£${pounds}`);
});

test("UI-AUDIT-1: the HUD's coin cell is short; the treasury its press opens reads to the penny", () => {
  assert.equal(HUD_COPY.money(38_447), "£160 3s");
  assert.equal(HUD_COPY.ledgerTreasuryLine(38_447), "금고 £160 3s 11d · 38,447d");
  assert.equal(HUD_COPY.ledgerTreasuryLine(7), "금고 7d");
});

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) && !name.includes(".generated.") ? [path] : [];
  });
}

test("UI-AUDIT-1: no UI or render module builds money as a bare number with a \"d\" suffix", () => {
  const offenders: string[] = [];
  for (const file of [...sourceFiles("src/ui"), ...sourceFiles("src/render")]) {
    if (file.endsWith(join("ui", "money.ko.ts"))) continue;
    readFileSync(file, "utf8").split("\n").forEach((line, index) => {
      // The old helper (`pence(…)` from hudCopy.ko), or a template that glues "d" to an interpolated number.
      if (/\bpence\s*\(|import\s*\{[^}]*\bpence\b[^}]*\}\s*from/.test(line) || /\}d(?![A-Za-z0-9_])/.test(line)) offenders.push(`${file}:${index + 1}: ${line.trim()}`);
    });
  }
  assert.deepEqual(offenders, []);
});
