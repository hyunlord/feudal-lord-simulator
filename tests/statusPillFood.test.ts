import assert from "node:assert/strict";
import { test } from "node:test";

import { DEFAULT_GAME_STATE } from "../src/state/gameStore";
import { foodDays, statusPillModel } from "../src/ui/hud/statusPillModel";
import { HUD_COPY } from "../src/ui/hud/hudCopy.ko";
import { SEASON_STRIP_COPY } from "../src/ui/seasonStripCopy.ko";
import { arrivalOf } from "../src/ui/seasonStrip";
import { PLACEMENT_CHIP_COPY } from "../src/ui/placementChipCopy.ko";
import { SEASON_LEDGER_COPY } from "../src/ui/seasonLedgerCopy.ko";

// Judgement 2026-09-26: the pill's food is what lies in the stores; money is pennies ("d").

test("a new game: 30 bread in the granary, four houses eating one loaf per meal interval — 270 days (3,000 ticks from the first day of spring — early winter)", () => {
  const model = statusPillModel(DEFAULT_GAME_STATE);
  assert.equal(model.foodDays, 270);
  const until = arrivalOf(DEFAULT_GAME_STATE.tick, model.foodUntilTick!);
  assert.equal(SEASON_STRIP_COPY.foodUntil(model.foodDays!, until.season, until.third, until.nextYear), "식량 270일 — 겨울 초까지");
});

test("bread on carts, in mills or in barns is not stored food; wheat in a store counts as the bread it makes", () => {
  const granary = DEFAULT_GAME_STATE.buildings.find(building => building.kind === "granary")!;
  const others = DEFAULT_GAME_STATE.buildings.filter(building => building !== granary);
  const empty = { ...granary, inventory: {} };
  const carting = { ...DEFAULT_GAME_STATE, buildings: [...others, empty],
    walkers: [{ ...DEFAULT_GAME_STATE.walkers[0]!, cargo: { resource: "bread" as const, amount: 14 } }],
  };
  assert.equal(foodDays(carting), 0, "all 30 loaves on a cart or in larders — nothing in the stores");
  const mill = { ...granary, id: "mill-x", kind: "mill" as const, inventory: { bread: 20 } };
  assert.equal(foodDays({ ...carting, buildings: [...carting.buildings, mill] }), 0);
  const wheat = { ...empty, inventory: { wheat: 60 } };
  assert.equal(foodDays({ ...carting, buildings: [...others, wheat] }), 270, "60 wheat = 30 bread");
});

test("money reads as pennies everywhere the HUD shows it", () => {
  assert.equal(HUD_COPY.money(120), "120d");
  assert.equal(PLACEMENT_CHIP_COPY.rent(3), "지대 +3d");
  assert.equal(PLACEMENT_CHIP_COPY.upkeep(2), "유지비 −2d");
  assert.equal(SEASON_LEDGER_COPY.money(12, 4), "수입 +12d · 지출 −4d · 남음 +8d");
});
