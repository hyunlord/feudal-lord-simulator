// LM-E9b gate (spec docs/design/town-agency.md TA-13): on a stuck lord's town (a save), the weeks reuse their walk; the
// lord sets a subsidy, and the next week walks again with the subsidised kind among its proposals. Lists each week:
// walked or reused, the walk's tick, its proposals, and the subsidies in force.
//   tsx scripts/townAgencyReuseExample.ts <save.json> <kind> > example.json
import { readFileSync } from "node:fs";
import { AGENCY_WEEK_TICKS, SUBSIDY_TREASURY_PERMILLE } from "../src/content/townAgencyConfig";
import type { BuildingKind } from "../src/content/buildingConfig";
import type { GameState } from "../src/engine/engine.types";
import { stateCalendar } from "../src/engine/scenarioState";
import { advanceTick } from "../src/engine/tick";
import { treasuryBalance } from "../src/ledger/ledger";
import { decodeSave } from "../src/save/saveCodec";
import { gameReducer } from "../src/state/gameStore";

const [savePath, kindArg] = process.argv.slice(2);
const kind = (kindArg ?? "granary") as BuildingKind;
let state = decodeSave(new Uint8Array(readFileSync(savePath!))).envelope.state as GameState;
const weeks: unknown[] = [];

function toNextWeek(): void {
  const until = (Math.floor(state.tick / AGENCY_WEEK_TICKS) + 1) * AGENCY_WEEK_TICKS;
  const started = performance.now();
  while (state.tick < until) state = advanceTick(state);
  const agency = state.agency!;
  const walk = agency.lastWalk;
  weeks.push({ tick: state.tick, year: stateCalendar(state).year, ms: Math.round(performance.now() - started),
    week: walk === undefined ? "started" : walk.tick === state.tick ? "walked" : "reused", walkTick: walk?.tick ?? null,
    proposals: (walk?.proposals ?? []).map(proposal => `${proposal.what}@${proposal.tx},${proposal.ty}:${proposal.score}`),
    subsidies: agency.subsidies.map(subsidy => `${subsidy.kind}:${subsidy.amount}`), receipts: agency.nextReceipt });
}

for (let index = 0; index < 4; index += 1) toNextWeek();
const amount = Math.max(1, Math.min(40, Math.floor(treasuryBalance(state) * SUBSIDY_TREASURY_PERMILLE / 1000)));
state = gameReducer(state, { type: "set_project_subsidy", kind, amount });
weeks.push({ tick: state.tick, lord: `set_project_subsidy ${kind} ${amount}`, subsidies: state.agency!.subsidies.map(subsidy => `${subsidy.kind}:${subsidy.amount}`),
  refusal: state.agency!.lastRefusal ?? null });
for (let index = 0; index < 2; index += 1) toNextWeek();
process.stdout.write(`${JSON.stringify({ save: savePath, kind, weeks }, null, 1)}\n`);
