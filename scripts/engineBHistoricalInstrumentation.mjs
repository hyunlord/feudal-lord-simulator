import { createHash } from 'node:crypto';
export const HISTORICAL_REVISION = '56ee1d9d8259f89e6122153cedd82e783a74f5c7';
export const HISTORICAL_SOURCE_PINS = Object.freeze({
  'src/engine/registryV4.ts': 'a2f9b9fc60e0281d5bce348d644da012a2c51f533f94f17f1170d64d939481bf',
  'src/engine/registry.ts': '6e39a0ca4ccee233ac450ca680660eeab29c920d9ca8e50c60956a4ea83a2e6d',
});
export const HISTORICAL_OBSERVER_PATH = 'src/engine/historicalRegistryObserver.ts';
const sha = text => createHash('sha256').update(text).digest('hex');
const block = (id, text) => `/* EB-HIST:${id}:BEGIN */${text}/* EB-HIST:${id}:END */`;
const check = (condition, message) => { if (!condition) throw new Error(`Historical instrumentation: ${message}`); };
const observerSource = `// Isolated historical replay instrumentation. Never imported by current gameplay.
export type HistoricalScalar = string | number | boolean | null;
export type HistoricalRecord = Readonly<Record<string, HistoricalScalar>>;
let observer: ((record: HistoricalRecord) => void) | undefined;
let failures = 0;
export function registerHistoricalRegistryObserver(callback: (record: HistoricalRecord) => void): () => void {
  if (observer !== undefined) throw new Error("Historical observer already registered");
  observer = callback; failures = 0;
  return () => { if (observer === callback) observer = undefined; };
}
export function historicalRegistryObserverFailures(): number { return failures; }
export function historicalTap(produce: () => HistoricalRecord): void {
  if (observer === undefined) return;
  try {
    const record = produce();
    if (Object.values(record).some(value => value !== null && typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean")) throw new Error("Non-scalar historical record");
    if (Object.values(record).some(value => typeof value === "number" && !Number.isFinite(value))) throw new Error("Non-finite historical scalar");
    observer({ ...record });
  } catch { failures += 1; }
}
`;
function edit(source, anchor, transform) {
  check(source.split(anchor).length === 2, `anchor must occur exactly once: ${anchor}`);
  return source.replace(anchor, transform(anchor));
}
function before(source, id, anchor, code) { return edit(source, anchor, value => block(id, code) + value); }
function branch(source, id, anchor, statement, fields) {
  return edit(source, anchor, value => {
    check(value.split(statement).length === 2, `statement anchor not unique: ${id}`);
    return value.replace(statement, block(`${id}-open`, `{ historicalTap(() => ({ ${fields} })); `) + statement + block(`${id}-close`, ' }'));
  });
}
const tap = fields => `historicalTap(() => ({ ${fields} }));\n`;
function patchV4(original) {
  let source = original;
  const gates = [
    ['support', '    if (SUPPORT.get(entry.id)?.runs !== true) continue;'],
    ['calendar', '    if (year < entry.calendar.yearMinInclusive || year > entry.calendar.yearMaxInclusive || !entry.calendar.seasonIndices.includes(season)) continue;'],
    ['once_or_pace', '    if (entry.recurrence.mode === "once_per_campaign" && (own.length > 0 || !oneShotsOpen)) continue;'],
    ['year_limit', '    if (own.filter(occurrence => thisYear.includes(occurrence)).length >= entry.frequency.maxPerYear) continue;'],
    ['gap', '    if (last !== undefined && index - Math.floor(last.offeredTick / SEASON) < gap) continue;'],
    ['chance', '    if (draw >= entry.frequency.chancePermille) continue;'],
    ['chapter_prepare', '    if (candidateState === null) continue;'],
    ['binding_or_context', '    if (bound === null) continue;'],
    ['open_key', '    if (past.some(occurrence => occurrence.status === "offered" && occurrence.key === key)) continue;'],
    ['used_context', '    if (entry.recurrence.mode === "new_context_only" && own.some(occurrence => occurrence.context === context)) continue;'],
    ['enabled_choices', '    if (v4EnabledChoices(candidateState, entry, bound).length < entry.minimumEnabledConsequentialChoices) continue;'],
  ];
  for (const [position, [gate, anchor]] of gates.entries()) {
    const extra = `, year, season, yearMin: entry.calendar.yearMinInclusive, yearMax: entry.calendar.yearMaxInclusive, chancePermille: entry.frequency.chancePermille, draw: ${position >= 5 ? 'draw' : 'null'}, ownCount: ${position >= 2 ? 'own.length' : 'null'}, key: ${position >= 8 ? 'key' : 'null'}, context: ${position >= 8 ? 'context' : 'null'}, boundJson: ${position >= 8 ? 'JSON.stringify(bound)' : 'null'}, enabledChoicesObserved: false, choiceEvaluationReached: ${position >= 10}${gate === 'once_or_pace' ? ', alreadyUsed: own.length > 0, oneShotsOpen' : ''}`;
    source = branch(source, `candidate-${gate}`, anchor, 'continue;', `scope: "candidate", tick: state.tick, entryId: entry.id, gate: "${gate}", enabledChoices: null${extra}`);
  }
  source = before(source, 'candidate-accepted', '    out.push({ entry, bound, draw, key, context });', tap('scope: "candidate", tick: state.tick, entryId: entry.id, gate: "accepted", draw, key, context, boundJson: JSON.stringify(bound), weight: entry.frequency.weight, enabledChoices: null, enabledChoicesObserved: false, choiceEvaluationReached: true'));
  return source;
}
function selectionRows(collection, scope, boundFields) {
  return `${collection}.forEach((candidate, position) => historicalTap(() => {
    const rangeFrom = ${collection}.slice(0, position).reduce((sum, row) => sum + row.entry.frequency.weight, 0);
    return { scope: "${scope}", gate: "ordered_candidate", tick: state.tick, position, entryId: candidate.entry.id,
      weight: candidate.entry.frequency.weight, rangeFrom, rangeTo: rangeFrom + candidate.entry.frequency.weight, total, initialPick: pick, ${boundFields} };
  }));\n`;
}
function patchRegistry(original) {
  let source = original;
  const scopeFields = gate => `scope: "v4_outer", tick: state.tick, gate: "${gate}"`;
  source = branch(source, 'v4-budget', '  if (Math.min(REGISTRY_EVENTS_PER_SEASON, REGISTRY_EVENTS_PER_YEAR - thisYear.length) <= 0) return state;', 'return state;', `${scopeFields('budget')}, thisYear: thisYear.length`);
  source = branch(source, 'v4-no-weight', '  if (total <= 0) return state;', 'return state;', `${scopeFields('no_weight')}, total, candidateCount: candidates.length, initialPick: null`);
  source = before(source, 'v4-selection', '  const chosen = candidates.find(candidate => { if (pick < candidate.entry.frequency.weight) return true; pick -= candidate.entry.frequency.weight; return false; });',
    tap(`${scopeFields('selection_start')}, total, initialPick: pick, candidateCount: candidates.length`) + selectionRows('candidates', 'v4_selection', 'draw: candidate.draw, key: candidate.key, context: candidate.context, boundJson: JSON.stringify(candidate.bound)'));
  source = branch(source, 'v4-no-chosen', '  if (chosen === undefined) return state;', 'return state;', scopeFields('no_chosen'));
  source = before(source, 'v4-chosen', '  const selected = registryChapterPetitionDef(chosen.entry.id) === undefined ? state : prepareRegistryChapterPetition(state, chosen.entry.id);', tap(`${scopeFields('chosen')}, entryId: chosen.entry.id, remainingPick: pick, key: chosen.key, boundJson: JSON.stringify(chosen.bound)`));
  source = branch(source, 'v4-selected-null', '  if (selected === null) return state;', 'return state;', `${scopeFields('selected_prepare_null')}, entryId: chosen.entry.id`);
  source = before(source, 'v4-constructed-offer', '  return layerOffer({ ...selected, registry: { ...registry, occurrences: [...registry.occurrences, offer].slice(-MAX_OCCURRENCES_KEPT) } }, offer, state);', tap(`${scopeFields('constructed_offer')}, entryId: offer.entryId, offeredId: offer.id, boundJson: JSON.stringify(offer.bound), key: offer.key ?? null`));
  const layer = (gate, more = '') => `scope: "layer", tick: state.tick, entryId: offer.entryId, offeredId: offer.id, gate: "${gate}"${more}`;
  source = branch(source, 'layer-unweighed', '  if (weighed === null) return state;', 'return state;', layer('unweighed_return'));
  source = branch(source, 'layer-crowded', '  if (weighed.weights.length > 0 && heavyLoad(state) >= DECISION_WEIGHT_BALANCE.registryCrowded) return before;', 'return before;', layer('crowded_rejected', ', weightsJson: JSON.stringify(weighed.weights)'));
  source = branch(source, 'layer-heavy', '  if (weighed.weights.length > 0) return settleWeights(state, offer.id, weighed.weights);', 'return settleWeights(state, offer.id, weighed.weights);', layer('heavy_admitted', ', weightsJson: JSON.stringify(weighed.weights)'));
  source = branch(source, 'layer-no-pick', '  if (pick === null) return settleWeights(state, offer.id, []);', 'return settleWeights(state, offer.id, []);', layer('light_no_pick', ', policy'));
  source = branch(source, 'layer-unsettled', '  if (settled === undefined || settled.status !== "answered") return settleWeights(state, offer.id, []);', 'return settleWeights(state, offer.id, []);', layer('light_unsettled', ', policy, choiceId: pick'));
  source = before(source, 'layer-answered', '  return { ...answered, registry: { ...registryOf(answered), occurrences: registryOf(answered).occurrences.map(entry => entry.id === offer.id', tap(layer('steward_answered', ', policy, choiceId: pick')));
  source = branch(source, 'legacy-budget-or-empty', '  if (left <= 0 || kept.length === 0) return [];', 'return [];', 'scope: "legacy_selection", tick: state.tick, gate: "budget_or_empty", left, keptCount: kept.length, initialPick: null');
  source = before(source, 'legacy-ordered', '  for (const candidate of ordered) {', tap('scope: "legacy_selection", gate: "selection_start", tick: state.tick, total, initialPick: pick, candidateCount: ordered.length') + selectionRows('ordered', 'legacy_selection', 'boundId: candidate.boundId, draw: candidate.draw, key: null'));
  source = branch(source, 'legacy-chosen', '    if (pick < candidate.entry.frequency.weight) return [candidate];', 'return [candidate];', 'scope: "legacy_selection", gate: "chosen", tick: state.tick, entryId: candidate.entry.id, boundId: candidate.boundId, remainingPick: pick');
  source = before(source, 'legacy-suppresses-v4', '  const registry = registryOf(state);\n  const offers: RegistryOccurrence[] = [];', tap('scope: "v4_outer", gate: "legacy_suppressed", tick: state.tick, chosenIdsJson: JSON.stringify(chosen.map(row => row.entry.id))'));
  source = before(source, 'legacy-offers', '  if (offers.length === 0) return state;', 'offers.forEach(offer => ' + tap('scope: "legacy_selection", gate: "constructed_offer", tick: state.tick, offeredId: offer.id, entryId: offer.entryId, boundId: offer.boundId').trim().replace(/;$/, '') + ');\n');
  return source;
}
function patch(path, original) {
  const source = path === 'src/engine/registryV4.ts' ? patchV4(original) : patchRegistry(original);
  return block('import', 'import { historicalTap } from "./historicalRegistryObserver";\n') + source;
}
export function stripHistoricalInstrumentation(path, patched) {
  check(Object.hasOwn(HISTORICAL_SOURCE_PINS, path), 'unknown source path');
  const stripped = patched.replace(/\/\* EB-HIST:([a-z0-9_-]+):BEGIN \*\/[\s\S]*?\/\* EB-HIST:\1:END \*\//g, '');
  check(sha(stripped) === HISTORICAL_SOURCE_PINS[path], 'stripped source hash mismatch');
  check(patch(path, stripped) === patched, 'inserted blocks differ from exact generated patch');
  return stripped;
}
export function generateHistoricalInstrumentation(sources) {
  check(Object.keys(sources).sort().join('\n') === Object.keys(HISTORICAL_SOURCE_PINS).sort().join('\n'), 'exact two source files required');
  const patched = {}, files = {};
  for (const [path, expected] of Object.entries(HISTORICAL_SOURCE_PINS)) {
    check(typeof sources[path] === 'string' && sha(sources[path]) === expected, `original source hash mismatch: ${path}`);
    patched[path] = patch(path, sources[path]);
    check(stripHistoricalInstrumentation(path, patched[path]) === sources[path], 'roundtrip failed');
    files[path] = { originalSha256: expected, patchedSha256: sha(patched[path]) };
  }
  return { sourceRevision: HISTORICAL_REVISION, patched, observerPath: HISTORICAL_OBSERVER_PATH, observerSource,
    manifest: { files, observerSha256: sha(observerSource), mechanism: 'insertion-only marked scalar taps; callbacks isolated; no engine call repetition' } };
}
