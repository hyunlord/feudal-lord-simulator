import assert from 'node:assert/strict';
import test from 'node:test';
import { ArtSchemaDefinitionError, validateArtSchema } from '../src/render/art/schemaValidation';

test('validates nested unions and escaped local definition references', () => {
  const schema = { $defs: { 'part/name': { type: 'integer', minimum: 1 } }, type: 'object', required: ['parts'], properties: { parts: { type: 'array', items: { oneOf: [{ $ref: '#/$defs/part~1name' }, { type: 'null' }] } } }, additionalProperties: false };
  assert.deepEqual(validateArtSchema({ parts: [2, null] }, schema), []);
});
test('compiles unsupported keywords in dormant branches before checking the value', () => {
  assert.throws(() => validateArtSchema(undefined, { anyOf: [{ type: 'string' }, { format: 'uri' }] }), (error: unknown) => error instanceof ArtSchemaDefinitionError && error.path.includes('format'));
});
for (const [value, valid] of [[null, true], [4, true], [4.1, false], ['4', false]] as const) {
  test(`type arrays distinguish null and integer for ${String(value)}`, () => {
    assert.equal(validateArtSchema(value, { type: ['integer', 'null'] }).length === 0, valid);
  });
}
test('enum does not bypass the declared type', () => {
  assert.ok(validateArtSchema('1', { type: 'number', enum: ['1'] }).length);
});
test('rejects unknown object keys and reports their path', () => {
  assert.equal(validateArtSchema({ extra: 1 }, { type: 'object', additionalProperties: false })[0]?.path, '$/extra');
});
test('validates schema-valued additional properties', () => {
  assert.equal(validateArtSchema({ extra: 'bad' }, { additionalProperties: { type: 'number' } })[0]?.path, '$/extra');
});
test('inherited required keys cannot satisfy a contract', () => {
  assert.ok(validateArtSchema(Object.create({ id: 'inherited' }), { required: ['id'] }).length);
});
for (const value of [NaN, Infinity, -Infinity, undefined, new Date(), () => 1]) {
  test(`rejects non-JSON value ${String(value)}`, () => {
    assert.ok(validateArtSchema(value, {}).length);
  });
}
test('uniqueItems compares object content independent of key order', () => {
  assert.ok(validateArtSchema([{ a: 1, b: 2 }, { b: 2, a: 1 }], { uniqueItems: true }).length);
});
for (const [value, schema] of [
  [[], { minItems: 1 }], [[1, 2], { maxItems: 1 }], ['a', { minLength: 2 }],
  ['abc', { maxLength: 2 }], ['ab', { pattern: '^z' }], [1, { minimum: 2 }],
  [3, { maximum: 2 }], [2, { exclusiveMinimum: 2 }], [2, { exclusiveMaximum: 2 }],
] as const) {
  test(`enforces ${Object.keys(schema)[0]}`, () => assert.ok(validateArtSchema(value, schema).length));
}
test('counts Unicode code points for string limits', () => {
  assert.deepEqual(validateArtSchema('😀', { minLength: 1, maxLength: 1 }), []);
});
test('rejects reference cycles in unused definitions', () => {
  assert.throws(() => validateArtSchema(1, { $defs: { loop: { $ref: '#/$defs/loop' } } }), ArtSchemaDefinitionError);
});
for (const schema of [{ pattern: '[' }, { $ref: 'https://example.com/schema' }, { $ref: '#/$defs/missing' }, { type: 'typo' }, { minItems: -1 }, { required: ['x', 'x'] }, { enum: [] }, { oneOf: [] }, { additionalProperties: true }]) {
  test(`rejects malformed schema ${JSON.stringify(schema)}`, () => assert.throws(() => validateArtSchema(1, schema), ArtSchemaDefinitionError));
}
for (const key of ['__proto__', 'constructor', 'prototype']) {
  test(`rejects dangerous key ${key} in data and schema`, () => {
    const value: unknown = JSON.parse(`{"${key}":{}}`);
    assert.ok(validateArtSchema(value, {}).length);
    assert.throws(() => validateArtSchema({}, { properties: value }), ArtSchemaDefinitionError);
  });
}
test('oneOf requires exactly one match while anyOf permits multiple', () => {
  assert.ok(validateArtSchema(2, { oneOf: [{ type: 'number' }, { type: 'integer' }] }).length);
  assert.deepEqual(validateArtSchema(2, { anyOf: [{ type: 'number' }, { type: 'integer' }] }), []);
});
test('const deeply compares JSON values', () => {
  assert.deepEqual(validateArtSchema({ b: 2, a: 1 }, { const: { a: 1, b: 2 } }), []);
  assert.ok(validateArtSchema({ a: 1 }, { const: { a: 2 } }).length);
});
test('rejects cyclic data without recursion overflow', () => {
  const value: { child?: unknown } = {};
  value.child = value;
  assert.ok(validateArtSchema(value, {}).length);
});
test('rejects getters without invoking them', () => {
  const value = Object.defineProperty({}, 'id', { enumerable: true, get: () => { throw new Error('must not execute'); } });
  assert.ok(validateArtSchema(value, {}).length);
});
test('required fields remain required on a plain empty object', () => {
  assert.equal(validateArtSchema({}, { required: ['id'] })[0]?.path, '$/id');
});
test('supports null-prototype objects with own required data', () => {
  const value: Record<string, unknown> = Object.create(null);
  value['id'] = 'own';
  assert.deepEqual(validateArtSchema(value, { required: ['id'] }), []);
});
test('rejects sparse arrays even without item constraints', () => {
  assert.ok(validateArtSchema(new Array(2), {}).length);
});
test('rejects schema accessors without calling them', () => {
  const schema = Object.defineProperty({}, 'type', { enumerable: true, get: () => { throw new Error('must not execute'); } });
  assert.throws(() => validateArtSchema(null, schema), ArtSchemaDefinitionError);
});
test('rejects an invalid dormant definition', () => {
  assert.throws(() => validateArtSchema('ok', { type: 'string', $defs: { unused: { patternProperties: {} } } }), ArtSchemaDefinitionError);
});
test('applies constraints adjacent to a local reference', () => {
  assert.ok(validateArtSchema(3, { $defs: { positive: { type: 'number', minimum: 1 } }, $ref: '#/$defs/positive', maximum: 2 }).length);
});
test('reports escaped object keys with JSON Pointer escaping', () => {
  assert.equal(validateArtSchema({ 'a/b~c': 1 }, { additionalProperties: false })[0]?.path, '$/a~1b~0c');
});
test('rejects direct schema object cycles', () => {
  const schema: { items?: unknown } = {};
  schema.items = schema;
  assert.throws(() => validateArtSchema([], schema), ArtSchemaDefinitionError);
});
for (const schema of [{ minimum: Infinity }, { enum: [{ a: 1, b: 2 }, { b: 2, a: 1 }] }, { type: [] }, { type: ['string', 'string'] }, { properties: [] }, { items: false }, { $defs: [] }, { uniqueItems: 1 }, { required: [1] }]) {
  test(`rejects invalid keyword shape ${JSON.stringify(schema)}`, () => assert.throws(() => validateArtSchema(null, schema), ArtSchemaDefinitionError));
}
