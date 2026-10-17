// VIS-1 judgement (LS1-9 follow-up, the user 2026-10-16): the story rail read off the harness's told log
// (scripts/visibleChangeRun.mjs writes it as rail.json) — the rail's flickers told apart from its real changes. A flicker:
// the rail changes and is the very set it was before within FLICKER_TICKS (render-VIS-ls19-5ade799: six, each right
// after a completion toast — the presentation clock's stale start). Its chips' leaving and coming back count neither as
// the year's results chip pushed off nor as a chip seen again.
//   node scripts/visibleChangeRail.mjs <visible-change dir>   (prints the report)
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const FLICKER_TICKS = 10;
const YEAR_TICKS = 4000;
const SAME_COMMIT_MS = 5;
// The chips held on the rail until answered or past (heldChipIds) and the house card's: they may push the results chip.
const HELD = ['held:', 'registry:', 'home-petition:', 'petition:', 'famine:', 'audit:', 'estate-petition:', 'marriage-decision:', 'suit-defence:', 'entry-threat:', 'house:'];
const yearOf = tick => 1300 + Math.floor(tick / YEAR_TICKS);

/** The rail's changes: the told log's chip entries grouped into the commits that made them (same tick, within 5 ms). */
function railChanges(told) {
  // A chip lit or its words changed in place (LS1-13) is no change of the rail.
  const chips = told.filter(entry => String(entry.cls).startsWith('event-chip') && typeof entry.id === 'string' && entry.fresh !== true && entry.changed !== true);
  const changes = [];
  for (const entry of chips) {
    const last = changes.at(-1);
    if (last !== undefined && last.tick === entry.tick && entry.at - last.lastAt <= SAME_COMMIT_MS) { last.entries.push(entry); last.lastAt = entry.at; }
    else changes.push({ tick: entry.tick, lastAt: entry.at, entries: [entry] });
  }
  const rail = new Set();
  return changes.map(change => {
    const before = [...rail].sort();
    for (const entry of change.entries) { if (entry.gone) rail.delete(entry.id); else rail.add(entry.id); }
    return { tick: change.tick, before, after: [...rail].sort(), entries: change.entries };
  });
}

export function railReport(told) {
  const changes = railChanges(told);
  const same = (a, b) => a.length === b.length && a.every((id, index) => id === b[index]);
  const inFlicker = new Set();
  const flickers = [];
  for (let index = 0; index < changes.length; index += 1) {
    const start = changes[index];
    if (same(start.before, start.after)) continue;
    for (let end = index + 1; end < changes.length && changes[end].tick - start.tick <= FLICKER_TICKS; end += 1) {
      if (!same(changes[end].after, start.before)) continue;
      flickers.push({ tick: start.tick, back: changes[end].tick, rail: start.before, shown: start.after });
      for (let k = index; k <= end; k += 1) inFlicker.add(k);
      index = end;
      break;
    }
  }
  // The year's results chip leaving the rail as other chips come, outside a flicker: by plain chips or held ones.
  const pushed = { plain: [], held: [] };
  const lastGone = new Map();
  const seenAgain = [];
  changes.forEach((change, index) => {
    const flicker = inFlicker.has(index);
    const results = change.entries.find(entry => entry.gone && entry.id.startsWith('results:') && Number(entry.id.split(':')[1]) === yearOf(entry.tick));
    const came = change.entries.filter(entry => !entry.gone && !change.entries.some(other => other.gone && other.id === entry.id) && !entry.id.startsWith('results:'));
    if (!flicker && results !== undefined && !change.after.includes(results.id) && came.length > 0)
      (came.every(entry => HELD.some(prefix => entry.id.startsWith(prefix))) ? pushed.held : pushed.plain).push({ tick: change.tick, by: came.map(entry => entry.id) });
    // A flicker's leaving and coming back are not the chips' own: a chip's time off the rail runs from its real leaving.
    if (flicker) return;
    for (const entry of change.entries) {
      if (entry.gone) { lastGone.set(entry.id, entry.tick); continue; }
      const gone = lastGone.get(entry.id);
      if (!flicker && gone !== undefined && entry.tick - gone > YEAR_TICKS) seenAgain.push({ id: entry.id, tick: entry.tick, goneAt: gone });
      lastGone.delete(entry.id);
    }
  });
  // The town's requests come back under one id by design (a kind's request is remade each week, lordCardsModel): counted
  // apart until the screen tells a returning one as new (v1.1 §7 item 7).
  const townRequest = entry => entry.id.startsWith('lord-request:');
  // A kind's chip (LS1-13: one id for the kind's held decisions) gone a season and back is a new chip: counted apart.
  const heldKind = entry => entry.id.startsWith('held:');
  return { flickers: flickers.length, resultsPushedByPlain: pushed.plain.length, resultsPushedByHeld: pushed.held.length,
    seenAgainAfterAYear: seenAgain.filter(entry => !townRequest(entry) && !heldKind(entry)).length, townRequestsSeenAgain: seenAgain.filter(townRequest).length,
    heldKindsBack: seenAgain.filter(heldKind).length,
    flickerList: flickers, pushed, seenAgain };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const report = railReport(JSON.parse(readFileSync(join(process.argv[2], 'told.json'), 'utf8')));
  console.log(JSON.stringify(report, null, 1));
}
