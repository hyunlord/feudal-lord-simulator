// Prepared save-shape fixture, not a natural-play run. Run from the repository root.
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { delegated, transition } from '../../../tests/helpers/engineBTlinkFixtures';
import { gameReducer } from '../../../src/state/gameStore';
import { advanceStewardship } from '../../../src/engine/stewardship';
import { encodeSave } from '../../../src/save/saveCodec';
import type { GameState } from '../../../src/engine/engine.types';
const base = delegated();
assert.ok(base.stewardship && base.estates);
let state: GameState = { ...base, estates: { ...base.estates, estates: base.estates.estates.map(row => ({ ...row, annualValue: 4000 })) },
  stewardship: { ...base.stewardship, oversight: base.stewardship.oversight.map(row => ({ ...row, merchants: -100 })),
    stewards: base.stewardship.stewards.map(row => ({ ...row, loyalty: 100 })),
    petitions: [...base.stewardship.petitions, { id: 'inert-fixture-charter', estateId: 'delegated-estate', kind: 'charter_request', group: 'merchants', amount: 2,
      rights: true, marriage: false, tick: base.tick, deadline: 3000, status: 'open', escalated: 'rights' }],
    audits: [{ id: 'inert-fixture-audit', estateId: 'delegated-estate', stewardId: 'current', tick: base.tick, mode: 'accounts',
      revealedErrors: 32, revealedKept: 16, hidden: 0, status: 'pending', deadline: 3000 }] } };
state = gameReducer(state, { type: 'answer_estate_petition', petitionId: 'inert-fixture-charter', grant: false });
state = gameReducer(state, { type: 'answer_audit', auditId: 'inert-fixture-audit', choice: 'tolerate' });
state = transition(state, 2000, advanceStewardship).after;
assert.ok(state.stewardship?.summaries.at(-1)?.charterLoss);
assert.ok(state.stewardship?.summaries.at(-1)?.toleratedLosses?.length);
const saved = encodeSave({ state, createdAt: '2026-10-10T00:00:00.000Z', savedAt: '2026-10-10T00:00:00.000Z', gameVersion: '0.1.0+prepared-eb-inert-fixture' });
mkdirSync('fixtures/saves/v57', { recursive: true });
writeFileSync('fixtures/saves/v57/eb-inert-pressure.save.json', saved.bytes);
const manifestPath = 'fixtures/saves/v57/manifest.json';
const manifest: { schemaVersion: number; fixtures: { id: string; [key: string]: unknown }[]; v0Fixtures: string[] } =
  JSON.parse(readFileSync(manifestPath, 'utf8'));
manifest.fixtures = [...manifest.fixtures.filter(row => row.id !== 'eb-inert-pressure'), {
  id: 'eb-inert-pressure',
  description: 'Prepared saturated charter refusal and audit tolerance, answered by real reducers and advanced one stewardship season; active pressures and actual loss receipts.',
  file: 'eb-inert-pressure.save.json', bytes: saved.bytes.length, tick: state.tick,
  provenance: 'Synthetic test preconditions from tests/helpers/engineBTlinkFixtures.ts delegated(); not natural play. Reproduce with node --import tsx fixtures/saves/v57/prepare-eb-inert.ts.',
}];
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log({ bytes: saved.bytes.length, tick: state.tick });
