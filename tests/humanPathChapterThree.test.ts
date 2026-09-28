/**
 * F3-A human path (PL-1, PL-2, PL-6): chapter 3 to its first decision as a player meets it — the walled town of the
 * fixture at the end of chapter 2 (winter 1347, before the collapse era), left to run: the era comes by the calendar,
 * the harbour fever's rumour, the pestilence and the priest's death; the player answers the parish with one game
 * command (the monastery), and the monastery's priest comes. No state is edited once the world runs.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { VACANT_PRIEST_PETITION_ID } from "../src/content/plagueConfig";
import type { GameState } from "../src/engine/engine.types";
import { curacyVacant } from "../src/engine/plague";
import { openPetitions } from "../src/engine/politics";
import { advanceTick } from "../src/engine/tick";
import { gameReducer } from "../src/state/gameStore";
import { PLAGUE_ERA_TICK, plagueTown } from "./helpers/plagueTown";

test("humanPath chapter 3: from the end of chapter 2 the calendar brings the rumour, the pestilence and the priest's death; one command answers the parish and its priest comes", () => {
  const town = plagueTown();
  // The same town a season before the collapse era, the era not yet entered (the calendar enters it).
  let state: GameState = { ...town, tick: PLAGUE_ERA_TICK - 1000, historicalEras: town.historicalEras!.filter(entry => entry.id !== "collapse") };
  const seen: Record<string, number> = {};
  const note = (key: string, now: boolean) => { if (now && seen[key] === undefined) seen[key] = state.tick; };
  let answered = false;
  for (let step = 0; step < 7000 && seen.priest === undefined; step += 1) {
    state = advanceTick(state);
    note("era", (state.historicalEras ?? []).some(entry => entry.id === "collapse"));
    note("rumour", state.plague?.rumourTick !== undefined);
    note("arrival", state.plague?.first !== undefined);
    note("dead", (state.plague?.first?.dead ?? 0) > 0);
    const ask = openPetitions(state).find(petition => petition.defId === VACANT_PRIEST_PETITION_ID);
    note("asked", ask !== undefined);
    if (ask !== undefined && !answered) {
      // The player's card: ask the monastery for a priest.
      state = gameReducer(state, { type: "petition_response", petitionId: ask.id, response: "accept" });
      answered = true;
      note("answered", true);
    }
    note("priest", answered && !curacyVacant(state));
  }
  assert.deepEqual(Object.keys(seen).sort(), ["answered", "arrival", "asked", "dead", "era", "priest", "rumour"]);
  assert.ok(seen.era! <= seen.rumour! && seen.rumour! < seen.arrival! && seen.arrival! <= seen.asked! && seen.asked! < seen.dead!, JSON.stringify(seen));
  // The decision is on the ledger with its forecast (the monastery's stipend), and the priest came two seasons on.
  const decision = (state.history?.records ?? []).find(record => record.template === "decision.petition_response" && record.params?.defId === VACANT_PRIEST_PETITION_ID)!;
  assert.equal(decision.decision!.chosen, "accept");
  assert.deepEqual(decision.decision!.alternatives, ["refuse"]);
  assert.ok(seen.priest! - seen.answered! <= 2000, JSON.stringify(seen));
});
