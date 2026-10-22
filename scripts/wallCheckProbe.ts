/**
 * WALL-CHECK (the user's ruling 2026-10-23): why a charter wall that breaks the town's citywide service plan was laid —
 * diagnosis only, read from the save just before it (lord mode). Prints the town's own wall search as the planner runs it
 * (`autoplayEraAction` in the era phase's budget, and in a large one), every wall the proclamation rules accept in the
 * order of a long search with the service-space, room and route tests, and which walls each attempt limit reaches.
 * Usage: npx tsx scripts/wallCheckProbe.ts <save.json[.gz]>
 */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";

import { autoplayEraAction, ruledCharterWall, takeCharterSearchReport, wallInteriorCells } from "../src/engine/autoplayEra";
import { autoplaySearchExhausted, autoplaySearchWorkUsed, runAutoplaySearch, runAutoplaySearchPhase } from "../src/engine/autoplaySearchBudget";
import { preservesAutoplayServiceSpace, resetAutoplayServiceSearch } from "../src/engine/autoplayServiceSpace";
import { wallRoom } from "../src/engine/autoplayWallRoom";
import type { GameState } from "../src/engine/engine.types";
import { confirmPalisadeProclamation } from "../src/engine/palisade";
import { computeReachablePalisadeProposalForState, previewPalisadeRouteAccess } from "../src/engine/palisadeRouteAccess";
import { LABOUR_BALANCE } from "../src/content/balanceConfig";
import { housingLotCount } from "../src/population/housing";
import { LORD_MODE_POLICY } from "../src/engine/townAgency";
import { decodeSave } from "../src/save/saveCodec";

const ERA_PHASE_WORK = 768; // autoplay.ts ERA_PHASE_SEARCH_WORK
const path = process.argv[2]!;
const raw = readFileSync(path);
const saved = decodeSave(new Uint8Array(path.endsWith(".gz") ? gunzipSync(raw) : raw)).envelope.state as GameState;
// The search as the town walks it: no request pending yet.
const state = saved.agency === undefined ? saved : { ...saved, agency: { ...saved.agency, requests: [] } } as GameState;
const remaining = LORD_MODE_POLICY.maxHousingLots - housingLotCount(state);
const ruled = JSON.stringify(ruledCharterWall(state));

const search = (work: number) => {
  resetAutoplayServiceSearch(); takeCharterSearchReport();
  let used: number | undefined; let exhausted = false;
  const action = runAutoplaySearch(() => runAutoplaySearchPhase(() => {
    const result = autoplayEraAction(state, () => ({ kind: "none" }), LORD_MODE_POLICY.maxHousingLots);
    used = autoplaySearchWorkUsed(); exhausted = autoplaySearchExhausted();
    return result;
  }, work), undefined, Math.max(ERA_PHASE_WORK * 10, work));
  return { work, kind: action.kind, ruled: action.kind === "proclaim_era" && action.ruled === true,
    isRuledWall: action.kind === "proclaim_era" && JSON.stringify(action.candidatePath) === ruled, used, exhausted, report: takeCharterSearchReport() };
};

const walls: string[] = [];
const seen = new Set<string>();
computeReachablePalisadeProposalForState(state, candidate => { const key = JSON.stringify(candidate); if (!seen.has(key)) { seen.add(key); walls.push(key); } return false; }, 400);
const tests = walls.map((key, index) => {
  const candidate = JSON.parse(key);
  const projected = confirmPalisadeProclamation(state, candidate);
  const access = previewPalisadeRouteAccess(state, candidate);
  return { wall: index + 1, rules: projected !== state, service: projected !== state && preservesAutoplayServiceSpace(state, { kind: "proclaim_era" }, projected),
    room: wallRoom(state, candidate, remaining).roomy && projected !== state && wallInteriorCells(projected) >= LORD_MODE_POLICY.maxHousingLots * LABOUR_BALANCE.wallCellsPerLot,
    access: access.unreachableSiteIds.length === 0 && access.unavailableSiteIds.length === 0, ruledWall: key === ruled };
});
const reach = [8, 64, 96, 128, 200].map(limit => {
  const met = new Set<number>();
  computeReachablePalisadeProposalForState(state, candidate => { met.add(walls.indexOf(JSON.stringify(candidate)) + 1); return false; }, limit);
  return { limit, walls: [...met].sort((a, b) => a - b) };
});
console.log(JSON.stringify({ save: path.split("/").pop(), tick: state.tick, townSearch: [search(ERA_PHASE_WORK), search(100_000)], walls: tests, reach }));
