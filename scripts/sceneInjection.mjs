// RES-REG (code review): the one way a script puts a state into the game. The UI-KIT-1 chronicle captures read the seed 1
// determinism town (a bare GameState written before v12: no eras, seasons or persons) straight into the game, so its
// first tick entered all five eras at once in 1469. Now every scene starts from admitSceneState:
//  - an envelope (encodeSave, or a file with schemaVersion) is decoded by decodeSave: checksum, the migration chain from
//    its own schema, validation;
//  - a bare state is taken only when the chain has nothing left to add: every key of today's new game, and after tick 0
//    every key the chain writes that the first tick also writes (eras, seasons, events, persons). An older one throws
//    (name StaleSceneStateError): read the file with loadSaveFile (scripts/loadSaveFile.ts), which runs the chain.
// It never changes a state it admits. The page gets this function's source inlined into gameStore.ts with the codec
// imported from /src (present in every build, the trunk before included); tsx scripts and tests call it through
// scripts/sceneState.ts. tests/sceneStateGuard.test.ts fails when a script replaces the store's state another way.
export const GAME_STORE_ROUTE = '**/src/state/gameStore.ts*';
const ANCHOR = 'useState(DEFAULT_GAME_STATE)';

/** The keys a bare state lacks that a state of today's schema carries (empty: it is current). No free variables. */
export function staleStateKeys(state, newGame, codec) {
  const missing = Object.keys(newGame).filter(key => !(key in state));
  // Older than today's new game: refused without running the chain (in the page, v9 -> v10 reads Node's process).
  if (missing.length > 0 || typeof state.tick !== 'number' || state.tick <= newGame.tick) return missing;
  const firstTick = new Set(Object.keys(codec.advanceTick(structuredClone(newGame))));
  // A bare file counts as schema v0 to the codec, so the chain shows what an older state still misses.
  const migrated = codec.migrateSaveToLatest(structuredClone(state)).value.state;
  return [...missing, ...Object.keys(migrated).filter(key => !(key in state) && firstTick.has(key))];
}

/** The state a scene starts from. `codec`: decodeSave, assertGameStateSnapshot, migrateSaveToLatest, advanceTick, staleStateKeys. */
export function admitSceneState(input, newGame, codec) {
  if (typeof input !== 'object' || input === null) throw new Error('Scene state is not an object');
  if (typeof input.schemaVersion === 'number' && 'state' in input) return codec.decodeSave(new TextEncoder().encode(JSON.stringify(input))).envelope.state;
  const stale = codec.staleStateKeys(input, newGame, codec);
  if (stale.length > 0) {
    const error = new Error(`StaleSceneStateError: scene state is an old bare save (no ${stale.join(', ')}): read it with loadSaveFile, which runs the migration chain`);
    error.name = 'StaleSceneStateError';
    throw error;
  }
  codec.assertGameStateSnapshot(input);
  return input;
}

/** gameStore.ts as served, starting from admitSceneState(`stateJson`) (a JSON text: a bare state or a save envelope). */
export function injectSceneState(moduleText, stateJson) {
  if (!moduleText.includes(ANCHOR)) throw new Error('State injection anchor changed');
  const prelude = [
    'import { decodeSave as __decodeSave, assertGameStateSnapshot as __assertSnapshot } from "/src/save/saveCodec.ts";',
    'import { migrateSaveToLatest as __migrate } from "/src/save/migrations/index.ts";',
    'import { advanceTick as __advanceTick } from "/src/engine/tick.ts";',
    `const __staleStateKeys = ${staleStateKeys.toString()};`,
    `const __admitSceneState = ${admitSceneState.toString()};`,
    'const __codec = { decodeSave: __decodeSave, assertGameStateSnapshot: __assertSnapshot, migrateSaveToLatest: __migrate, advanceTick: __advanceTick, staleStateKeys: __staleStateKeys };',
  ].join('\n');
  return `${prelude}\n${moduleText.replace(ANCHOR, `useState(() => __admitSceneState(${stateJson}, DEFAULT_GAME_STATE, __codec))`)}`;
}

/** Routes the page's gameStore.ts through injectSceneState. */
export async function routeSceneState(page, state) {
  const stateJson = typeof state === 'string' ? state : JSON.stringify(state);
  await page.route(GAME_STORE_ROUTE, async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: injectSceneState(await response.text(), stateJson) });
  });
}

/** Never resolves; rejects as soon as the page refuses its scene state (race it with the wait for the app). Attach it
 * before the page loads. React reports the store's throw as a page error and on the console; either one counts. */
export function sceneStateRefusal(page) {
  const refused = new Promise((_resolve, reject) => {
    const refuse = text => { if (text.includes('StaleSceneStateError')) reject(new Error(text.slice(0, 400))); };
    page.on('pageerror', error => refuse(String(error)));
    page.on('console', message => { if (message.type() === 'error') refuse(message.text()); });
  });
  refused.catch(() => undefined); // a caller that never races it must not see an unhandled rejection
  return refused;
}
