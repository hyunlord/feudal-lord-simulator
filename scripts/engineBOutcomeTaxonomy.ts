import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import ts from '../tools/eslint/node_modules/typescript/lib/typescript.js';

/** Fail before simulation if the engine's private command taxonomy has drifted. No source evaluation. */
export function verifyOutcomeTaxonomy(source: string, expected: Readonly<Record<string, string>>): string {
  const file = ts.createSourceFile('decisionTrace.ts', source, ts.ScriptTarget.Latest, true);
  const candidates: ts.VariableDeclaration[] = [];
  function visit(node: ts.Node): void {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === 'COMMAND_KIND') candidates.push(node);
    ts.forEachChild(node, visit);
  }
  visit(file);
  const declaration = candidates[0];
  assert.equal(candidates.length, 1, 'Exactly one engine COMMAND_KIND required');
  assert.ok(declaration?.initializer && ts.isObjectLiteralExpression(declaration.initializer), 'Literal engine taxonomy required');
  const actual: Record<string, string> = {};
  for (const property of declaration.initializer.properties) {
    assert.ok(ts.isPropertyAssignment(property) && (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name))
      && ts.isStringLiteral(property.initializer), 'Only literal taxonomy properties supported');
    assert.ok(!Object.hasOwn(actual, property.name.text), 'Duplicate taxonomy key');
    actual[property.name.text] = property.initializer.text;
  }
  assert.deepEqual(actual, expected, 'Outcome classifier taxonomy differs from current engine');
  return createHash('sha256').update(source).digest('hex');
}
