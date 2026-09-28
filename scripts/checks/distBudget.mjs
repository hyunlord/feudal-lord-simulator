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
// BUDGET-1b "시작 시 불러오는 그림 메모리" (reported, no budget): the decoded size (width × height × 4, from each file's
// PNG/JPEG header in the build) of the images the startup preload requests at a chapter-1 campaign start and of the
// whole startup preload (the sandbox, and every start before BUDGET-1b). The lists come from the runtime's own preload
// functions (scripts/checks/startupArtList.ts, run with tsx); images drawn later load on first draw and are not in it.
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

/** Width and height from a PNG (IHDR) or JPEG (first SOFn) header; null for anything else. */
export function imageSize(bytes) {
  if (bytes.length >= 24 && bytes.readUInt32BE(0) === 0x89504e47 && bytes.toString('latin1', 12, 16) === 'IHDR') {
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  }
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let at = 2;
    while (at + 9 < bytes.length) {
      if (bytes[at] !== 0xff) return null;
      const marker = bytes[at + 1];
      if (marker === 0xff) { at += 1; continue; }
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { at += 2; continue; }
      // SOF0…SOF15 carry the frame size; C4 (DHT), C8 (JPG) and CC (DAC) share the range but do not.
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { width: bytes.readUInt16BE(at + 7), height: bytes.readUInt16BE(at + 5) };
      }
      at += 2 + bytes.readUInt16BE(at + 2);
    }
  }
  return null;
}

/** The startup preload's lists by chapter (scripts/checks/startupArtList.ts in `cwd`), or null when `cwd` has no such script. */
export function startupArtLists({ cwd }) {
  const script = join(cwd, 'scripts', 'checks', 'startupArtList.ts');
  if (!existsSync(script)) return null;
  const run = spawnSync(join(cwd, 'node_modules', '.bin', 'tsx'), [script], { cwd, encoding: 'utf8', maxBuffer: 64 * 2 ** 20 });
  if (run.status !== 0) throw new Error(`startupArtList failed (exit ${run.status})\n${`${run.stdout}${run.stderr}`.trim().split('\n').slice(-20).join('\n')}`);
  return JSON.parse(run.stdout);
}

/** Decoded bytes (width × height × 4) of `paths` read from `dir`, split by budget category; missing or unreadable files listed. */
export function decodedImageMemory(paths, dir, config) {
  const categories = new Map(); const missing = []; let bytes = 0; let fileBytes = 0;
  for (const path of paths) {
    const full = join(dir, path);
    const size = existsSync(full) ? imageSize(readFileSync(full)) : null;
    if (size === null) { missing.push(path); continue; }
    const decoded = size.width * size.height * 4;
    const category = categorize(path, config)?.category ?? OTHER;
    const row = categories.get(category) ?? { category, images: 0, bytes: 0 };
    row.images += 1; row.bytes += decoded; categories.set(category, row);
    bytes += decoded; fileBytes += statSync(full).size;
  }
  return { images: paths.length - missing.length, bytes, fileBytes, byCategory: [...categories.values()].sort((a, b) => b.bytes - a.bytes), missing };
}

/** The "시작 시 불러오는 그림 메모리" line: chapter-1 start and the whole startup preload, and what each chapter adds. */
export function measureStartupArt({ cwd, dir, config }) {
  const lists = startupArtLists({ cwd });
  if (lists === null) return null;
  const chapterOne = lists.chapters.find(entry => entry.chapter === 1)?.paths ?? [];
  const first = new Set(chapterOne);
  let previous = first;
  const chapters = lists.chapters.map(entry => {
    const added = entry.paths.filter(path => !previous.has(path));
    previous = new Set(entry.paths);
    return { chapter: entry.chapter, added, ...decodedImageMemory(entry.paths, dir, config) };
  });
  return { chapterOne: decodedImageMemory(chapterOne, dir, config), all: decodedImageMemory(lists.all, dir, config),
    deferred: lists.all.filter(path => !first.has(path)), chapters };
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
  const art = result.startupArt;
  if (art !== undefined && art !== null) {
    const world = memory => memory.byCategory.find(row => row.category === 'world')?.bytes ?? 0;
    lines.push(`startup image memory (decoded w×h×4, no budget): chapter-1 start ${art.chapterOne.images} images ${mb(art.chapterOne.bytes, megabyte)} MB` +
      ` (world ${mb(world(art.chapterOne), megabyte)}); whole preload ${art.all.images} images ${mb(art.all.bytes, megabyte)} MB (world ${mb(world(art.all), megabyte)})`);
    for (const chapter of art.chapters.filter(entry => entry.added.length > 0)) lines.push(`  entering chapter ${chapter.chapter} adds ${chapter.added.length}: ${chapter.added.join(', ')}`);
    const missing = [...new Set([...art.chapterOne.missing, ...art.all.missing])];
    if (missing.length > 0) lines.push(`  ${missing.length} preload image(s) missing or unreadable in the build: ${missing.slice(0, 10).join(', ')}`);
  }
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
  lines.push('', '글꼴은 woff2만 싣는다(BUDGET-1b 판정 2026-09-28, Electron·최신 브라우저 대상): `scripts/woff2OnlyFonts.ts`가 @fontsource CSS의 woff 대체 경로를 빌드 전에 지운다.');
  lines.push('', '범주 안의 구성:', '');
  for (const category of result.categories) {
    for (const rule of [...category.rules].sort((a, b) => b.bytes - a.bytes)) lines.push(`- ${category.name} · ${rule.label}: ${rule.files}개, ${cell(rule.bytes)}`);
  }
  const art = result.startupArt;
  if (art !== undefined && art !== null) {
    const world = memory => cell(memory.byCategory.find(row => row.category === 'world')?.bytes ?? 0);
    lines.push('', '## 시작 시 불러오는 그림 메모리', '',
      '예산 없음(측정만). 시작 때 미리 불러오는 그림(`src/render/preloadGameArt.ts`의 `preloadGameArt`·`preloadFrameArt`, 목록은 `scripts/checks/startupArtList.ts`가 런타임 함수를 돌려 얻는다)의 해제 크기 = 빌드 파일 머리의 가로 × 세로 × 4의 합. 그 뒤 처음 그릴 때 불러오는 그림(지형 변형·구역·날씨·마을 생활 등)과 초상·삽화는 들지 않는다.', '',
      '| 시작 | 그림 | 파일 | 해제 크기 | 그중 세계 그림 |', '|---|---:|---:|---:|---:|',
      `| 1장 시작(캠페인 새 게임) | ${art.chapterOne.images} | ${cell(art.chapterOne.fileBytes)} | ${cell(art.chapterOne.bytes)} | ${world(art.chapterOne)} |`,
      `| 전부(자유 모드, BUDGET-1b 전의 모든 시작) | ${art.all.images} | ${cell(art.all.fileBytes)} | ${cell(art.all.bytes)} | ${world(art.all)} |`, '');
    for (const chapter of art.chapters.filter(entry => entry.added.length > 0)) {
      lines.push(`- ${chapter.chapter}장에 들어갈 때 더함: ${chapter.added.length}개(${chapter.added.map(path => `\`${path}\``).join(', ')}) — 누적 ${cell(chapter.bytes)}`);
    }
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
    return { buildMs, result: { ...evaluateBudget(listDistFiles(outDir), config), startupArt: measureStartupArt({ cwd, dir: outDir, config }) } };
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
    result = { ...evaluateBudget(listDistFiles(dist), config), startupArt: measureStartupArt({ cwd: top, dir: dist, config }) };
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
