import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { stripTypeScriptTypes } from 'node:module';
import { gunzipSync } from 'node:zlib';
import vm from 'node:vm';
import { HISTORICAL_SOURCE_PINS, generateHistoricalInstrumentation, stripHistoricalInstrumentation } from '../scripts/engineBHistoricalInstrumentation.mjs';
const sources = Object.fromEntries(Object.keys(HISTORICAL_SOURCE_PINS).map(path => [path, gunzipSync(readFileSync(new URL(`./fixtures/engineBHistorical/${path.split('/').at(-1)}.gz`, import.meta.url))).toString('utf8')]));

test('exact pinned historical sources round trip only declared insertions', () => {
  const result = generateHistoricalInstrumentation(sources);
  assert.equal(Object.keys(result.patched).length, 2);
  for (const [path, original] of Object.entries(sources)) {
    assert.equal(stripHistoricalInstrumentation(path, result.patched[path]), original);
    assert.notEqual(result.patched[path], original);
    assert.doesNotThrow(() => stripTypeScriptTypes(result.patched[path], { mode: 'transform' }));
  }
  assert.match(result.observerSource, /failures/);
});
test('wrong bytes, unknown files, forged tap edits and missing blocks fail closed', () => {
  assert.throws(() => generateHistoricalInstrumentation({ ...sources, 'src/engine/registry.ts': sources['src/engine/registry.ts'] + '\n' }));
  assert.throws(() => generateHistoricalInstrumentation({ ...sources, 'extra.ts': '' }));
  const result = generateHistoricalInstrumentation(sources);
  const path = 'src/engine/registryV4.ts';
  assert.throws(() => stripHistoricalInstrumentation(path, result.patched[path].replace('gate: "calendar"', 'gate: "forged"')));
  assert.throws(() => stripHistoricalInstrumentation(path, result.patched[path].replace('continue;', 'return;')));
  assert.throws(() => stripHistoricalInstrumentation(path, result.patched[path].replace('/* EB-HIST:import:BEGIN */', '/* missing */')));
});
test('observer scalar copies are synchronous, failure-isolated and never expose engine references', () => {
  const { observerSource } = generateHistoricalInstrumentation(sources);
  const compiled = stripTypeScriptTypes(observerSource).replace(/^export /gm, '');
  const api = vm.runInNewContext(compiled + '\n({registerHistoricalRegistryObserver,historicalTap,historicalRegistryObserverFailures})'); const state = { bound: { id: 'claim-1' }, tick: 1000 }; const original = JSON.stringify(state);
  let record; const remove = api.registerHistoricalRegistryObserver(value => { record = value; value.tick = 999; throw new Error('observer'); });
  api.historicalTap(() => ({ tick: state.tick, boundJson: JSON.stringify(state.bound), gate: 'accepted' }));
  assert.equal(JSON.stringify(state), original); assert.equal(record.boundJson, '{"id":"claim-1"}');
  assert.equal(api.historicalRegistryObserverFailures(), 1);
  api.historicalTap(() => { throw new Error('serialization'); });
  assert.equal(api.historicalRegistryObserverFailures(), 2);
  api.historicalTap(() => ({ bad: state })); assert.equal(api.historicalRegistryObserverFailures(), 3);
  remove(); let called = false; api.historicalTap(() => { called = true; return {}; }); assert.equal(called, false);
});


