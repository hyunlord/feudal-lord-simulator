/**
 * LS1-14 (the user's ruling 2026-10-18; engine B's politicalPetitionExpiryTick, trunk 0ee84b1d): a political petition
 * held on the rail has its time left as the other held decisions — from the engine's expiry tick (its first expired
 * tick; the last answerable one is the tick before), no year counted on the screen — near in its last season, and its
 * lapse does something (it is refused), so it stops the auto-pause as that season begins.
 */
import assert from "node:assert/strict";
import test from "node:test";

import type { GameState } from "../src/engine/engine.types";
import { initialPolitics, politicalPetitionExpiryTick } from "../src/engine/politics";
import type { PetitionRecord } from "../src/engine/politics.types";
import { DEFAULT_GAME_STATE } from "../src/state/gameStore";
import { chipDues, heldDeadlines } from "../src/ui/lord/decisions/deadlines";
import { DEADLINE_COPY } from "../src/ui/lord/decisions/deadlinesCopy.ko";

const petition: PetitionRecord = { id: "market_charter@25000", defId: "market_charter", petitioner: "merchants", arrivedTick: 25_000 };
function stateAt(tick: number): GameState {
  const base: GameState = { ...structuredClone(DEFAULT_GAME_STATE), tick };
  return { ...base, politics: { ...initialPolitics(base), petitions: [petition] } };
}

test("a political petition's deadline is the engine's expiry less one tick, its last season near, its lapse an effect", () => {
  const expiry = politicalPetitionExpiryTick(stateAt(30_000), petition)!;
  assert.equal(expiry, 36_000);
  const due = heldDeadlines(stateAt(30_000)).find(entry => entry.chipId === `petition:${petition.id}`)!;
  assert.deepEqual([due.kind, due.dueTick, due.effect], ["petition", expiry - 1, true]);
  assert.deepEqual(chipDues(stateAt(34_000)).get(`petition:${petition.id}`), { left: DEADLINE_COPY.seasonsLeft(2), short: DEADLINE_COPY.short.seasons(2), near: false, dueTick: 35_999 });
  assert.deepEqual(chipDues(stateAt(35_000)).get(`petition:${petition.id}`), { left: DEADLINE_COPY.thisSeason, short: DEADLINE_COPY.short.thisSeason, near: true, dueTick: 35_999 });
  assert.equal(chipDues(stateAt(35_999)).get(`petition:${petition.id}`)?.near, true);
  assert.equal(DEADLINE_COPY.pauseLine("petition", "상인들의 청원"), "청원(상인들의 청원): 이번 철이 지나면 거절로 처리됩니다");
});
