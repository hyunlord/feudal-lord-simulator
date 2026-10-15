import assert from 'node:assert/strict';
import test from 'node:test';
import { HISTORY_TEMPLATES } from '../src/content/historyCopy.ko';

const season = HISTORY_TEMPLATES['stewardship.season']!;
const ordinary = { house: 'Ashcombe', reported: 40, mode: 'steward', overloaded: 0 };

test('a proved estate contribution is readable without calling it this season’s income or relation delta', () => {
  const text = season({ ...ordinary, traceEstate: 'estate-1', traceRelationTenants: 17, traceTenantsContribution: 8 });
  assert.ok(text.startsWith(season(ordinary)));
  assert.ok(text.includes('앞선 답으로 소작인들과 가까워진 영향이 이번 철에도 남았다'));
  assert.ok(!text.includes('8'));
  assert.ok(!text.includes('17'));
});

test('the season can name both retained relation directions', () => {
  const text = season({ ...ordinary, traceEstate: 'estate-1', traceRelationTenants: 12, traceTenantsContribution: 4,
    traceRelationMerchants: -28, traceMerchantsContribution: -8 });
  assert.ok(text.includes('소작인들과 가까워진'));
  assert.ok(text.includes('상인들과 멀어진'));
});

test('legacy, zero, malformed and clamped metadata do not invent a retained influence', () => {
  const extras: readonly Readonly<Record<string, string | number>>[] = [
    {},
    { traceTenantsContribution: 4, traceRelationTenants: 12 },
    { traceEstate: 'estate-1', traceTenantsContribution: 0, traceRelationTenants: 12 },
    { traceEstate: 'estate-1', traceTenantsContribution: '4', traceRelationTenants: 12 },
    { traceEstate: 'estate-1', traceTenantsContribution: 4 },
    { traceEstate: 'estate-1', traceTenantsContribution: 4, traceRelationTenants: 100 },
    { traceEstate: 'estate-1', traceTenantsContribution: Number.NaN, traceRelationTenants: 12 },
  ];
  for (const extra of extras) assert.equal(season({ ...ordinary, ...extra }), season(ordinary));
});
