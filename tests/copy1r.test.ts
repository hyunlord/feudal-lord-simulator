import assert from "node:assert/strict";
import test from "node:test";

import { moneyWordsFull, moneyWordsFullDelta } from "../src/ledger/moneyWords.ko";
import { LEDGER_COPY, LEDGER_WINDOW_LABELS } from "../src/ledger/ledgerCopy.ko";
import { moneyFull, moneyFullDelta } from "../src/ui/money.ko";
import { PETITION_COPY } from "../src/ui/petitionCopy.ko";
import { PROBLEM_CAUSE_COPY } from "../src/ui/problemCauseCopy.ko";
import { SERVICE_DIAGNOSIS_COPY } from "../src/ui/serviceDiagnosisCopy.ko";

// COPY-1r (Astra's copy audit, the screens' share; QA-033): detailed and confirmed money in full, dates not ticks,
// a service's distance in its rule's own ruler, store names without a fixed particle.

test("Given any penny count When written in full Then the ledger's words and the screens' form agree to the penny", () => {
  for (const pence of [0, 7, 12, 40, 239, 240, 399, 479, 38_447, -399, -7]) {
    assert.equal(moneyWordsFull(pence), moneyFull(pence), String(pence));
    assert.equal(moneyWordsFullDelta(pence), moneyFullDelta(pence), String(pence));
  }
  assert.equal(moneyFull(399), "£1 13s 3d", "CA-005: the 3d a short form drops stays");
  assert.equal(moneyFullDelta(240), "+£1");
  assert.equal(moneyFullDelta(0), "±0d");
});

test("Given ledger lines When written Then every amount carries its unit and no line names ticks (CA-002, CA-044)", () => {
  assert.equal(LEDGER_COPY.signed(240), "+£1");
  assert.equal(LEDGER_COPY.sourceLine("방앗간", 3, 399), "방앗간 · 3건 +£1 13s 3d");
  assert.equal(LEDGER_COPY.entryLine("1300년 여름", "제분료", -7), "1300년 여름 · 제분료 −7d");
  const lines = [LEDGER_COPY.noIncome, LEDGER_COPY.eraNoIncome, LEDGER_COPY.eraIncome("x"), ...Object.values(LEDGER_WINDOW_LABELS)];
  for (const line of lines) assert.doesNotMatch(line, /틱/, line);
});

test("Given the Crown's subsidy When it is asked and paid Then the sums are in full and the game's rule is named (CA-005, CA-052)", () => {
  const demand = PETITION_COPY.royal_tax.demand(100, 399, 240, 4800);
  assert.match(demand, /왕실 보조세\(15분의 1세·10분의 1세\)/);
  assert.match(demand, /게임에서는 지금 금고의 10%를 기준으로 £1~£20을 냅니다: 지금은 £1 13s 3d\./);
  assert.equal(PETITION_COPY.royal_tax.title, "왕실 보조세 요구");
});

test("Given the heir's petition When the lord is or is not old Then '늙은' follows the engine's old age (CA-012)", () => {
  assert.match(PETITION_COPY.heir_choice.demand("존", 63), /^늙은 영주 존\(63살\)/);
  assert.match(PETITION_COPY.heir_choice.demand("존", 41), /^영주 존\(41살\)/);
  assert.doesNotMatch(PETITION_COPY.heir_choice.demand("", 41), /늙은/);
  assert.equal(PETITION_COPY.heir_choice.title, "영주의 후계자");
});

test("Given a service's distance When shown Then a market is in road steps and the well and church in tiles (QA-033)", () => {
  assert.equal(SERVICE_DIAGNOSIS_COPY.measure("road_steps", 12, 40), "길 12걸음 / 최대 40걸음");
  assert.equal(SERVICE_DIAGNOSIS_COPY.measure("road_steps", null, 40), "길로 닿지 않음 / 최대 40걸음");
  assert.equal(SERVICE_DIAGNOSIS_COPY.measure("tiles", 3, 8), "거리 3칸 / 범위 8칸");
});

test("Given a store's name When a stuck good's cause names it Then no fixed particle breaks it (CA-043)", () => {
  for (const store of ["창고", "곡창"]) {
    for (const line of [PROBLEM_CAUSE_COPY.noStore(store), PROBLEM_CAUSE_COPY.waiting(store), PROBLEM_CAUSE_COPY.noRoute(store, "밀")]) {
      assert.doesNotMatch(line, /창고이|창고으로|곡창가 |곡창로/, line);
    }
  }
});
