import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import holds from '../docs/design/content-drafts-20261002/v4.2/HOLD_RECOMMENDATIONS.json';
import { ENGINE_B_COMMAND_WEIGHT_OVERRIDES, ENGINE_B_DECISION_LAYERS } from '../src/content/registry/engineBDecisionLayers.ko';
import { COMMAND_WEIGHT, LASTING_RATE_COMMANDS } from '../src/content/stewardPolicyConfig';
import { registryV4Support, v4Entry } from '../src/engine/registryV4';

interface TracePath {
  readonly potentialTargets: readonly string[];
  readonly becauseProducer: string;
  readonly firstObservableDelay: string;
  readonly evidenceGap: string;
}
const timingGap = 'Source path only; no per-ID executed choice, future outcome, because linkage or rendered season verified by this inventory.';
const suit: TracePath = {
  potentialTargets: ['suit:<id>', 'claim:<id>'], becauseProducer: 'src/engine/decisionTrace.ts:402 (suit_turned)',
  firstObservableDelay: 'Decision model after a successful answer; consequence only when a later suit stage/verdict/enforcement changes. No fixed season proved.', evidenceGap: timingGap,
};
const marriage: TracePath = {
  potentialTargets: ['negotiation:<id>', 'promise:<id>'], becauseProducer: 'src/engine/decisionTrace.ts:411 (marriage_turned/promise_made/kept/broken)',
  firstObservableDelay: 'Decision model after a successful answer; future status, marriage stage or promise transition. No fixed season proved.', evidenceGap: timingGap,
};
const estate: TracePath = {
  potentialTargets: ['estate:<id>'], becauseProducer: 'src/engine/decisionTrace.ts:431 (audit/estate_mood)',
  firstObservableDelay: 'Decision model after answer; later audit or seasonal summary crossing a mood band of 20. Next season need not produce a because row.', evidenceGap: timingGap,
};
const paths: Readonly<Record<string, TracePath>> = {
  file_suit: suit, add_suit_evidence: suit,
  enforce_possession: { ...suit, potentialTargets: ['suit:<id>', 'rent:<estate>|<piece>'], becauseProducer: 'src/engine/decisionTrace.ts:408,466 (suit_turned/suit_rent)' },
  propose_marriage: marriage, answer_counter: marriage, keep_promise: marriage,
  set_estate_oversight: estate, set_audit_mode: estate, answer_audit: estate,
  set_market_dues: {
    potentialTargets: ['dues'], becauseProducer: 'src/engine/decisionTrace.ts:466 (payment_flow); src/engine/duesMind.ts:81,99 (dues_held/agreement_broken)',
    firstObservableDelay: 'Decision model after answer; first later nonzero stall-fee ledger posting, or a seasonal dues relation change, or a later agreement breach. No guaranteed next-season row.', evidenceGap: timingGap,
  },
  order_timber: {
    potentialTargets: ['timber'], becauseProducer: 'src/engine/decisionTrace.ts:486 (goods_delivered)',
    firstObservableDelay: 'Decision model after answer; later decrease of pending timber order. Delivery timing and cancellation attribution require execution.', evidenceGap: timingGap,
  },
  set_project_subsidy: {
    potentialTargets: ['subsidy:<kind>'], becauseProducer: 'src/engine/decisionTrace.ts:445 (project_started, partial)',
    firstObservableDelay: 'Decision model after answer; only if the actor later chooses a project and emits a receipt. No guaranteed season or construction completion.', evidenceGap: timingGap,
  },
  set_exception_rules: {
    potentialTargets: [], becauseProducer: 'No dedicated exception-rule target in src/engine/decisionTrace.ts:58; immediate decision trace remains available.',
    firstObservableDelay: 'Decision model after successful answer; later petition escalation changes operational behavior but no dedicated because producer established.',
    evidenceGap: 'A causality gap is not proof of a meaningless choice. Requires runtime petition-routing audit and engine-owner handoff.',
  },
  petition_response: {
    potentialTargets: ['build:<kind> when PETITION_OPENS matches', 'flow:<category> when PETITION_FLOWS matches', 'right:<id> when a right is granted', 'faction:<id> when relation changes'],
    becauseProducer: 'src/engine/decisionTrace.ts:99,445,466; src/engine/decisionReads.ts:63 (faction memory)',
    firstObservableDelay: 'Decision and changed relation model after answer; later project receipt or first eligible ledger posting for matched petition/right contracts. Branch-specific, no fixed season.', evidenceGap: timingGap,
  },
};
const support = registryV4Support();
const executable = support.filter(entry => entry.runs);
assert.equal(executable.length, 56);
assert.equal(holds.entries.length, 38);
assert.equal(holds.entries.filter(held => executable.some(entry => entry.id === held.id)).length, 0);
const events = executable.map(supported => {
  const entry = v4Entry(supported.id);
  assert.ok(entry);
  const choices = entry.choices.filter(choice => supported.choices.some(item => item.id === choice.id && item.supported)).map(choice => {
    const commands = choice.commands.map(command => {
      const override = ENGINE_B_COMMAND_WEIGHT_OVERRIDES[entry.id]?.[command.type];
      const trace = paths[command.type];
      assert.ok(trace, `unmapped command ${command.type}`);
      return { type: command.type, args: command.args ?? {}, baseWeight: COMMAND_WEIGHT[command.type] ?? null,
        hasOverride: override !== undefined, overrideWeight: override ?? null,
        effectiveStaticWeight: override === undefined ? COMMAND_WEIGHT[command.type] ?? null : override,
        lastingRate: LASTING_RATE_COMMANDS.includes(command.type), trace };
    });
    return { id: choice.id, conditions: choice.conditions ?? null, commands,
      staticWeights: [...new Set(commands.flatMap(command => command.effectiveStaticWeight === null ? [] : [command.effectiveStaticWeight]))].sort(),
      hold: commands.length === 0 ? { effect: 'Existing claim/deadline/relation cost; not a free no-op.', source: 'src/engine/registryV4.ts:174,192', evidenceGap: timingGap } : null };
  });
  const acting = choices.filter(choice => choice.commands.length > 0);
  const lastingOnly = acting.length > 0 && acting.every(choice => choice.commands.some(command => command.lastingRate));
  const weights = [...new Set(choices.flatMap(choice => choice.staticWeights))].sort();
  return { id: entry.id, support: 'executable', calendar: entry.calendar, supportedChoices: choices,
    unsupportedChoices: supported.choices.filter(choice => !choice.supported), editorial: ENGINE_B_DECISION_LAYERS[entry.id] ?? null,
    preliminary: { staticWeights: weights, lastingOnly, route: weights.length > 0 || lastingOnly ? 'heavy_candidate' : 'conditional_routine',
      inferredLayers: [...new Set([...weights, ...(lastingOnly ? ['rights'] : [])])].sort() },
    runtimeQualification: 'Enabled choices and bound state must be weighed by weighOffer; large_sum/faction_rupture can promote, disabled branches can change classification, lord standing policy can request intervention. No observed routing claimed.',
    decisionAndReport: { trace: 'src/engine/decisionTrace.ts:193,268', model: 'src/engine/decisionReads.ts:53,106,184',
      firstObservableDelay: 'Immediate model after successful answer; steward report spans offeredTick. UI rendering/season presentation unverified.' },
    evidenceGap: timingGap };
});
const counts = { executable: events.length, preliminaryHeavy: events.filter(event => event.preliminary.route === 'heavy_candidate').length,
  preliminaryConditional: events.filter(event => event.preliminary.route === 'conditional_routine').length,
  editorialTotal: Object.keys(ENGINE_B_DECISION_LAYERS).length,
  editorialLord: Object.values(ENGINE_B_DECISION_LAYERS).filter(entry => entry.weight === 'lord').length,
  editorialSteward: Object.values(ENGINE_B_DECISION_LAYERS).filter(entry => entry.weight === 'steward').length,
  editorialExecutableOverlap: events.filter(event => event.editorial !== null).length, disabledHoldRecommendations: holds.entries.length };
