// NAT-2 (QA-009) capture states: Astra's chapter-5 town (fixture `chapter-five-town`, 1382) moved on the calendar to the
// interlude's two petitions (FIX-9 LG-13) — the guild's quarrel with the merchants (spring 1394) and the parish's nave
// (spring 1396) — each run one tick so the petition opens, as the tests carry the town (tests/helpers/legacyTown.ts).
// Their answers carry no forecast yet (the engine's share of QA-009), so the cards showed an empty prediction line.
// Written as save files (<name>.save.json) for scripts/nat2UiCaptures.ts, which loads them as a player does (이어하기).
//   tsx scripts/nat2UiStates.ts <out-dir>
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CHURCH_REBUILDING_PETITION_ID, GUILD_DISPUTE_PETITION_ID } from "../src/content/legacyConfig";
import type { GameState } from "../src/engine/engine.types";
import { openPetitions } from "../src/engine/politics";
import { decodeSave, encodeSave } from "../src/save/saveCodec";
import { at, movedTo, runAnswering } from "../tests/helpers/legacyTown";

const [out] = process.argv.slice(2);
mkdirSync(out!, { recursive: true });
const town = decodeSave(new Uint8Array(readFileSync("fixtures/saves/v32/chapter-five-town.save.json"))).envelope.state as GameState;
const opened = (state: GameState, defId: string, tick: number): GameState => {
  const next = runAnswering(movedTo(state, tick), tick + 1, {});
  if (!openPetitions(next).some(petition => petition.defId === defId)) throw new Error(`${defId} did not open at tick ${tick}`);
  return next;
};
const guild = opened(town, GUILD_DISPUTE_PETITION_ID, at(1394));
const answered = runAnswering(guild, guild.tick + 1, { [GUILD_DISPUTE_PETITION_ID]: "accept" });
const church = opened(answered, CHURCH_REBUILDING_PETITION_ID, at(1396));
for (const [name, state] of [["guild-dispute", guild], ["church-rebuilding", church]] as const) {
  const at = "2026-09-30T00:00:00.000Z";
  writeFileSync(join(out!, `${name}.save.json`), encodeSave({ state, createdAt: at, savedAt: at }).bytes);
  console.log(`${name}: tick ${state.tick}, petitions ${openPetitions(state).map(petition => petition.defId).join(", ")}`);
}
