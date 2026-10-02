/**
 * COPY-1e (Astra's copy audit 2026-10-02, the src/content · src/engine share): the factions' memory of a petition's
 * answer in the words of the choice (CA-001), and the ledger sentences the audit corrected (money words, the 1351
 * Statute, the Calais Staple, the deferred debt's promise, one sentence for an unanswered petition).
 */
import assert from "node:assert/strict";
import test from "node:test";

import { factionReasonLine } from "../src/content/factionCopy.ko";
import { HISTORY_TEMPLATES, WAR_CHOICES } from "../src/content/historyCopy.ko";
import { PETITION_CHOICES } from "../src/content/petitionChoices.ko";

test("CA-001 a faction remembers each answer as what it chose — a legacy to the church or a nephew as heir is no refusal", () => {
  // Every petition and answer the cards offer reads its own meaning in the faction's memory.
  for (const [defId, answers] of Object.entries(PETITION_CHOICES)) {
    for (const [answer, meaning] of Object.entries(answers)) {
      assert.ok(factionReasonLine(`petition:${defId}:${answer}`).endsWith(meaning), `${defId}:${answer}`);
    }
  }
  const legacy = factionReasonLine("petition:legacy_choice:refuse");
  assert.equal(legacy, "유산 선택: 교회를 넓히고 기도처를 세운다");
  assert.doesNotMatch(legacy, /거절/);
  assert.equal(factionReasonLine("petition:heir_choice:refuse"), "후계자 선택: 조카에게 잇게 한다");
  assert.equal(factionReasonLine("petition:heir_choice:accept_with_price"), "후계자 선택: 딸의 남편에게 잇게 한다");
  // Within one petition, no two answers read the same.
  for (const [defId, answers] of Object.entries(PETITION_CHOICES)) {
    const lines = Object.keys(answers).map(answer => factionReasonLine(`petition:${defId}:${answer}`));
    assert.equal(new Set(lines).size, lines.length, defId);
  }
  // A petition without its own choices keeps the plain answer (chapter 1's market charter).
  assert.equal(factionReasonLine("petition:market_charter:accept"), "시장권 청원에 수락");
  // The screens' table is the same one.
  assert.equal(WAR_CHOICES, PETITION_CHOICES);
});

test("CA-006·007·008·013·050 the ledger's corrected sentences", () => {
  const line = (template: string, params: Record<string, string | number>) => HISTORY_TEMPLATES[template]!(params);
  // CA-006: the season's treasury in money words, the people counted.
  assert.equal(line("ledger.season", { population: 120, popDelta: -3, net: -240 }), "계절 결산 — 인구 120명(-3명), 금고 −£1");
  assert.match(line("ledger.season", { population: 120, popDelta: 4, net: 30 }), /^계절 결산 — 인구 120명\(\+4명\), 금고 \+2s 6d$/);
  // CA-007: the 1351 Statute, proclaimed (not the 1349 Ordinance, not read by the king).
  assert.match(line("plague.ordinance", { fine: 0 }), /^노동자법이 공포되었다$/);
  // CA-008: the Staple suspended for a while; the price is the game's effect.
  assert.match(line("legacy.staple", {}), /칼레.*잠시 중단.*게임 효과/);
  // CA-013: the lord's promise is void, not the neighbour's debt.
  assert.match(line("marriage.deferred_void", { amount: 1305 }), /약속이 해제되었다$/);
  assert.doesNotMatch(line("marriage.deferred_void", { amount: 1305 }), /빚.*사라졌다/);
  // CA-050: every era's unanswered petition is one sentence.
  const unanswered = ["plague", "reorg", "legacy", "war"].map(era => line(`${era}.unanswered`, { defId: "wages" }));
  assert.equal(new Set(unanswered).size, 1);
});
