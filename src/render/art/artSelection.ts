import type { ArtCondition, ArtKind, ArtRule, ArtScalar } from './artContract';
import type { ArtSchemaIssue } from './schemaValidation';
export type ArtContext = Readonly<Record<string, ArtScalar | undefined>>;
export type ArtContextField = { readonly type: 'string' | 'number' | 'boolean'; readonly unit: string };
const text = { type: 'string', unit: 'identifier' } as const;
const number = (unit: string): ArtContextField => ({ type: 'number', unit });
/** Closed adapter facts: no arbitrary GameState paths and no engine state invention. */
export const ART_CONTEXT_FIELDS: Readonly<Record<ArtKind, Readonly<Record<string, ArtContextField>>>> = Object.freeze({
  'building-body': { buildingKind: text, level: number('level'), season: text, calendarYear: number('calendar-year'), lot: text, eligible: { type: 'boolean', unit: 'boolean' } },
  'state-overlay': { bodyId: text, layer: text, season: text, vacant: { type: 'boolean', unit: 'boolean' }, ageYears: number('engine-year'), wealth: number('engine-wealth'), era: text },
  'ground-prop': { baseId: text, archetype: text, occupation: text, wealth: number('engine-wealth'), season: text, placement: text },
  'walker-cargo': { role: text, cargoKind: text, facing: text, frame: number('frame-index') },
  'land-stage': { family: text, stage: text, season: text, layout: text, connectionMask: number('connection-mask'), ageYears: number('engine-year'), stageProgress: number('stage-fraction'), parity: number('cell-hash-modulo-2'), plot: { type: 'boolean', unit: 'boolean' } },
  landmark: { family: text, growthStage: text, season: text },
  'event-scene': { eventId: text, group: text, placement: text, active: { type: 'boolean', unit: 'boolean' } },
  'event-illustration': { eventId: text },
  portrait: { personId: text, pool: text, lineage: text, ageStage: text, era: text },
  'weather-shadow': { weather: text },
  'ground-texture': { fieldState: text, baseId: text, season: text },
  'season-variant': { baseKey: text, season: text },
  'regional-map': { mapId: text, landType: text },
  'ui-frame': { state: text },
  'ui-image': { state: text },
});
for (const fields of Object.values(ART_CONTEXT_FIELDS)) {
  for (const field of Object.values(fields)) Object.freeze(field);
  Object.freeze(fields);
}
function accepts(condition: ArtCondition, value: ArtScalar): boolean {
  switch (condition.op) {
    case 'eq': return value === condition.value;
    case 'in': return condition.values.includes(value);
    case 'range': return typeof value === 'number' && (condition.min === undefined || value >= condition.min) && (condition.max === undefined || value < condition.max);
  }
}
export function matches(conditions: readonly ArtCondition[], context: ArtContext): boolean {
  return conditions.every(condition => {
    const descriptor = Object.getOwnPropertyDescriptor(context, condition.field);
    const value: unknown = descriptor && 'value' in descriptor ? descriptor.value : undefined;
    return (typeof value === 'string' || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value))) && accepts(condition, value);
  });
}
/** Intersection per field makes overlap exact for the AND/eq/in/half-open-range grammar. */
function satisfiable(conditions: readonly ArtCondition[]): boolean {
  for (const field of new Set(conditions.map(condition => condition.field))) {
    const predicates = conditions.filter(condition => condition.field === field);
    const finite = predicates.find(condition => condition.op !== 'range');
    if (finite) {
      const values = finite.op === 'eq' ? [finite.value] : finite.values;
      if (!values.some(value => predicates.every(condition => accepts(condition, value)))) return false;
    } else {
      let low = -Infinity;
      let high = Infinity;
      for (const condition of predicates) if (condition.op === 'range') {
        low = Math.max(low, condition.min ?? -Infinity);
        high = Math.min(high, condition.max ?? Infinity);
      }
      if (low >= high) return false;
    }
  }
  return true;
}
export function validateSelection(rules: readonly ArtRule[]): readonly ArtSchemaIssue[] {
  const issues: ArtSchemaIssue[] = [];
  for (const rule of rules) {
    const at = `$/rules/${rule.id}`;
    for (const condition of rule.conditions) {
      const field = ART_CONTEXT_FIELDS[rule.kind][condition.field];
      if (!field) { issues.push({ path: at, message: `Unknown selector field ${condition.field}` }); continue; }
      if (condition.op === 'range') {
        if (field.type !== 'number' || (condition.min !== undefined && condition.max !== undefined && condition.min >= condition.max)) issues.push({ path: at, message: 'Range requires numeric field and min < max' });
      } else {
        const values = condition.op === 'eq' ? [condition.value] : condition.values;
        if (values.some(value => typeof value !== field.type)) issues.push({ path: at, message: `Wrong selector scalar type for ${condition.field}` });
      }
    }
    if (!satisfiable(rule.conditions)) issues.push({ path: at, message: 'Rule conditions cannot match' });
    const total = rule.variants.reduce((sum, variant) => sum + variant.weight, 0);
    if (!Number.isSafeInteger(total) || rule.variants.some(variant => !Number.isSafeInteger(variant.weight) || variant.weight <= 0)) issues.push({ path: at, message: 'Variant weights and total must be positive safe integers' });
    if (new Set(rule.variants.map(variant => variant.assetId)).size !== rule.variants.length) issues.push({ path: at, message: 'Duplicate variant asset ID' });
  }
  for (let i = 0; i < rules.length; i++) for (let j = i + 1; j < rules.length; j++) {
    const a = rules[i]; const b = rules[j];
    if (a && b && a.kind === b.kind && a.slot === b.slot && a.priority === b.priority && satisfiable([...a.conditions, ...b.conditions])) issues.push({ path: `$/rules/${b.id}`, message: `Same-priority overlap with ${a.id}` });
  }
  return issues;
}
function nextRepresentable(value: number): number {
  if (value === 0) return Number.MIN_VALUE;
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, value);
  view.setBigUint64(0, view.getBigUint64(0) + (value > 0 ? 1n : -1n));
  return view.getFloat64(0);
}
export function conditionBoundaries(conditions: readonly ArtCondition[], field: string): readonly number[] {
  const values = conditions.filter(condition => condition.field === field).flatMap(condition => {
    if (condition.op === 'range') return [condition.min, condition.max];
    const points = condition.op === 'eq' ? [condition.value] : condition.values;
    return points.flatMap(point => typeof point === 'number' ? [point, nextRepresentable(point)] : []);
  });
  return [...new Set(values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value)))].sort((a, b) => a - b);
}
