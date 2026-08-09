import { DEFAULT_GAME_STATE } from "../src/state/gameStore";

import type { Viewport } from "./phase13Part7BuildMenuProofTypes.js";

export const VIEWPORTS = [
  { width: 1280, height: 720 },
  { width: 920, height: 720 },
  { width: 768, height: 1024 },
  { width: 375, height: 812 },
] as const satisfies readonly Viewport[];

export const stoneTownState = {
  ...DEFAULT_GAME_STATE,
  era: "stone_town" as const,
  treasuryTimber: 500,
  buildings: [
    ...DEFAULT_GAME_STATE.buildings,
    {
      id: "stone-store",
      kind: "storehouse" as const,
      tx: 0,
      ty: 0,
      workers: 0,
      inventory: { stone: 500, stone_raw: 500 },
      reserved: {},
      stockReserved: {},
      productionProgress: 0,
    },
  ],
};

export const PROOF_SCENARIOS = [
  {
    name: "hamlet",
    state: DEFAULT_GAME_STATE,
    expectedButtons: 10,
    maxCompactRows: 3,
  },
  {
    name: "stone_town",
    state: stoneTownState,
    expectedButtons: 15,
    maxCompactRows: 4,
  },
] as const;

export type ProofScenario = (typeof PROOF_SCENARIOS)[number];

export function selectedScenarios(): readonly ProofScenario[] {
  const requestedEra = process.env.PART7_PROOF_ERA;
  if (requestedEra === undefined || requestedEra.length === 0) return PROOF_SCENARIOS;
  if (requestedEra !== "hamlet" && requestedEra !== "stone_town") {
    throw new Error(`PART7_PROOF_ERA must be hamlet or stone_town, got ${requestedEra}`);
  }
  return PROOF_SCENARIOS.filter((scenario) => scenario.name === requestedEra);
}
