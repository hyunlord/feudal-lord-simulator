import { allocateBuildingAndConstructionLabour } from "../../src/population/labour";
import type { Building } from "../../src/content/buildingConfig";
import { createPalisadeConstructionSite, createConstructionSite } from "../../src/economy/construction";

const b = (id: string, kind: Building["kind"]): Building => ({ id, kind, tx: 0, ty: 0, workers: 0, inventory: {}, reserved: {}, stockReserved: {}, productionProgress: 0 });
const buildings = [b("farm", "wheat_farm"), b("mill", "mill"), b("gran", "granary"), b("log", "logging_camp"), b("saw", "sawmill"), b("store", "storehouse"), b("quarry", "quarry")];
const wall = createPalisadeConstructionSite({ id: "w-000", wallId: "w", segmentIndex: 0, gateDistance: 0, order: 0, path: [{ x: 0, y: 0 }, { x: 4, y: 0 }], startedTick: 0 });
const wallReady = { ...wall, delivered: { timber: 60 } };
const show = (label: string, r: ReturnType<typeof allocateBuildingAndConstructionLabour>) => {
  const d = r.diagnostics.palisadeEraLabour;
  console.log(label, JSON.stringify({ workers: Object.fromEntries(r.buildings.map(x => [x.id, x.workers])), builders: r.constructionSites.map(s => [s.id, s.assignedBuilders, s.stall]), idle: r.idleWorkers, reserved: d.reservedWorkers, assignedWall: d.assignedBuilders, unavailable: d.unavailableReservedWorkers }));
};
// A: pop 40 (20 workers), hamlet, no sites
show("A hamlet pop40", allocateBuildingAndConstructionLabour(buildings, [], 40, { era: "hamlet", tick: 10, eraProclaimedTick: null }));
// B: palisade era offset 0, wall site awaiting materials
show("B palisade t+0 wall awaiting", allocateBuildingAndConstructionLabour(buildings, [wall], 40, { era: "palisade", tick: 100, eraProclaimedTick: 100 }));
// C: palisade era, wall ready
show("C palisade t+0 wall ready", allocateBuildingAndConstructionLabour(buildings, [wallReady], 40, { era: "palisade", tick: 100, eraProclaimedTick: 100 }));
// D: small village pop 16 (8 workers), palisade, wall awaiting
show("D palisade pop16 wall awaiting", allocateBuildingAndConstructionLabour(buildings, [wall], 16, { era: "palisade", tick: 100, eraProclaimedTick: 100 }));
// E: same, after window
show("E palisade pop16 t+600", allocateBuildingAndConstructionLabour(buildings, [wall], 16, { era: "palisade", tick: 700, eraProclaimedTick: 100 }));
// F: partial staffing waste: pop 10 (5 workers) hamlet: farm 4, mill 1 of 2
show("F hamlet pop10", allocateBuildingAndConstructionLabour(buildings, [], 10, { era: "hamlet", tick: 1, eraProclaimedTick: null }));
// G: ordinary site ready + pop 18 (9 workers)
const house = { ...createConstructionSite({ ordinal: 1, kind: "well", tx: 0, ty: 0, startedTick: 0 }), delivered: { timber: 10 } };
show("G hamlet pop18 ready well", allocateBuildingAndConstructionLabour(buildings, [house], 18, { era: "hamlet", tick: 1, eraProclaimedTick: null }));
// H: no road for farm (eligible false) pop 20
show("H farm ineligible pop20", allocateBuildingAndConstructionLabour(buildings, [], 20, { era: "hamlet", tick: 1, eraProclaimedTick: null }, bb => bb.id !== "farm"));
