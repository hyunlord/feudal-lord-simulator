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
// UX-3R2 (scripts/ux3r2Verification.sh): zone undo / redo / right-click erase, ledger highlight and slot inspector,
// road click-click, tablet ✓ — present only in that suite's folder.
const r2 = read('ux3r2/ux3r2-captures.json');
const cells = zones => (zones ?? []).reduce((sum, [, count]) => sum + count, 0);
const gates = {
  hudArea: hud?.pass === true,
  tutorial13: tutorial?.allSteps === true && tutorial.locksMatch === true && tutorial.presses === tutorialBase?.presses,
  touchTargets: touch !== null && touch.summary.smallTargets === 0 && touch.summary.smallText === 0,
  inputReplay: input !== null && input.identical === input.of,
  touchReplay: touchReplay !== null && touchReplay.identical === touchReplay.of,
  gamepad: gamepad?.pass === true,
  focusReturn: focus.length === 4 && focus.every(row => row.roadArmedByE && row.focusAfter.startsWith('BODY')),
  ...(r2 === null ? {} : {
    zoneUndoRedo: cells(r2.zone.painted) > 0 && cells(r2.zone.undone) === 0 && cells(r2.zone.redone) === cells(r2.zone.painted) && cells(r2.zone.erasedByRightClick) < cells(r2.zone.painted),
    storeLedger: r2.store.cards.granary !== undefined && r2.store.cards.storehouse !== undefined && r2.store.lit.length === 1 && r2.store.slot !== null,
    roadClickClick: r2.road.afterAnchor === r2.road.before && r2.road.afterSecond > r2.road.before && r2.road.chainEndedByEnter,
    tabletConfirm: r2.tablet.bar && r2.tablet.afterLift === r2.tablet.before && r2.tablet.afterConfirm === r2.tablet.before + 1
      && r2.tablet.siteTile?.tx === r2.tablet.target.tx && r2.tablet.siteTile?.ty === r2.tablet.target.ty,
    noPageErrors: r2.errors.length === 0,
  }),
};
const detail = { tutorialPresses: [tutorial?.presses, tutorialBase?.presses], input: [input?.identical, input?.of], touchReplay: [touchReplay?.identical, touchReplay?.of] };
writeFileSync(join(dir, 'gates.json'), JSON.stringify({ pass: Object.values(gates).every(Boolean), gates, detail }, null, 1) + '\n');
console.log(JSON.stringify({ gates, detail }));
process.exitCode = Object.values(gates).every(Boolean) ? 0 : 1;
