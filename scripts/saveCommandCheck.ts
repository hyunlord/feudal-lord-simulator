// FIX-17 gate: a command applied to a save — whether the state changed, and the serving steward of an estate after it.
//   tsx scripts/saveCommandCheck.ts <save.json> '<command JSON>' [estateId]
import { readFileSync } from "node:fs";
import type { GameState } from "../src/engine/engine.types";
import { stewardshipOf } from "../src/engine/stewardship";
import { decodeSave } from "../src/save/saveCodec";
import { gameReducer } from "../src/state/gameStore";
import type { GameAction } from "../src/state/gameStore.types";

const [path, commandJson, estateId] = process.argv.slice(2);
const state = decodeSave(new Uint8Array(readFileSync(path!))).envelope.state as GameState;
const next = gameReducer(state, JSON.parse(commandJson!) as GameAction);
const serving = (current: GameState) => estateId === undefined ? null : stewardshipOf(current).oversight.find(entry => entry.estateId === estateId)?.stewardId ?? null;
const person = (current: GameState, id: string | null) => current.estates?.people.find(entry => entry.id === id);
process.stdout.write(`${JSON.stringify({ path, changed: next !== state, before: serving(state), after: serving(next),
  afterAlive: person(next, serving(next))?.alive ?? null })}\n`);
