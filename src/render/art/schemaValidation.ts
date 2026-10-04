/** Deliberately limited art-contract dialect, not a general JSON Schema implementation. */
export type ArtSchemaIssue = { readonly path: string; readonly message: string };
type Check = (value: unknown, path: string) => readonly ArtSchemaIssue[];
type JsonObject = { readonly [key: string]: unknown };
const unsafeKeys = new Set(['__proto__', 'prototype', 'constructor']);
const keywords = new Set(['$schema', '$id', 'title', 'description', '$defs', '$ref', 'type', 'required', 'properties', 'additionalProperties', 'const', 'enum', 'oneOf', 'anyOf', 'items', 'minItems', 'maxItems', 'uniqueItems', 'minLength', 'maxLength', 'pattern', 'minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum']);
const types = new Set(['null', 'boolean', 'object', 'array', 'number', 'integer', 'string']);
const childPath = (path: string, key: string): string => `${path}/${key.replace(/~/g, '~0').replace(/\//g, '~1')}`;
const object = (value: unknown): value is JsonObject => typeof value === 'object' && value !== null && !Array.isArray(value);
const issue = (path: string, message: string): ArtSchemaIssue[] => [{ path, message }];

export class ArtSchemaDefinitionError extends Error {
  constructor(readonly path: string, message: string) {
    super(`${path}: ${message}`);
    this.name = 'ArtSchemaDefinitionError';
  }
}
function invalid(path: string, message: string): never { throw new ArtSchemaDefinitionError(path, message); }

/** Checks descriptors before reading values so accessors cannot execute during validation. */
function jsonIssues(value: unknown, path: string, ancestors = new Set<object>()): readonly ArtSchemaIssue[] {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return [];
  if (typeof value === 'number') return Number.isFinite(value) ? [] : issue(path, 'Expected a finite JSON number');
  if (typeof value !== 'object') return issue(path, 'Expected plain JSON data');
  if (ancestors.has(value)) return issue(path, 'Cyclic JSON data');
  const array = Array.isArray(value);
  const prototype: unknown = Object.getPrototypeOf(value);
  if (array ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null) return issue(path, 'Expected plain JSON object');
  ancestors.add(value);
  const problems: ArtSchemaIssue[] = [];
  const keys = Reflect.ownKeys(value);
  if (array && keys.length !== value.length + 1) problems.push(...issue(path, 'Expected a dense JSON array without extra properties'));
  for (const key of keys) {
    if (array && key === 'length') continue;
    if (typeof key !== 'string') { problems.push(...issue(path, 'Symbol keys are not JSON')); continue; }
    const at = childPath(path, key);
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (unsafeKeys.has(key)) problems.push(...issue(at, 'Unsafe object key'));
    else if (!descriptor || !('value' in descriptor) || !descriptor.enumerable) problems.push(...issue(at, 'Expected enumerable data property'));
    else if (array && (!/^(0|[1-9]\d*)$/.test(key) || Number(key) >= value.length)) problems.push(...issue(at, 'Unexpected array property'));
    else problems.push(...jsonIssues(descriptor.value, at, ancestors));
  }
  ancestors.delete(value);
  return problems;
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (object(value)) return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value) ?? 'undefined';
}
function matchesType(value: unknown, type: string): boolean {
  switch (type) {
    case 'null': return value === null;
    case 'array': return Array.isArray(value);
    case 'object': return object(value);
    case 'integer': return typeof value === 'number' && Number.isInteger(value);
    case 'number': return typeof value === 'number' && Number.isFinite(value);
    case 'string': return typeof value === 'string';
    case 'boolean': return typeof value === 'boolean';
    default: return false;
  }
}

