/**
 * STORE-DIAG (the user's ruling 2026-10-20): why seed 32's storehouses stood full for years with no fifth one begun —
 * diagnosis only, nothing changed. The lord slice played by the lord bot; at each season's end from `fromYear`:
 *  - what fills the storehouses (each one's goods) and the lord-mode intake caps (`lordIntakeRules`: raw stone at most
 *    half a storehouse from the palisade era);
 *  - the bot's storage need (`planningNeeds`, the "storage" planner) and the storehouse step (`autoplayBuildAction`);
 *  - the town's proposals (`townProposals`): whether a storehouse is among them, its actor, score and rank, the ones
 *    ahead of it, its cost against the actor's funds (`agency.actors`), and the site's town refusal at (51,55)
 *    (`townSiteRefusal`);
 *  - the weekly start limits: open building sites (`OPEN_SITES_MAX`), the projects begun that season (receipts) and
 *    whether a charter hold was on.
 * Usage: npx tsx scripts/storeDiagProbe.ts <seed> <years> [fromYear] > out.json
 */
import { BUILDING_CONFIG_BY_KIND } from "../src/content/buildingConfig";
import { LORD_SLICE_SCENARIO_ID } from "../src/content/lordSliceConfig";
import { OPEN_SITES_MAX, STARTS_PER_WEEK } from "../src/content/townAgencyConfig";
import { isBuildingConstructionSite } from "../src/economy/construction";
import { autoplayBuildAction, planningNeeds, townSiteRefusal } from "../src/engine/autoplay";
import type { GameState } from "../src/engine/engine.types";
import { lordBotCommands } from "../src/engine/lordBot";
import { lordIntakeRules } from "../src/engine/recovery";
import { stateCalendar } from "../src/engine/scenarioState";
import { advanceTick } from "../src/engine/tick";
import { LORD_MODE_POLICY, townProposals } from "../src/engine/townAgency";
import { gameReducer } from "../src/state/gameStore";
import { newGameState } from "../src/state/newGame";

const seed = Number(process.argv[2] ?? 32);
const years = Number(process.argv[3] ?? 30);
const site = { tx: Number(process.argv[5] ?? 51), ty: Number(process.argv[6] ?? 55) };

let state = newGameState({ scenarioId: LORD_SLICE_SCENARIO_ID, seed }) as GameState;
const start = stateCalendar(state).year;
const fromYear = Number(process.argv[4] ?? 1320);
const rows: unknown[] = [];
let knownReceipts = 0;
while (stateCalendar(state).year < start + years) {
  for (const { command } of lordBotCommands(state)) { const next = gameReducer(state, command); if (next !== state) state = next; }
  state = advanceTick(state);
  const calendar = stateCalendar(state);
  if (calendar.year < fromYear) { knownReceipts = state.agency?.receipts.length ?? 0; continue; }
  if (state.tick % 1_000 !== 0) continue;
  const stores = state.buildings.filter(b => b.kind === "storehouse");
  const proposals = townProposals(state);
  const rank = proposals.findIndex(p => p.what === "storehouse");
  const proposal = rank < 0 ? null : proposals[rank]!;
  const actors = Object.fromEntries((state.agency?.actors ?? []).map(a => [a.kind, a.funds]));
  const receipts = state.agency?.receipts ?? [];
  const begun = receipts.slice(Math.min(knownReceipts, receipts.length)).map(r => `${r.actor}:${r.what}`);
  knownReceipts = receipts.length;
  const needs = planningNeeds(state, LORD_MODE_POLICY).filter(need => need.planner === "storage").map(need => JSON.stringify(need.action).slice(0, 70));
  rows.push({
    year: calendar.year, season: Math.floor((state.tick % 4_000) / 1_000), era: state.era,
    stores: stores.map(b => Object.fromEntries(Object.entries(b.inventory).filter(([, v]) => (v ?? 0) > 0))),
    capacity: stores.length * BUILDING_CONFIG_BY_KIND.storehouse.storageCapacity,
    intakeCaps: (lordIntakeRules(state)?.caps ?? []).filter(cap => cap.store === "storehouse"),
    storageNeed: needs, storehouseStep: JSON.stringify(autoplayBuildAction(state, "storehouse")).slice(0, 70),
    storehouseProposal: proposal === null ? null : { rank, of: proposals.length, actor: proposal.actor, score: proposal.score, cost: proposal.cost,
      actorFunds: actors[proposal.actor] ?? null, ahead: proposals.slice(0, rank).map(p => `${p.what}:${p.actor}:${p.score}`).slice(0, 6) },
    topProposals: proposals.slice(0, 5).map(p => `${p.what}:${p.actor}:${p.score}:${p.cost}`),
    actors, openSites: state.constructionSites.filter(isBuildingConstructionSite).length, openMax: OPEN_SITES_MAX, startsPerWeek: STARTS_PER_WEEK,
    begunThisSeason: begun, siteRefusal: townSiteRefusal(state, "storehouse", site, site, LORD_MODE_POLICY),
  });
}
console.log(JSON.stringify({ seed, years, fromYear, site, rows }, null, 1));
