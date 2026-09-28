// Build output size budget (BUDGET-1): node scripts/checks/distBudget.mjs [--dist <dir> | --build] [--json <path>] [--md <path>]
// Sums the bytes of every file in a Vite build output by category (세계 그림, 초상, 삽화, 키아트, UI, 소리, 코드; 기타
// for a file no rule matches, listed by name) and compares them with the budgets. Categories, rules and budgets are
// one data file, scripts/checks/distBudget.config.json: the first rule whose pattern matches a file's dist-relative
// path decides its category. MB = 1,000,000 bytes. Fails (exit 1) when the total or a budgeted category is over.
//   --dist <dir>  measure an existing build (default: dist)
//   --build       build this checkout into a temporary folder with `vite build --outDir`, measure it, delete it
//                 (the working tree's dist is left alone)
//   --json/--md   also write the result as JSON / as the Korean budget table
// check:merge runs the same measurement (scripts/checks/mergeChecks.mjs, step "budget"); the browser probe
// scripts/imageMemoryProbe.mjs sorts the images a page fetched with the same categorize().
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const CONFIG_PATH = fileURLToPath(new URL('./distBudget.config.json', import.meta.url));
export const OTHER = 'other';

export function loadBudgetConfig(path = CONFIG_PATH) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

/** A path glob as a RegExp: `**` any folders, `*` and `?` within one path segment, `{a,b}` alternatives. */
export function globToRegExp(pattern) {
  let source = ''; let braces = 0;
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === '*' && pattern[i + 1] === '*') {
      const slash = pattern[i + 2] === '/';
      source += slash ? '(?:.*/)?' : '.*';
      i += slash ? 2 : 1;
    } else if (c === '*') source += '[^/]*';
    else if (c === '?') source += '[^/]';
    else if (c === '{') { source += '(?:'; braces += 1; }
    else if (c === '}' && braces > 0) { source += ')'; braces -= 1; }
    else if (c === ',' && braces > 0) source += '|';
    else source += c.replace(/[.+^$()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${source}$`);
}

const compiled = new WeakMap();
function compiledRules(config) {
  let rules = compiled.get(config);
  if (rules === undefined) {
    rules = config.rules.map(rule => ({ ...rule, regexps: rule.patterns.map(globToRegExp) }));
    compiled.set(config, rules);
  }
  return rules;
}

/** The rule a dist-relative path (forward slashes) falls under: { category, label }, or null (기타). */
export function categorize(path, config) {
  const rule = compiledRules(config).find(candidate => candidate.regexps.some(regexp => regexp.test(path)));
  return rule === undefined ? null : { category: rule.category, label: rule.label };
}

/** Every file under `dir` as { path (dist-relative, forward slashes), bytes }, sorted by path. */
export function listDistFiles(dir) {
  const files = [];
  const walk = folder => {
    for (const entry of readdirSync(folder, { withFileTypes: true })) {
      const full = join(folder, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile()) files.push({ path: relative(dir, full).split(sep).join('/'), bytes: statSync(full).size });
    }
  };
  walk(dir);
  return files.sort((a, b) => a.path.localeCompare(b.path));
}

const toBytes = (megabytes, config) => megabytes === null ? null : Math.round(megabytes * config.megabyte);

/** Sums `files` ({ path, bytes }) by category and rule and judges them against the budgets. */
export function evaluateBudget(files, config) {
  const categories = config.categories.map(category => ({ id: category.id, name: category.name, bytes: 0, files: 0,
    budgetBytes: toBytes(category.budgetMB, config), rules: [] }));
  const byId = new Map(categories.map(category => [category.id, category]));
  if (!byId.has(OTHER)) throw new Error(`distBudget config: no "${OTHER}" category for unmatched files`);
  const unmatched = [];
  for (const file of files) {
    const rule = categorize(file.path, config);
    const category = byId.get(rule?.category ?? OTHER);
    if (category === undefined) throw new Error(`distBudget config: rule "${rule.label}" names unknown category "${rule.category}"`);
    const label = rule?.label ?? 'unmatched';
    let row = category.rules.find(entry => entry.label === label);
    if (row === undefined) { row = { label, bytes: 0, files: 0 }; category.rules.push(row); }
    category.bytes += file.bytes; category.files += 1; row.bytes += file.bytes; row.files += 1;
    if (rule === null) unmatched.push(file);
  }
  for (const category of categories) category.pass = category.budgetBytes === null || category.bytes <= category.budgetBytes;
  const bytes = files.reduce((sum, file) => sum + file.bytes, 0);
  const totalBudget = toBytes(config.totalBudgetMB, config);
  const total = { bytes, files: files.length, budgetBytes: totalBudget, pass: totalBudget === null || bytes <= totalBudget };
  const over = [...(total.pass ? [] : ['total']), ...categories.filter(category => !category.pass).map(category => category.id)];
  return { megabyte: config.megabyte, categories, total, unmatched, over, pass: over.length === 0 };
}

const mb = (bytes, megabyte) => (bytes / megabyte).toFixed(2);

/** The result as terminal lines (the check:merge step prints it indented). */
export function formatBudgetTable(result) {
  const { megabyte } = result;
  const rows = [...result.categories, { name: '전체', ...result.total }];
  const lines = [`${'category'.padEnd(10)}${'files'.padStart(7)}${'MB'.padStart(9)}${'budget'.padStart(9)}${'headroom'.padStart(10)}  pass`];
  for (const row of rows) {
    const budget = row.budgetBytes === null ? '-' : mb(row.budgetBytes, megabyte);
    const headroom = row.budgetBytes === null ? '-' : mb(row.budgetBytes - row.bytes, megabyte);
    // Hangul is two columns wide in a terminal.
    const name = row.name + ' '.repeat(Math.max(0, 10 - [...row.name].reduce((width, char) => width + (/[ㄱ-힣]/.test(char) ? 2 : 1), 0)));
    lines.push(`${name}${String(row.files).padStart(7)}${mb(row.bytes, megabyte).padStart(9)}${budget.padStart(9)}${headroom.padStart(10)}  ${row.budgetBytes === null ? '' : row.pass ? 'ok' : 'OVER'}`);
  }
  lines.push(`MB = ${megabyte.toLocaleString('en-US')} bytes`);
  if (result.unmatched.length > 0) {
    lines.push(`${result.unmatched.length} file(s) no rule matches (counted as 기타; add a rule to scripts/checks/distBudget.config.json):`);
    for (const file of result.unmatched.slice(0, 20)) lines.push(`  ${file.path} (${file.bytes} bytes)`);
    if (result.unmatched.length > 20) lines.push(`  ... ${result.unmatched.length - 20} more`);
  }
  return lines.join('\n');
}

/** The Korean budget table (docs/verification/budget1/BUDGET.md). */
export function formatBudgetMarkdown(result, { sha, buildMs }) {
  const { megabyte } = result;
  const cell = bytes => bytes === null ? '—' : `${mb(bytes, megabyte)} MB`;
  const lines = [
    '# 빌드 결과(dist) 크기 예산표',
    '',
    `측정: \`${sha}\` 빌드(\`vite build\`, ${(buildMs / 1000).toFixed(1)}초). MB = ${megabyte.toLocaleString('en-US')}바이트. 규칙·예산 원본은 \`scripts/checks/distBudget.config.json\`, 병합 전 검사(\`npm run check:merge\`)가 전체나 예산 있는 범주가 넘으면 실패한다.`,
    '',
    '| 범주 | 파일 | 크기 | 예산 | 남은 폭 | 판정 |',
    '|---|---:|---:|---:|---:|---|',
  ];
  for (const row of [...result.categories, { name: '**전체**', ...result.total }]) {
    const headroom = row.budgetBytes === null ? '—' : cell(row.budgetBytes - row.bytes);
    lines.push(`| ${row.name} | ${row.files} | ${cell(row.bytes)} | ${cell(row.budgetBytes)} | ${headroom} | ${row.budgetBytes === null ? '—' : row.pass ? '통과' : '초과'} |`);
  }
  lines.push('', '범주 안의 구성:', '');
  for (const category of result.categories) {
    for (const rule of [...category.rules].sort((a, b) => b.bytes - a.bytes)) lines.push(`- ${category.name} · ${rule.label}: ${rule.files}개, ${cell(rule.bytes)}`);
  }
  lines.push('', result.unmatched.length === 0 ? '규칙에 안 걸린 파일(기타): 없음.' : `규칙에 안 걸린 파일(기타) ${result.unmatched.length}개: ${result.unmatched.map(file => `\`${file.path}\``).join(', ')}.`);
  return `${lines.join('\n')}\n`;
}

/** `vite build` of `cwd` into `outDir`; the build time in ms. Throws with the build's output when it fails. */
export function buildDist({ cwd, outDir }) {
  const vite = join(cwd, 'node_modules', '.bin', 'vite');
  const started = Date.now();
  const run = spawnSync(vite, ['build', '--outDir', outDir, '--emptyOutDir', '--logLevel', 'error'], { cwd, encoding: 'utf8',
    env: { ...process.env, VITE_CONFIG_NATIVE_IGNORE_WARNING: 'true' }, maxBuffer: 64 * 2 ** 20 });
  if (run.status !== 0) throw new Error(`vite build failed (exit ${run.status})\n${`${run.stdout}${run.stderr}`.trim().split('\n').slice(-20).join('\n')}`);
  return Date.now() - started;
}

/** Builds `cwd` into a temporary folder, measures it, deletes the folder. */
export function measureBuild({ cwd, config = loadBudgetConfig() }) {
  const outDir = mkdtempSync(join(tmpdir(), 'fls-dist-budget-'));
  try {
    const buildMs = buildDist({ cwd, outDir });
    return { buildMs, result: evaluateBudget(listDistFiles(outDir), config) };
  } finally {
    rmSync(outDir, { recursive: true, force: true });
  }
}

async function main() {
  const argv = process.argv.slice(2);
  const flag = name => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : undefined; };
  const top = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
  const sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: top, encoding: 'utf8' }).trim();
  const dirty = execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: top, encoding: 'utf8' }).trim() !== '';
  const config = loadBudgetConfig();
  let buildMs = null; let result;
  if (argv.includes('--build')) ({ buildMs, result } = measureBuild({ cwd: top, config }));
  else {
    const dist = resolve(flag('dist') ?? join(top, 'dist'));
    if (!existsSync(dist)) throw new Error(`${dist} does not exist: run npm run build, or pass --build`);
    result = evaluateBudget(listDistFiles(dist), config);
  }
  console.log(`dist budget at ${sha.slice(0, 8)}${dirty ? ' (working tree modified)' : ''}${buildMs === null ? '' : `, built in ${(buildMs / 1000).toFixed(1)} s`}`);
  console.log(formatBudgetTable(result));
  const json = flag('json');
  if (json !== undefined) {
    mkdirSync(dirname(resolve(json)), { recursive: true });
    writeFileSync(json, `${JSON.stringify({ sha, dirty, buildMs, unit: `MB = ${config.megabyte} bytes`, ...result }, null, 1)}\n`);
  }
  const md = flag('md');
  if (md !== undefined) {
    mkdirSync(dirname(resolve(md)), { recursive: true });
    writeFileSync(md, formatBudgetMarkdown(result, { sha: sha.slice(0, 8), buildMs: buildMs ?? 0 }));
  }
  process.exitCode = result.pass ? 0 : 1;
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
