// The user's question 2026-10-11 (seed 1, lord mode): where the timber goes while the charter waits for 250 in stock —
// each year the timber bought (arriving in the treasury), delivered to each kind of construction site, the change in the
// town's timber (stores and treasury), and the rest (made by the sawmills, less any other use); the spendable timber the
// charter counts, and the orders placed.
//   tsx scripts/timberLedgerProbe.ts <seed> [years] > out.json
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { LORD_SLICE_SCENARIO_ID } from "../src/content/lordSliceConfig";
import type { GameState } from "../src/engine/engine.types";
import { lordBotCommands } from "../src/engine/lordBot";
import { stateCalendar } from "../src/engine/scenarioState";
import { advanceTick } from "../src/engine/tick";
import { gameReducer } from "../src/state/gameStore";
import { newGameState } from "../src/state/newGame";
import { placementSpendableResource } from "../src/world/placement";

const held = (state: GameState) => state.buildings.reduce((sum, building) => sum + (building.inventory.timber ?? 0), 0) + Math.max(0, state.treasuryTimber);

export function timberLedgerProbe(seed: number, years = 19) {
  let state = newGameState({ scenarioId: LORD_SLICE_SCENARIO_ID, seed }) as GameState;
  const start = stateCalendar(state).year;
  const rows: Record<string, unknown>[] = [];
  let year = start;
  let delivered: Record<string, number> = {};
  let bought = 0; let ordered = 0; let heldAtStart = held(state);
  const siteKind = new Map<string, string>();
  const lastDelivered = new Map<string, number>();
  while (stateCalendar(state).year < start + years) {
    for (const { command } of lordBotCommands(state)) {
      if ((command as { type: string }).type === "order_timber") ordered += (command as { amount: number }).amount;
      const next = gameReducer(state, command); if (next !== state) state = next;
    }
    const before = state;
    state = advanceTick(state);
    // Orders the town placed itself (FIX-14/GB-8) and timber that arrived.
    if ((state.timberOrder ?? 0) > (before.timberOrder ?? 0)) ordered += (state.timberOrder ?? 0) - (before.timberOrder ?? 0);
    const arrived = state.treasuryTimber - before.treasuryTimber;
    if (arrived > 0 && (state.timberOrder ?? 0) < (before.timberOrder ?? 0)) bought += arrived;
    for (const site of state.constructionSites) {
      const kind = "kind" in site ? String(site.kind) : "wall";
      siteKind.set(site.id, kind);
      const now = site.delivered.timber ?? 0;
      const was = lastDelivered.get(site.id) ?? 0;
      if (now > was) delivered[kind] = (delivered[kind] ?? 0) + now - was;
      lastDelivered.set(site.id, now);
    }
    const y = stateCalendar(state).year;
    if (y !== year) {
      const heldNow = held(state);
      const used = Object.values(delivered).reduce((a, b) => a + b, 0);
      rows.push({ year, bought, ordered, delivered, used, heldChange: heldNow - heldAtStart, madeOrOther: heldNow - heldAtStart + used - bought,
        spendable: placementSpendableResource(state, "timber"), camps: state.buildings.filter(b => b.kind === "logging_camp").length,
        sawmills: state.buildings.filter(b => b.kind === "sawmill").length, era: state.era });
      year = y; delivered = {}; bought = 0; ordered = 0; heldAtStart = heldNow;
    }
  }
  return { seed, rows };
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [seed = "1", years = "19"] = process.argv.slice(2);
  process.stdout.write(`${JSON.stringify(timberLedgerProbe(Number(seed), Number(years)))}\n`);
}
