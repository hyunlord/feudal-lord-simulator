/**
 * Rule-file diff (BOT-1 gate ②): the game rules are every source file the simulation tick and the action reducer
 * import, directly or through other files (`src/engine/tick.ts`, `src/state/gameStore.ts`). A bot-only change touches
 * none of them. Prints the changed files against a base commit, split into rule files and the rest, and fails when a
 * rule file changed.
 *
 *   npx tsx scripts/ruleClosureDiff.ts <base-commit>
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, normalize, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const RULE_ENTRY_POINTS = ['src/engine/tick.ts', 'src/state/gameStore.ts'] as const;

const IMPORT = /(?:import|export)\s[^'"]*?from\s+['"](\.[^'"]+)['"]|import\(\s*['"](\.[^'"]+)['"]\s*\)/g;

function resolveImport(from: string, specifier: string): string | null {
  const base = normalize(join(dirname(from), specifier));
  for (const candidate of [`${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), base]) {
    const path = resolve(ROOT, candidate);
    if (existsSync(path) && statSync(path).isFile()) return relative(ROOT, path);
  }
  return null;
}

export function ruleClosure(entries: readonly string[] = RULE_ENTRY_POINTS): ReadonlySet<string> {
  const seen = new Set<string>();
  const stack = [...entries];
  while (stack.length > 0) {
    const file = stack.pop();
    if (file === undefined || seen.has(file)) continue;
    seen.add(file);
    for (const match of readFileSync(resolve(ROOT, file), 'utf8').matchAll(IMPORT)) {
      const next = resolveImport(file, match[1] ?? match[2] ?? '');
      if (next !== null && !seen.has(next)) stack.push(next);
    }
  }
  return seen;
}

function main(args: readonly string[]) {
  const base = args[0];
  if (base === undefined) throw new RangeError('Usage: ruleClosureDiff.ts <base-commit>');
  const closure = ruleClosure();
  const changed = execFileSync('git', ['diff', '--numstat', base, '--', 'src'], { cwd: ROOT, encoding: 'utf8' })
    .split('\n').filter(Boolean).map(line => {
      const [added, removed, file] = line.split('\t');
      return { file: file ?? '', lines: Number(added) + Number(removed) };
    });
  const rules = changed.filter(entry => closure.has(entry.file));
  const result = { base, ruleFiles: closure.size, ruleFilesChanged: rules, ruleLinesChanged: rules.reduce((sum, entry) => sum + entry.lines, 0),
    otherSourceChanged: changed.filter(entry => !closure.has(entry.file)) };
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (rules.length > 0) process.exitCode = 1;
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.slice(2));
