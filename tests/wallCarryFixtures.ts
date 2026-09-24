import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import type { GameState } from '../src/engine/engine.types';

type PlaySnapshot = Readonly<{ game: Readonly<{ state: GameState }> }>;

function naturalState(name: string): GameState {
  const bytes = readFileSync(new URL(`./fixtures/wall/${name}.json.gz`, import.meta.url));
  const snapshot: PlaySnapshot = JSON.parse(gunzipSync(bytes).toString('utf8'));
  return snapshot.game.state;
}

export const beforePalisadeProclamation = (): GameState => naturalState('a4-pre-proclaim-minute-025');
export const afterPalisadeProclamation = (): GameState => naturalState('a4-full2-minute-035');
