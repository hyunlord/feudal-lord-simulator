/**
 * F4-A human path (RG-1, RG-5): chapter 4 to its first decision as a player meets it — in the town that came through
 * chapters 1–3 (fixture `chapter-four-town`, winter 1368), game commands only: two weaver's houses by the storehouse.
 * Then the world runs: the reorganisation begins, the neighbours call for hands, the looms make a textile street, the
 * alehouses fill, the petitions surge and the craftsmen ask for a guild — the first decision, answered by one command
 * (the guild granted): it stands with a head of the town's own. No state is edited between the commands.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { GUILD_CHARTER_PETITION_ID } from "../src/content/reorganisationConfig";
import type { GameState } from "../src/engine/engine.types";
import { openPetitions } from "../src/engine/politics";
import { guildOf, reorganisationForecast } from "../src/engine/reorganisation";
import { advanceTick } from "../src/engine/tick";
import { gameReducer } from "../src/state/gameStore";
import { clothTown, placeNear } from "./helpers/clothTown";

test("humanPath chapter 4: two weaver's houses (commands) bring the textile street, the petitions and the guild's demand — the first decision — within five years; granting it founds the guild", () => {
  let state: GameState = clothTown();
  const store = state.buildings.filter(building => building.kind === "storehouse").sort((a, b) => a.id.localeCompare(b.id))[0]!;
  state = placeNear(placeNear(state, "weaver_house", store), "weaver_house", store);
  const start = state.tick;
  const seen: Record<string, number> = {};
  for (let step = 0; step < 20_000 && openPetitions(state).every(petition => petition.defId !== GUILD_CHARTER_PETITION_ID); step += 1) {
    state = advanceTick(state);
    for (const entry of reorganisationForecast(state)) if (entry.state === "done" && seen[entry.id] === undefined) seen[entry.id] = state.tick;
  }
  const demand = openPetitions(state).find(petition => petition.defId === GUILD_CHARTER_PETITION_ID);
  assert.ok(demand !== undefined, "the craftsmen asked");
  assert.ok(state.tick - start <= 20_000, `the first decision ${state.tick - start} ticks after the commands`);
  assert.deepEqual(Object.keys(seen), ["wage_competition", "textile_street", "alehouse_boom", "petitions_surge", "guild_demand"]);
  assert.ok(seen.wage_competition! < seen.textile_street! && seen.textile_street! <= seen.alehouse_boom! && seen.alehouse_boom! < seen.petitions_surge!
    && seen.petitions_surge! < seen.guild_demand!, JSON.stringify(seen));
  state = gameReducer(state, { type: "petition_response", petitionId: demand.id, response: "accept" });
  const guild = guildOf(state);
  assert.ok(guild !== null && guild.headId !== null && state.persons!.people.some(person => person.id === guild.headId), "the guild and its head");
  // FIX-9: the ledger remembers the guild at the command, once.
  assert.equal(state.history!.records.filter(record => record.template === "reorg.guild_founded").length, 1);
  assert.equal(advanceTick(state).history!.records.filter(record => record.template === "reorg.guild_founded").length, 1);
});