test('standalone generated observer passes strict TypeScript without historical/current engine imports', () => {
  const directory = mkdtempSync(join(tmpdir(), 'historical-observer-'));
  try {
    writeFileSync(join(directory, 'observer.ts'), generateHistoricalInstrumentation(sources).observerSource);
    writeFileSync(join(directory, 'tsconfig.json'), JSON.stringify({ compilerOptions: { strict: true, noEmit: true, target: 'ES2022', module: 'ESNext', types: [], skipLibCheck: true }, files: ['observer.ts'] }));
    execFileSync(new URL('../node_modules/.bin/tsc', import.meta.url).pathname, ['-p', join(directory, 'tsconfig.json')], { encoding: 'utf8' });
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

const generated = () => generateHistoricalInstrumentation(sources);
function functionSource(text, name, next) {
  const begin = text.indexOf(`function ${name}(`);
  const end = next ? text.indexOf(`function ${next}(`, begin + 1) : text.length;
  return stripTypeScriptTypes(text.slice(begin, end).replace(/export\s*$/, ''), { mode: 'transform' });
}
const plain = value => JSON.parse(JSON.stringify(value));
test('all candidate exits preserve original calls, arguments, selection and source objects with hostile observer', () => {
  const original = sources['src/engine/registryV4.ts']; const patched = generated().patched['src/engine/registryV4.ts'];
  const cases = ['support', 'calendar', 'once_or_pace', 'year_limit', 'gap', 'chance', 'chapter_prepare', 'binding_or_context', 'open_key', 'used_context', 'enabled_choices', 'accepted'];
  for (const gate of cases) {
    const run = text => {
      const calls = [], records = [];
      const entry = { id: 'entry', calendar: { yearMinInclusive: gate === 'calendar' ? 1400 : 1300, yearMaxInclusive: 1500, seasonIndices: [0] },
        recurrence: { mode: gate === 'once_or_pace' ? 'once_per_campaign' : 'new_context_only' },
        frequency: { maxPerYear: gate === 'year_limit' ? 0 : 3, minGapSeasons: 2, chancePermille: gate === 'chance' ? 0 : 1000, weight: 2 }, minimumEnabledConsequentialChoices: 2 };
      const state = { tick: 4000, seed: 1 }, past = ['gap', 'open_key', 'used_context'].includes(gate) ? [{ entryId: gate === 'gap' || gate === 'used_context' ? 'entry' : 'other', offeredTick: gate === 'gap' ? 3999 : 0, status: gate === 'used_context' ? 'answered' : 'offered', key: 'k', context: 'c' }] : [];
      const bound = { claim: { id: 'claim-1' } }, snapshot = JSON.stringify({ state, entry, past, bound });
      const wrap = (name, value) => (...args) => { calls.push([name, plain(args)]); return value; };
      const context = { ENTRIES: [entry], SUPPORT: new Map([['entry', { runs: gate !== 'support' }]]), YEAR: 4000, SEASON: 1000,
        stateCalendar: wrap('calendar', { year: 1301, season: 0 }), hashSeed: wrap('hash', 5), oneShotPacePermille: wrap('pace', gate === 'once_or_pace' ? 0 : 1000),
        registryChapterPetitionDef: wrap('chapterDef', gate === 'chapter_prepare' ? {} : undefined), prepareRegistryChapterPetition: wrap('prepare', null),
        bindEntry: wrap('bind', gate === 'binding_or_context' ? null : bound), dedupKey: wrap('dedup', 'k'), contextKey: wrap('context', gate === 'used_context' ? 'c' : 'different'),
        v4EnabledChoices: wrap('choices', gate === 'enabled_choices' ? ['a'] : ['a', 'b']),
        historicalTap: producer => { try { const record = producer(); records.push({ ...record }); record.entryId = 'tampered'; throw new Error('callback'); } catch {} } };
      const fn = vm.runInNewContext(functionSource(text, 'v4Candidates') + '\nv4Candidates', context);
      const result = plain(fn(state, past)); assert.equal(JSON.stringify({ state, entry, past, bound }), snapshot);
      return { calls, result, records };
    };
    const before = run(original), after = run(patched);
    assert.deepEqual(after.calls, before.calls, gate); assert.deepEqual(after.result, before.result, gate);
    assert.equal(after.records.at(-1)?.gate, gate);
  }
});

test('weighted v4 selection records initial pick and ranges without repeating PRNG or bound helpers', () => {
  const result = generated();
  const run = text => {
    const calls = [], records = [], state = { tick: 1000, seed: 1, registry: { occurrences: [] } };
    const candidate = (id, weight) => ({ entry: { id, frequency: { weight, chancePermille: 1000 } }, bound: { claim: { id: `claim-${id}` } }, draw: 4, key: id, context: id });
    const candidates = [candidate('b', 3), candidate('a', 2)];
    const context = { YEAR: 4000, MAX_OCCURRENCES_KEPT: 100, REGISTRY_EVENTS_PER_SEASON: 1, REGISTRY_EVENTS_PER_YEAR: 4, REGISTRY_ANSWER_TICKS: 100,
      registryOf: value => value.registry, seasonIndexOf: tick => tick / 1000, v4Candidates: () => { calls.push('candidates'); return candidates; },
      hashSeed: () => { calls.push('hash'); return 3; }, registryChapterPetitionDef: () => undefined,
      boundIdentities: bound => { calls.push('boundIdentities'); return { claim: bound.claim.id }; },
      layerOffer: (next, offer) => { calls.push('layerOffer'); return { next, offer }; },
      historicalTap: producer => { const value = producer(); records.push({ ...value }); value.initialPick = 999; } };
    const fn = vm.runInNewContext(functionSource(text, 'offerV4Season', 'layerOffer') + '\nofferV4Season', context);
    return { value: plain(fn(state)), calls, records };
  };
  const original = run(sources['src/engine/registry.ts']), patched = run(result.patched['src/engine/registry.ts']);
  assert.deepEqual(patched.value, original.value); assert.deepEqual(patched.calls, original.calls);
  const candidates = patched.records.filter(row => row.gate === 'ordered_candidate');
  assert.deepEqual(candidates.map(row => [row.entryId, row.rangeFrom, row.rangeTo, row.initialPick]), [['a', 0, 2, 3], ['b', 2, 5, 3]]);
  assert.equal(patched.records.find(row => row.gate === 'chosen').entryId, 'b');
  assert.equal(patched.records.at(-1).offeredId, patched.value.offer.id);
});

test('all layer return paths keep original engine calls and distinguish constructed from admitted offers', () => {
  const result = generated();
  for (const gate of ['unweighed_return', 'crowded_rejected', 'heavy_admitted', 'light_no_pick', 'light_unsettled', 'steward_answered']) {
    const run = text => {
      const calls = [], records = [], offer = { id: 'offer-1', entryId: 'entry' }, state = { tick: 1000, registry: { occurrences: [offer] } }, before = { tick: 1000 };
      const wrap = (name, value) => (...args) => { calls.push([name, plain(args)]); return value; };
      const answered = { ...state, registry: { occurrences: [{ ...offer, status: gate === 'light_unsettled' ? 'offered' : 'answered' }] } };
      const context = { DECISION_WEIGHT_BALANCE: { registryCrowded: 3 },
        weighOffer: wrap('weigh', gate === 'unweighed_return' ? null : { weights: ['crowded_rejected', 'heavy_admitted'].includes(gate) ? ['rights'] : [], choices: [] }),
        heavyLoad: wrap('heavyLoad', gate === 'crowded_rejected' ? 3 : 0), settleWeights: wrap('settleWeights', { result: 'settled' }),
        v4SenderFaction: wrap('sender', 'commons'), standingSetting: wrap('setting', 'customary'), treasuryBalance: wrap('treasury', 100),
        stewardPick: wrap('pick', gate === 'light_no_pick' ? null : 'a'), answerV4Offer: wrap('answer', answered), registryOf: value => value.registry,
        historicalTap: producer => { const record = producer(); records.push({ ...record }); record.offeredId = 'changed'; } };
      const fn = vm.runInNewContext(functionSource(text, 'layerOffer', 'settleWeights') + '\nlayerOffer', context);
      return { value: plain(fn(state, offer, before)), calls, records };
    };
    const original = run(sources['src/engine/registry.ts']), patched = run(result.patched['src/engine/registry.ts']);
    assert.deepEqual(patched.value, original.value, gate); assert.deepEqual(patched.calls, original.calls, gate);
    assert.equal(patched.records.at(-1).gate, gate);
  }
});

function compareRegistryFunction(name, next, setup) {
  const results = [sources['src/engine/registry.ts'], generated().patched['src/engine/registry.ts']].map(text => {
    const calls = [], records = [];
    const wrap = (label, value) => (...args) => { calls.push([label, plain(args)]); return value; };
    const { context, state } = setup(wrap);
    context.historicalTap = producer => records.push(plain(producer()));
    const fn = vm.runInNewContext(functionSource(text, name, next) + `\n${name}`, context);
    return { value: plain(fn(state)), calls, records };
  });
  assert.deepEqual(results[1].value, results[0].value); assert.deepEqual(results[1].calls, results[0].calls);
  return results[1].records;
}
test('V4 budget, empty candidate total and selected preparation exits preserve call order', () => {
  for (const gate of ['budget', 'no_weight', 'selected_prepare_null']) {
    const records = compareRegistryFunction('offerV4Season', 'layerOffer', wrap => {
      const state = { tick: 1000, seed: 1 }, candidate = { entry: { id: 'e', frequency: { weight: 1 } }, bound: {}, draw: 0, key: 'e', context: 'e' };
      return { state, context: { YEAR: 4000, REGISTRY_EVENTS_PER_SEASON: 1, REGISTRY_EVENTS_PER_YEAR: gate === 'budget' ? 0 : 4,
        registryOf: wrap('registry', { occurrences: [] }), seasonIndexOf: wrap('index', 1), v4Candidates: wrap('candidates', gate === 'no_weight' ? [] : [candidate]),
        hashSeed: wrap('hash', 0), registryChapterPetitionDef: wrap('chapter', {}), prepareRegistryChapterPetition: wrap('prepare', null) } };
    });
    assert.equal(records.at(-1).gate, gate);
  }
});
test('legacy weighted order, budget and empty exits preserve original results and calls', () => {
  for (const mode of ['chosen', 'budget', 'empty']) {
    const records = compareRegistryFunction('seasonDraw', 'offerV4Season', wrap => {
      const entry = (id, weight) => ({ id, kind: 'event', years: { fromYear: 1300, toYear: 1400 }, recurrence: { maxOccurrences: 10, mode: 'cooldown', cooldownSeasons: 0 }, frequency: { maxPerYear: 2, minGapSeasons: 0, chancePermille: 1000, weight } });
      return { state: { tick: 1000, seed: 1 }, context: { YEAR: 4000, SEASON: 1000, REGISTRY_EVENTS_PER_SEASON: 1, REGISTRY_EVENTS_PER_YEAR: mode === 'budget' ? 0 : 4,
        registryOf: wrap('registry', { occurrences: [] }), stateCalendar: wrap('calendar', { year: 1300 }), seasonIndexOf: wrap('index', 1),
        registryEntries: wrap('entries', mode === 'empty' ? [] : [entry('b', 3), entry('a', 2)]), boundTargets: wrap('targets', ['']), conditionHolds: wrap('condition', true), hashSeed: wrap('hash', 3) } };
    });
    assert.equal(records.at(-1).gate, mode === 'chosen' ? 'chosen' : 'budget_or_empty');
    if (mode === 'chosen') assert.deepEqual(records.filter(row => row.gate === 'ordered_candidate').map(row => [row.entryId, row.rangeFrom, row.rangeTo, row.initialPick]), [['a', 0, 2, 3], ['b', 2, 5, 3]]);
  }
});
test('legacy suppression is recorded even when selected legacy choices prevent actual offering', () => {
  for (const mode of ['v4', 'disabled', 'offered']) {
    const records = compareRegistryFunction('offerSeason', 'advanceRegistry', wrap => {
      const candidate = { entry: { id: 'legacy', frequency: { chancePermille: 1000 } }, boundId: 'bound', draw: 4, conditions: [] };
      return { state: { tick: 1000 }, context: { MAX_OCCURRENCES_KEPT: 100, REGISTRY_ANSWER_TICKS: 100,
        seasonDraw: wrap('seasonDraw', mode === 'v4' ? [] : [candidate]), offerV4Season: wrap('offerV4Season', { v4: true }), registryOf: wrap('registry', { occurrences: [] }),
        seasonIndexOf: wrap('index', 1), enabledChoices: wrap('choices', mode === 'disabled' ? [] : ['a', 'b']) } };
    });
    assert.deepEqual(records.map(row => row.gate), mode === 'v4' ? [] : mode === 'disabled' ? ['legacy_suppressed'] : ['legacy_suppressed', 'constructed_offer']);
  }
});
