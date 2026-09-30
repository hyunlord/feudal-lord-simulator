// UI-10 gate saves (spec docs/design/chapter-five-legacy.md LG-7, LG-8; scenario L9): six save files, one per ending —
// the chapter-5 town (tests/helpers/legacyTown.ts) carried 1384→1450 with each of L9's answer sets
// (tests/helpers/legacyEndings.ts), a little past the last market day so the campaign is won (L10). Loaded, each opens
// chapter 5's page and from it the legacy verdict and that ending: the captures of the six ending screens start here.
//   tsx scripts/ui10EndingSaves.ts <directory>      writes ui10-ending-<ending id>.save.json there, prints one line each
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { LEGACY_ENDING_IDS } from "../src/content/legacyConfig";
import { legacyEnding } from "../src/engine/legacy";
import { encodeSave } from "../src/save/saveCodec";
import { LEGACY_ENDING_ANSWERS, throughLegacy } from "../tests/helpers/legacyEndings";
import { legacyTown, runAnswering } from "../tests/helpers/legacyTown";
import { refuseHeavyOnMac } from "./remote/localGuard.mjs";

refuseHeavyOnMac("엔진 1384→1450 여섯 번(scripts/ui10EndingSaves.ts)", { remote: "scripts/remote/run.sh <세션>-<작업ID> -- node_modules/.bin/tsx scripts/ui10EndingSaves.ts <디렉터리>", entry: import.meta.url });

/** Ticks past the last market day: the campaign's victory is written after it (L10). */
const AFTER_LAST_MARKET = 60;

const directory = process.argv[2];
if (directory === undefined) throw new Error("usage: tsx scripts/ui10EndingSaves.ts <directory>");
mkdirSync(directory, { recursive: true });
const start = legacyTown();
const savedAt = new Date().toISOString();
for (const id of LEGACY_ENDING_IDS) {
  const last = throughLegacy(start, LEGACY_ENDING_ANSWERS[id]);
  const state = runAnswering(last, last.tick + AFTER_LAST_MARKET, {});
  const ending = legacyEnding(state);
  if (ending?.id !== id || !ending.final) throw new Error(`${id}: the answers ended ${ending?.id ?? "nowhere"} (final ${ending?.final ?? false})`);
  if (state.settlement?.outcome !== "victory") throw new Error(`${id}: the campaign is not won (${state.settlement?.outcome ?? "no outcome"})`);
  const encoded = encodeSave({ state, createdAt: savedAt, savedAt });
  const file = join(directory, `ui10-ending-${id}.save.json`);
  writeFileSync(file, encoded.bytes);
  process.stdout.write(`${JSON.stringify({ ending: id, file, bytes: encoded.bytes.byteLength, tick: state.tick, outcome: state.settlement.outcome })}\n`);
}
