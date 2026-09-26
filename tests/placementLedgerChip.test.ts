import assert from "node:assert/strict";
import { test } from "node:test";

import { BUILDING_CONFIG_BY_KIND } from "../src/content/buildingConfig";
import type { GameState } from "../src/engine/engine.types";
import { settleMoneyPeriod } from "../src/engine/moneyRules";
import { predictPlacementLedger } from "../src/engine/placementLedger";
import { LEDGER_PERIOD_TICKS } from "../src/ledger/ledger";
import { placementChipModel } from "../src/ui/placementChip";
import { DEFAULT_GAME_STATE } from "../src/state/gameStore";
import { canPlaceBuildingWithZones } from "../src/zones/zonePlacement";

// UI-3 gate 3: the placement chip's ledger line is the engine's prediction (FP-2), and the prediction is what the
// period close charges. The hut's rent against a real filled hut is flowPressure P1 (20,000 ticks of play); here the
// mill's upkeep is settled once with the mill standing, and both chips carry exactly the predicted numbers.
const base = DEFAULT_GAME_STATE;

test("UI-3 gate 3: a hut's chip says the rent the engine predicts for its site", () => {
  const well = base.buildings.find(building => building.kind === "well")!;
  const site = base.tiles.filter(tile => Math.abs(tile.tx - well.tx) + Math.abs(tile.ty - well.ty) <= 6)
    .filter(tile => canPlaceBuildingWithZones(base, "house", tile.tx, tile.ty).ok)
    .map(tile => ({ tile, prediction: predictPlacementLedger(base, "house", tile) }))
    .find(entry => entry.prediction.rentPerPeriod > 0)!;
  const chip = placementChipModel(base, { tool: "house", reachHouses: null, ledger: site.prediction });
  assert.equal(chip.period, `장부 기간마다 지대 +${site.prediction.rentPerPeriod}`, "no upkeep, no labour for a hut");
});

test("UI-3 gate 3: a mill's chip says the upkeep the period close charges and the adults it takes", () => {
  const tile = { tx: 20, ty: 20 };
  const prediction = predictPlacementLedger(base, "mill", tile);
  assert.equal(prediction.labourDemand, BUILDING_CONFIG_BY_KIND.mill.workersRequired);
  const withMill: GameState = { ...base, tick: LEDGER_PERIOD_TICKS, treasuryCoin: 500, buildings: [...base.buildings, { id: "mill-test", kind: "mill", ...tile,
    workers: 0, inventory: {}, reserved: {}, stockReserved: {}, productionProgress: 0 }] };
  const charged = settleMoneyPeriod(withMill).ledger!.entries.filter(entry => entry.category === "upkeep" && entry.sourceRefs[0]?.id === "mill-test")
    .reduce((sum, entry) => sum - entry.amount, 0);
  assert.equal(charged, prediction.upkeepPerPeriod);
  const chip = placementChipModel(base, { tool: "mill", reachHouses: null, ledger: prediction });
  const parts = [...(prediction.upkeepPerPeriod > 0 ? [`유지비 −${prediction.upkeepPerPeriod}`] : []), ...(prediction.labourDemand > 0 ? [`일꾼 ${prediction.labourDemand}`] : [])];
  assert.equal(chip.period, parts.length === 0 ? null : `장부 기간마다 ${parts.join(" · ")}`);
});