/** Schema errors throw before data checking; instance errors are returned with JSON Pointer paths. */
export function validateArtSchema(value: unknown, schema: unknown): readonly ArtSchemaIssue[] {
  const schemaProblem = jsonIssues(schema, '$')[0];
  if (schemaProblem) invalid(schemaProblem.path, schemaProblem.message);
  if (!object(schema)) invalid('$', 'Expected schema object');
  const root = schema;
  const compiled = new Map<object, Check>();
  const active = new Set<object>();
  const compile = (node: unknown, path: string): Check => {
    if (!object(node)) return invalid(path, 'Expected schema object');
    if (active.has(node)) return invalid(path, 'Cyclic schema reference');
    const cached = compiled.get(node);
    if (cached) return cached;
    active.add(node);
    const checks: Check[] = [];
    for (const [key, rule] of Object.entries(node)) {
      const at = childPath(path, key);
      if (!keywords.has(key)) invalid(at, 'Unsupported schema keyword');
      switch (key) {
        case '$schema': case '$id': case 'title': case 'description':
          if (typeof rule !== 'string') invalid(at, 'Expected string annotation');
          break;
        case '$defs':
          if (!object(rule)) invalid(at, 'Expected definition map');
          for (const [name, definition] of Object.entries(rule)) compile(definition, childPath(at, name));
          break;
        case '$ref': {
          if (typeof rule !== 'string' || !/^#\/\$defs\/([^/~]|~[01])+$/.test(rule)) invalid(at, 'Only local definition references are supported');
          const name = rule.slice('#/$defs/'.length).replace(/~1/g, '/').replace(/~0/g, '~');
          const definitions = root['$defs'];
          if (!object(definitions) || !Object.hasOwn(definitions, name)) invalid(at, 'Unknown local definition');
          checks.push(compile(definitions[name], childPath('$/$defs', name)));
          break;
        }
        case 'type': {
          const names = Array.isArray(rule) ? rule : [rule];
          if (!names.length || names.some(name => typeof name !== 'string' || !types.has(name)) || new Set(names).size !== names.length) invalid(at, 'Expected unique supported types');
          checks.push((data, where) => names.some(name => typeof name === 'string' && matchesType(data, name)) ? [] : issue(where, `Expected type ${names.join(' or ')}`));
          break;
        }
        case 'const':
          checks.push((data, where) => canonical(data) === canonical(rule) ? [] : issue(where, 'Value differs from const'));
          break;
        case 'enum': {
          if (!Array.isArray(rule) || !rule.length) invalid(at, 'Expected nonempty enum');
          const choices = new Set(rule.map(canonical));
          if (choices.size !== rule.length) invalid(at, 'Duplicate enum values');
          checks.push((data, where) => choices.has(canonical(data)) ? [] : issue(where, 'Value is outside enum'));
          break;
        }
        case 'oneOf': case 'anyOf': {
          if (!Array.isArray(rule) || !rule.length) invalid(at, 'Expected nonempty schema alternatives');
          const alternatives = rule.map((entry, index) => compile(entry, childPath(at, String(index))));
          checks.push((data, where) => {
            const count = alternatives.filter(check => check(data, where).length === 0).length;
            return (key === 'oneOf' ? count === 1 : count > 0) ? [] : issue(where, `Expected ${key === 'oneOf' ? 'exactly one' : 'at least one'} matching alternative`);
          });
          break;
        }
        case 'required': {
          if (!Array.isArray(rule) || rule.some(name => typeof name !== 'string' || unsafeKeys.has(name)) || new Set(rule).size !== rule.length) invalid(at, 'Expected unique safe property names');
          checks.push((data, where) => object(data) ? rule.flatMap(name => typeof name === 'string' && !Object.hasOwn(data, name) ? issue(childPath(where, name), 'Required property missing') : []) : []);
          break;
        }
        case 'properties': {
          if (!object(rule)) invalid(at, 'Expected property schema map');
          const properties = Object.entries(rule).map(([name, entry]) => ({ name, check: compile(entry, childPath(at, name)) }));
          checks.push((data, where) => object(data) ? properties.flatMap(({ name, check }) => Object.hasOwn(data, name) ? check(data[name], childPath(where, name)) : []) : []);
          break;
        }
        case 'additionalProperties': {
          const check = rule === false ? undefined : compile(rule, at);
          checks.push((data, where) => object(data) ? Object.keys(data).flatMap(name => {
            if (object(node['properties']) && Object.hasOwn(node['properties'], name)) return [];
            return check ? check(data[name], childPath(where, name)) : issue(childPath(where, name), 'Additional property is forbidden');
          }) : []);
          break;
        }
        case 'items': {
          const check = compile(rule, at);
          checks.push((data, where) => Array.isArray(data) ? data.flatMap((entry, index) => check(entry, childPath(where, String(index)))) : []);
          break;
        }
        case 'uniqueItems':
          if (typeof rule !== 'boolean') invalid(at, 'Expected boolean');
          checks.push((data, where) => rule && Array.isArray(data) && new Set(data.map(canonical)).size !== data.length ? issue(where, 'Array items must be unique') : []);
          break;
        case 'pattern': {
          if (typeof rule !== 'string') invalid(at, 'Expected regular expression string');
          let pattern: RegExp;
          try { pattern = new RegExp(rule, 'u'); }
          catch (error) { if (error instanceof SyntaxError) return invalid(at, 'Malformed regular expression'); throw error; }
          checks.push((data, where) => typeof data === 'string' && !pattern.test(data) ? issue(where, 'String does not match pattern') : []);
          break;
        }
        case 'minItems': case 'maxItems': case 'minLength': case 'maxLength': {
          if (typeof rule !== 'number' || !Number.isSafeInteger(rule) || rule < 0) invalid(at, 'Expected nonnegative safe integer');
          checks.push((data, where) => {
            const length = key.endsWith('Items') ? (Array.isArray(data) ? data.length : undefined) : (typeof data === 'string' ? Array.from(data).length : undefined);
            return length !== undefined && (key.startsWith('min') ? length < rule : length > rule) ? issue(where, `Violated ${key}: ${rule}`) : [];
          });
          break;
        }
        case 'minimum': case 'maximum': case 'exclusiveMinimum': case 'exclusiveMaximum':
          if (typeof rule !== 'number' || !Number.isFinite(rule)) invalid(at, 'Expected finite numeric bound');
          checks.push((data, where) => {
            if (typeof data !== 'number') return [];
            const fails = key === 'minimum' ? data < rule : key === 'maximum' ? data > rule : key === 'exclusiveMinimum' ? data <= rule : data >= rule;
            return fails ? issue(where, `Violated ${key}: ${rule}`) : [];
          });
          break;
      }
    }
    const check: Check = (data, where) => checks.flatMap(test => test(data, where));
    active.delete(node);
    compiled.set(node, check);
    return check;
  };
  const check = compile(root, '$');
  const problems = jsonIssues(value, '$');
  return problems.length ? problems : check(value, '$');
}
