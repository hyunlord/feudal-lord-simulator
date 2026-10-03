// LM-R1 (receipt) states: the lord's slice (core:lord_slice, seed 1) with the lord's three conditions set at the start —
// the stability policy, the market dues at 80% and a 10d farmstead subsidy (each a ledger decision) — run week by week
// until the town has built (finished) a building whose receipt compared sites with a next best and was paid the
// subsidy, one paid none, and (when the run finds one before `lastWeek`) one that had a single candidate site. Saved:
//  - `lord-receipts`: that state (the "왜 여기?" receipts and the lord tab);
//  - `lord-receipts-old`: the same town with every receipt's `chance` removed — what a save from before v43 (LM-E5)
//    loads as (the field is absent there), for the receipt's "no chance on an old save" line.
// Beside them moments-lord.json: each target's building id, kind and tile, and what the run found.
//   tsx scripts/lmr1LordStates.ts <out-dir> [lastWeek=160]
import { refuseHeavyOnMac } from "./remote/localGuard.mjs";
refuseHeavyOnMac("영주 모드 1300→(scripts/lmr1LordStates.ts)", { remote: "scripts/remote/run.sh render-LMR1-receipt-<sha7> -- node_modules/.bin/tsx scripts/lmr1LordStates.ts <디렉터리>", entry: import.meta.url });
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { AGENCY_WEEK_TICKS, SUBSIDY_TREASURY_PERMILLE } from "../src/content/townAgencyConfig";
import type { GameState } from "../src/engine/engine.types";
import { stateCalendar } from "../src/engine/scenarioState";
import { advanceTick } from "../src/engine/tick";
import { whyHere } from "../src/engine/townAgency";
import type { ProjectReceipt } from "../src/engine/townAgency.types";
import { treasuryBalance } from "../src/ledger/ledger";
import { gameReducer } from "../src/state/gameStore";
import { newGameState } from "../src/state/newGame";

const out = process.argv[2];
if (out === undefined) throw new Error("usage: tsx scripts/lmr1LordStates.ts <out-dir> [lastWeek]");
const lastWeek = Number(process.argv[3] ?? 160);
mkdirSync(out, { recursive: true });

let state = newGameState({ scenarioId: "core:lord_slice" })!;
state = gameReducer(state, { type: "set_estate_policy", policy: "stability" });
state = gameReducer(state, { type: "set_market_dues", permille: 800 });
state = gameReducer(state, { type: "set_project_subsidy", kind: "farmstead", amount: 10 });

type Target = { readonly id: string; readonly kind: string; readonly tx: number; readonly ty: number; readonly receipt: string };
const target = (current: GameState, test: (receipt: ProjectReceipt) => boolean): Target | null => {
  for (const building of current.buildings) {
    const receipt = whyHere(current, building.id);
    if (receipt !== null && test(receipt)) return { id: building.id, kind: building.kind, tx: building.tx, ty: building.ty, receipt: receipt.id };
  }
  return null;
};
const compared = (receipt: ProjectReceipt) => receipt.sites !== undefined && receipt.sites.runnerUp !== null;
const found = (current: GameState) => ({
  subsidised: target(current, receipt => compared(receipt) && receipt.subsidy > 0 && receipt.decisionIds.length > 0),
  unsubsidised: target(current, receipt => compared(receipt) && receipt.subsidy === 0),
  single: target(current, receipt => receipt.sites !== undefined && receipt.sites.runnerUp === null),
});
let week = 0;
let now = found(state);
while (week < lastWeek && (now.subsidised === null || now.unsubsidised === null || now.single === null)) {
  const until = (week + 1) * AGENCY_WEEK_TICKS;
  while (state.tick < until) state = advanceTick(state);
  week += 1;
  // The single-site receipt is a bonus: stop once the other two stand and a year has passed without it.
  now = found(state);
  if (now.subsidised !== null && now.unsubsidised !== null && now.single === null && week >= 52) break;
}
const opening = state.buildings.find(building => whyHere(state, building.id) === null && building.kind === "well") ?? null;
const old: GameState = { ...state, agency: { ...state.agency!, receipts: state.agency!.receipts.map(({ chance: _chance, ...receipt }) => receipt) } };
writeFileSync(join(out, "lord-receipts.json"), JSON.stringify(state));
writeFileSync(join(out, "lord-receipts-old.json"), JSON.stringify(old));
const about = { tick: state.tick, year: stateCalendar(state).year, weeks: week, receipts: state.agency!.receipts.length,
  treasury: treasuryBalance(state), subsidyLimit: Math.floor(treasuryBalance(state) * SUBSIDY_TREASURY_PERMILLE / 1000),
  ...now, opening: opening === null ? null : { id: opening.id, kind: opening.kind, tx: opening.tx, ty: opening.ty },
  decisions: (state.history?.records ?? []).filter(record => record.kind === "decision").map(record => [record.id, record.template]) };
writeFileSync(join(out, "moments-lord.json"), JSON.stringify(about, null, 1) + "\n");
console.log(JSON.stringify({ weeks: week, subsidised: now.subsidised?.id ?? null, unsubsidised: now.unsubsidised?.id ?? null, single: now.single?.id ?? null }));
process.exitCode = now.subsidised !== null && now.unsubsidised !== null ? 0 : 1;
