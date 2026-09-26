// UX-3: one verdict per gate from the result files scripts/ux3Verification.sh wrote (several replay scripts exit 0 and
// report their match count in the file, so the exit code alone is not the gate).
//   node scripts/ux3GateSummary.mjs docs/verification/ux3r
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const [dir] = process.argv.slice(2);
const read = file => existsSync(join(dir, file)) ? JSON.parse(readFileSync(join(dir, file), 'utf8')) : null;
const lines = file => existsSync(join(dir, file)) ? readFileSync(join(dir, file), 'utf8').split('\n').filter(line => line.startsWith('{')).map(line => JSON.parse(line)) : [];
const hud = read('hud-coverage.json');
const tutorial = read('replay/replay.json'); const tutorialBase = read('replay-base/replay.json');
const touch = read('touch-targets.json');
const input = read('input-replay.json'); const touchReplay = read('touch-replay.json');
const gamepad = read('gamepad/gamepad-replay.json');
const focus = lines('focus-return.log');
const gates = {
  hudArea: hud?.pass === true,
  tutorial13: tutorial?.allSteps === true && tutorial.locksMatch === true && tutorial.presses === tutorialBase?.presses,
  touchTargets: touch !== null && touch.summary.smallTargets === 0 && touch.summary.smallText === 0,
  inputReplay: input !== null && input.identical === input.of,
  touchReplay: touchReplay !== null && touchReplay.identical === touchReplay.of,
  gamepad: gamepad?.pass === true,
  focusReturn: focus.length === 4 && focus.every(row => row.roadArmedByE && row.focusAfter.startsWith('BODY')),
};
const detail = { tutorialPresses: [tutorial?.presses, tutorialBase?.presses], input: [input?.identical, input?.of], touchReplay: [touchReplay?.identical, touchReplay?.of] };
writeFileSync(join(dir, 'gates.json'), JSON.stringify({ pass: Object.values(gates).every(Boolean), gates, detail }, null, 1) + '\n');
console.log(JSON.stringify({ gates, detail }));
process.exitCode = Object.values(gates).every(Boolean) ? 0 : 1;
