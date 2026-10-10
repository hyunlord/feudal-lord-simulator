import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { MICHAELMAS_IN_YEAR } from '../src/content/stewardshipConfig';
import { advanceSeasons, initialSeasonState } from '../src/engine/seasonPressure';
import { advanceStewardship, stewardshipOf } from '../src/engine/stewardship';
import { gameReducer } from '../src/state/gameStore';
import { decodeSave, encodeSave } from '../src/save/saveCodec';
import { delegated, transition } from '../tests/helpers/engineBTlinkFixtures';

/** Bounded display fixture: real answer and seasonal handlers, not a natural-play run. */
export function standingBrowserFixture() {
  const base = delegated();
  assert.ok(base.estates);
  const prepared = { ...base, estates: { ...base.estates, estates: base.estates.estates.map(estate => ({ ...estate, annualValue: 4000 })) },
    stewardship: { ...stewardshipOf(base), petitions: [], stewards: stewardshipOf(base).stewards.map(row => ({ ...row, ability: 100, loyalty: 100 })),
      audits: [{ id: 'surface-audit', estateId: 'delegated-estate', stewardId: 'current', tick: 1000, deadline: 2000,
        mode: 'accounts' as const, revealedKept: 0, revealedErrors: 160, hidden: 0, status: 'pending' as const }] } };
  const initial = { ...prepared, seasons: initialSeasonState(prepared) };
  const tolerated = gameReducer(initial, { type: 'answer_audit', auditId: 'surface-audit', choice: 'tolerate' });
  assert.equal(stewardshipOf(tolerated).audits[0]?.status, 'tolerated');
  const season = transition(tolerated, 2000, advanceSeasons).after;
  const paid = transition(season, 2000, advanceStewardship).after;
  const audited = transition(paid, MICHAELMAS_IN_YEAR, advanceStewardship).after;
  const state = transition(audited, 3000, advanceSeasons).after;
  const autoAudit = stewardshipOf(state).audits.find(row => row.decidedBy === 'steward');
  assert.ok(autoAudit, 'real Michaelmas audit must follow standing policy');
  const losses = stewardshipOf(state).summaries.flatMap(row => row.tick === 2000 ? row.toleratedLosses ?? [] : []);
  assert.ok(losses.length > 0);
  const save = encodeSave({ state, createdAt: '2026-10-12T00:00:00Z', savedAt: '2026-10-12T00:00:00Z' });
  const restored = decodeSave(save.bytes).envelope.state;
  assert.deepEqual(restored.stewardship, state.stewardship);
  return { state: restored, beforeClose: { ...audited, tick: 2999 }, save: save.bytes, key: 'audit:delegated-estate:current', auditId: autoAudit.id,
    loss: losses.reduce((sum, row) => sum + row.amount, 0), start: 2000 };
}

/** Same-tick tenure regression snapshot, produced by the real oversight commands. */
export function supersededAuditFixture() {
  const initial = standingBrowserFixture().state;
  const own = stewardshipOf(initial), record = own.stewards[0], person = initial.estates?.people[0];
  assert.ok(record && person && initial.estates);
  const pending = { ...own.audits[0]!, id: 'old-tenure-audit', tick: initial.tick, deadline: initial.tick + 500,
    status: 'pending' as const, decidedBy: undefined, policyAuditId: undefined };
  const { decidedBy: _by, policyAuditId: _policy, ...audit } = pending;
  const prepared = { ...initial, estates: { ...initial.estates, people: [...initial.estates.people, { ...person, id: 'replacement' }] },
    stewardship: { ...own, audits: [...own.audits, audit], stewards: [...own.stewards,
      { ...record, personId: 'replacement', status: 'candidate' as const }] } };
  const away = gameReducer(prepared, { type: 'set_estate_oversight', estateId: record.estateId, mode: 'steward', stewardId: 'replacement' });
  const state = gameReducer(away, { type: 'set_estate_oversight', estateId: record.estateId, mode: 'steward', stewardId: record.personId });
  assert.equal(stewardshipOf(state).audits.find(row => row.id === audit.id)?.superseded, true);
  return encodeSave({ state, createdAt: '2026-10-12T00:00:00Z', savedAt: '2026-10-12T00:00:00Z' }).bytes;
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const output = process.argv[2];
  assert.ok(output, 'usage: node --import tsx scripts/engineBStandingFixture.ts OUTPUT.save.json');
  if (process.argv[3] === '--superseded') {
    writeFileSync(output, supersededAuditFixture(), { flag: 'wx' });
    console.log(JSON.stringify({ output, superseded: true }));
  } else {
  const fixture = standingBrowserFixture();
  writeFileSync(output, fixture.save, { flag: 'wx' });
  console.log(JSON.stringify({ output, bytes: fixture.save.length, tick: fixture.state.tick, loss: fixture.loss, auditId: fixture.auditId }));
  }
}
