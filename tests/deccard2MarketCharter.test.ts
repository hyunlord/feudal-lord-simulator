// DEC-CARD-2 (DEC-TRACE §6, DTR-8): in lord mode a market charter opens the market to the town before its era — the
// build menu reads the engine's own rule (isBuildingOpen), so a chartered hamlet lists the market without a lock.
import assert from "node:assert/strict";
import test from "node:test";
import { MARKET_CHARTER_RIGHT_ID } from "../src/content/chapterConfig";
import { LORD_SLICE_SCENARIO_ID } from "../src/content/lordSliceConfig";
import type { GameState } from "../src/engine/engine.types";
import { newGameState } from "../src/state/newGame";
import { buildMenuGroups, eraLockReason } from "../src/ui/buildMenuModel";
import { isBuildingOpen } from "../src/world/placement";

const lordGame = (): GameState => newGameState({ scenarioId: LORD_SLICE_SCENARIO_ID, seed: 1 })!;
const withCharter = (state: GameState): GameState => ({
  ...state,
  politics: { ...state.politics!, rights: [...(state.politics?.rights ?? []), { id: `${MARKET_CHARTER_RIGHT_ID}@test` } as never] },
});
const listsMarket = (state: GameState) => buildMenuGroups(state).some(group => group.options.some(option => option.tool === "market"));

test("a lord-mode hamlet without a charter: the market waits for its era, as the engine says", () => {
  const state = lordGame();
  assert.equal(state.era, "hamlet");
  assert.equal(isBuildingOpen(state, "market"), false);
  assert.equal(listsMarket(state), false);
  assert.notEqual(eraLockReason("market", state), null);
});

test("with the market charter the same hamlet lists the market and shows no lock (the engine's rule, not a copy)", () => {
  const state = withCharter(lordGame());
  assert.equal(isBuildingOpen(state, "market"), true);
  assert.equal(listsMarket(state), true);
  assert.equal(eraLockReason("market", state), null);
  // Only the market: the charter opens nothing else before its era.
  for (const group of buildMenuGroups(state)) for (const option of group.options) if (option.tool !== "road") assert.equal(isBuildingOpen(state, option.tool), true, option.tool);
});
