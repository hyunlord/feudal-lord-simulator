/** QA (UI-AUDIT-1 handoff): the engine's money words read as the screens' (src/ui/money.ko.ts), in £·s, not pence. */
import assert from "node:assert/strict";
import test from "node:test";
import { moneyWords, moneyWordsDelta, moneyWordsJosa } from "../src/ledger/moneyWords.ko";
import { moneyDelta, moneyJosa, moneyShort } from "../src/ui/money.ko";
import { historySummary } from "../src/engine/history";
import { chapterSummaryLine } from "../src/content/legacyCopy.ko";
import { MONEY_RULE_COPY } from "../src/content/moneyCopy.ko";
import { LEDGER_COPY } from "../src/ledger/ledgerCopy.ko";

test("the engine's short money form is the screens': every sum from −3 pounds to 12 pounds, and the large ones", () => {
  const values = [...Array.from({ length: 3600 }, (_, index) => index - 720), 38_447, 48_000, 479, 239, 1_000_000, Number.NaN];
  for (const value of values) {
    assert.equal(moneyWords(value), moneyShort(value), `${value}`);
    assert.equal(moneyWordsDelta(value), moneyDelta(value), `${value}`);
    assert.equal(moneyWordsJosa(moneyWords(value), "을", "를"), moneyJosa(moneyShort(value), "을", "를"));
  }
  assert.deepEqual([moneyWords(38_447), moneyWords(40), moneyWords(0), moneyWordsDelta(-7)], ["£160 3s", "3s 4d", "0d", "−7d"]);
});

test("the engine's lines write £·s: the ledger history, the chronicle's chapter line, the money rules, the era income", () => {
  const line = (template: string, params: Record<string, string | number>) => historySummary({ template, params });
  assert.equal(line("legacy.royal_subsidy", { amount: 38_447 }), "국왕에게 보조세를 냈다 — £160 3s");
  assert.equal(line("legacy.market_fire", { cost: 480 }), "장터에 불이 났다 — 수리에 £2");
  assert.equal(line("plague.ordinance", { fine: 40 }), "노동자법이 공포되었다 — 임금을 올린 영주에게 벌금 3s 4d");
  assert.equal(line("reorg.poll_tax", { amount: 7 }), "인두세를 걷었다 — 영주의 몫 7d");
  assert.match(line("war.raid", { burntHouses: 2, looted: 30, coin: 300 }), /빼앗긴 돈 £1 5s$/);
  assert.equal(line("decision.project_subsidy", { kind: "mill", amount: 60 }), "방앗간에 장려금 5s을 걸었다");
  assert.match(line("agency.subsidy_refused", { kind: "mill", amount: 120, total: 120, limit: 15 }), /장려금 10s은 걸지 못했다: 장려금 합계 10s이 금고의 4분의 1\(1s 3d\)을 넘는다/);
  assert.equal(chapterSummaryLine({ fromYear: 1300, toYear: 1319, populationStart: 28, populationEnd: 528, treasury: 38_447 }), "1300–1319년 · 인구 28에서 528로 · 금고 £160 3s");
  assert.equal(MONEY_RULE_COPY.cellArrears(500), "미납 £2 1s");
  assert.equal(MONEY_RULE_COPY.cellNet(-7), "돈 · 최근 기간 −7d");
  assert.equal(LEDGER_COPY.eraIncomeLine("지대", 1200), "지대 +£5");
});