assert.equal(counts.preliminaryHeavy, 43);
assert.equal(counts.preliminaryConditional, 13);
assert.equal(counts.editorialLord, 9);
assert.equal(counts.editorialSteward, 18);
assert.deepEqual(events.map(event => event.id).sort(), executable.map(event => event.id).sort());
const artifact = { schemaVersion: 1, status: 'static_inventory_runtime_pending', sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  sourceNote: 'Includes the uncommitted LP2-E correction to ck_evt_092 editorial label. No runtime semantic changes.',
  generator: 'scripts/engineBLayerInventory.ts', counts,
  invariants: { exactExecutableSet: true, missing: [], extra: [], hold38Disabled: true },
  classificationSources: ['src/engine/registryV4.ts:215,236', 'src/engine/decisionLayer.ts:66,77,92,96,109', 'src/engine/registry.ts:434'],
  targetSources: ['src/engine/decisionTrace.ts:58,193,223,268'],
  newsCandidates: [], newsCandidateStatus: 'No meaningless choice proven by this static inventory; canonical edit handoff pending behavioral audit.',
  engineHandoffs: [{ id: 'mixed-dues-target', source: 'src/engine/decisionTrace.ts:223', affectedPotentialIds: ['ck_evt_083', 'ck_evt_144', 'ck_evt_150'],
    finding: 'Any dues command in the event causes the lord answer to acquire dues target, even a different selected branch. Potential misattribution, not runtime-proven here.' }], events };
const destination = 'docs/verification/eb-weight/layers.json';
const serialized = JSON.stringify(artifact, null, 2) + '\n';
if (process.argv.includes('--check')) {
  assert.equal(readFileSync(destination, 'utf8'), serialized);
} else {
  mkdirSync('docs/verification/eb-weight', { recursive: true });
  writeFileSync(destination, serialized);
}
console.log(JSON.stringify({ status: 'pass', mode: process.argv.includes('--check') ? 'check' : 'write', ...counts }));
