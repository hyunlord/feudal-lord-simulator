import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

/** Only locates an unquoted declaration; unsupported slash syntax fails closed, rather than parsing JavaScript. */
function assertCodeAnchor(prefix: string): void {
  let quote: string | null = null;
  let interpolationDepth = 0, interpolationQuote: string | null = null;
  let comment: 'line' | 'block' | null = null;
  for (let index = 0; index < prefix.length; index += 1) {
    const character = prefix[index], next = prefix[index + 1];
    if (comment === 'line') { if (character === '\n') comment = null; continue; }
    if (comment === 'block') {
      if (character === '*' && next === '/') { comment = null; index += 1; }
      continue;
    }
    if (quote === '`' && interpolationDepth > 0) {
      if (interpolationQuote !== null) {
        if (character === '\\') index += 1;
        else if (character === interpolationQuote) interpolationQuote = null;
      } else if (character === '"' || character === "'") interpolationQuote = character;
      else {
        assert.ok(character !== '`' && character !== '/' && character !== '\\', 'Unsupported nested template/interpolation syntax');
        if (character === '{') interpolationDepth += 1;
        if (character === '}') interpolationDepth -= 1;
      }
      continue;
    }
    if (quote === '`' && character === '$' && next === '{') { interpolationDepth = 1; index += 1; continue; }
    if (quote !== null) {
      if (character === '\\') index += 1;
      else if (character === quote) quote = null;
      continue;
    }
    if (character === '"' || character === "'" || character === '`') { quote = character; continue; }
    if (character === '/' && next === '/') { comment = 'line'; index += 1; continue; }
    if (character === '/' && next === '*') { comment = 'block'; index += 1; continue; }
    assert.notEqual(character, '/', 'Unsupported slash syntax before taxonomy declaration');
  }
  assert.equal(quote, null, 'Taxonomy declaration cannot be inside a quoted string/template');
  assert.equal(comment, null, 'Taxonomy declaration cannot be inside a comment');
}

/** Dedicated flat literal grammar: no evaluation, expressions, comments, escapes, computed keys or spreads. */
export function verifyOutcomeTaxonomy(source: string, expected: Readonly<Record<string, string>>): string {
  const marker = 'const COMMAND_KIND';
  const start = source.indexOf(marker);
  assert.ok(start >= 0 && source.indexOf(marker, start + marker.length) < 0, 'Exactly one literal taxonomy declaration required');
  assert.ok(start === 0 || source[start - 1] === '\n', 'Taxonomy declaration must start a source line');
  assertCodeAnchor(source.slice(0, start));
  const header = /^const COMMAND_KIND\s*:\s*Readonly\s*<\s*Record\s*<\s*string\s*,\s*TracedDecisionKind\s*>\s*>\s*=\s*\{/u.exec(source.slice(start));
  assert.ok(header, 'Unsupported taxonomy declaration grammar');
  const bodyStart = start + header[0].length, end = source.indexOf('}', bodyStart);
  assert.ok(end >= bodyStart && /^\}\s*;/u.test(source.slice(end)), 'Taxonomy literal must end with };');
  const body = source.slice(bodyStart, end), actual: Record<string, string> = {};
  const entry = /\s*([a-z][a-z0-9_]*)\s*:\s*(?:"([a-z][a-z0-9_]*)"|'([a-z][a-z0-9_]*)')\s*(,|$)/uy;
  let offset = 0;
  while (body.slice(offset).trim().length > 0) {
    entry.lastIndex = offset;
    const match = entry.exec(body);
    assert.ok(match, 'Unsupported taxonomy entry grammar');
    const key = match[1], value = match[2] ?? match[3];
    assert.ok(key !== undefined && value !== undefined && Object.hasOwn(expected, key), 'Unknown taxonomy key');
    assert.ok(!Object.hasOwn(actual, key), 'Duplicate taxonomy key');
    actual[key] = value;
    offset = entry.lastIndex;
  }
  assert.deepEqual(actual, expected, 'Outcome classifier taxonomy differs from current engine');
  return createHash('sha256').update(source).digest('hex');
}
