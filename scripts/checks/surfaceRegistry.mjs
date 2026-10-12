// UI-AUDIT-1: no framed surface outside the surface registry (src/ui/surfaces.registry.ts).
//   node scripts/checks/surfaceRegistry.mjs [--head <rev>]        (a check:merge step; tests/surfacesRegistry.test.ts reads the tree)
// A candidate is one of:
//  - dialog:  an element with role="dialog" in src/ui/**, src/render/*.tsx or src/App.tsx (the kit's own Modal aside);
//  - class:   a class name in a className of those files that names a framed thing (…-panel, -card, -modal, -drawer,
//             -popover, -tooltip, -chip, -page, -book, -sheet, -dialog, or the word itself);
//  - frame:   an element with a data-frame attribute (the frame tokens' framed root) in those files: its class names;
//  - css:     the subject of a CSS selector (src/styles/*.css, src/ui/**/*.css) that sets a border-image.
// It is registered when one of its class names appears in a selector string of the registry, or is a key of its
// NOT_SURFACES (a control, a part of a registered surface, an unmounted component, with the reason). Every other one
// fails with its file:line.
import { execFileSync, spawnSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { gitPaths } from '../gitPaths.mjs';
import { git, isMain } from './gitRange.mjs';

export const REGISTRY_PATH = 'src/ui/surfaces.registry.ts';
/** A file of registry rows spread into the registry (LM-R2: each lord screen area's). */
export const isRegistryPart = path => /^src\/ui\/lord\/[^/]+\/surfaces\.ts$/.test(path);
const FRAMED_WORD = /(^|-)(panel|card|modal|drawer|popover|tooltip|chip|page|book|sheet|dialog)$/;

/** Blanks comments (block and line) and keeps every newline, so offsets still give line numbers. */
export function stripComments(text, { css = false } = {}) {
  const blank = match => match.replace(/[^\n]/g, ' ');
  if (css) return text.replace(/\/\*[\s\S]*?\*\//g, blank);
  // Strings first so a "//" inside a string or a URL is not a comment.
  return text.replace(/("(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|`(?:\\.|[^`\\])*`)|\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, (match, string) => string ?? blank(match));
}

const lineAt = (text, index) => text.slice(0, index).split('\n').length;

/** Class names the registry covers: every `.class` in its string literals, and the keys of NOT_SURFACES. */
export function registeredClasses(registryText) {
  const text = stripComments(registryText);
  const names = new Set();
  for (const literal of text.matchAll(/"((?:\\.|[^"\\\n])*)"|'((?:\\.|[^'\\\n])*)'|`((?:\\.|[^`\\])*)`/g)) {
    const body = literal[1] ?? literal[2] ?? literal[3] ?? '';
    for (const match of body.matchAll(/\.(-?[A-Za-z_][\w-]*)/g)) names.add(match[1]);
  }
  const exempt = text.indexOf('NOT_SURFACES');
  if (exempt >= 0) for (const match of text.slice(exempt).matchAll(/"([A-Za-z_][\w-]*)"\s*:/g)) names.add(match[1]);
  return names;
}

/** The texts of the string literals in an expression, template parts and the literals inside their ${…} included. */
function literalTexts(text) {
  const out = [];
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"' || char === "'") {
      const end = text.indexOf(char, index + 1); if (end < 0) break;
      out.push(text.slice(index + 1, end)); index = end;
    } else if (char === '`') {
      let segment = ''; let at = index + 1;
      while (at < text.length && text[at] !== '`') {
        if (text[at] === '$' && text[at + 1] === '{') {
          let depth = 1; let end = at + 2;
          for (; end < text.length && depth > 0; end += 1) { if (text[end] === '{') depth += 1; else if (text[end] === '}') depth -= 1; }
          out.push(...literalTexts(text.slice(at + 2, end - 1))); segment += ' '; at = end;
        } else { segment += text[at]; at += 1; }
      }
      out.push(segment); index = at;
    }
  }
  return out;
}

/** The value of a className attribute starting at `index` (just after `className=`): its class tokens. */
function classTokens(text, index) {
  let expression;
  if (text[index] === '"' || text[index] === "'") expression = text.slice(index, text.indexOf(text[index], index + 1) + 1);
  else if (text[index] === '{') {
    let depth = 0; let end = index;
    for (; end < text.length; end += 1) {
      if (text[end] === '{') depth += 1;
      else if (text[end] === '}') { depth -= 1; if (depth === 0) break; }
    }
    expression = text.slice(index + 1, end);
  } else return [];
  return literalTexts(expression).flatMap(body => body.split(/\s+/)).filter(token => /^[A-Za-z_][\w-]*$/.test(token));
}

/** Candidates in one TSX file: framed class names and dialog roots. */
export function tsxCandidates(path, source) {
  const text = stripComments(source);
  const rows = [];
  for (const match of text.matchAll(/className=/g)) {
    for (const token of classTokens(text, match.index + match[0].length)) {
      if (FRAMED_WORD.test(token)) rows.push({ kind: 'class', path, line: lineAt(text, match.index), names: [token] });
    }
  }
  const tagClasses = index => {
    const tag = text.slice(text.lastIndexOf('<', index), text.indexOf('>', index));
    const at = tag.indexOf('className=');
    return at < 0 ? [] : classTokens(tag, at + 'className='.length);
  };
  // A framed root (data-frame="<kind>", or the object-spread form "data-frame": kind).
  if (!path.startsWith('src/ui/kit/')) {
    for (const match of text.matchAll(/\bdata-frame=|"data-frame":/g)) {
      // A root with no class of its own (<p data-frame=…> in a Disclosure) is named by the nearest className before it.
      const before = text.lastIndexOf('className=', match.index);
      const own = match[0] === 'data-frame=' ? tagClasses(match.index) : [];
      const names = match[0] === 'data-frame=' ? (own.length > 0 || before < 0 ? own : classTokens(text, before + 'className='.length))
        : literalTexts(text.slice(text.lastIndexOf('{', match.index), text.indexOf('}', match.index) + 1).replace(/"data-frame":\s*"[^"]*"/, '')).flatMap(body => body.split(/\s+/)).filter(token => /^[A-Za-z_][\w-]*$/.test(token));
      rows.push({ kind: 'frame', path, line: lineAt(text, match.index), names });
    }
  }
  if (!path.startsWith('src/ui/kit/')) {
    for (const match of text.matchAll(/role=["{]["']?dialog\b/g)) {
      const open = text.lastIndexOf('<', match.index);
      const close = text.indexOf('>', match.index);
      const tag = text.slice(open, close);
      const at = tag.indexOf('className=');
      const names = at < 0 ? [] : classTokens(tag, at + 'className='.length);
      rows.push({ kind: 'dialog', path, line: lineAt(text, match.index), names });
    }
  }
  return rows;
}

/** Splits on `separator` outside parentheses. */
function splitTop(text, separator) {
  const parts = []; let depth = 0; let start = 0;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '(') depth += 1; else if (char === ')') depth -= 1;
    else if (depth === 0 && separator.test(char)) { parts.push(text.slice(start, index)); start = index + 1; }
  }
  parts.push(text.slice(start));
  return parts.map(part => part.trim()).filter(Boolean);
}

/** The class sets a selector's subject can be: one per :is()/:where() alternative; the nearest classed compound for a bare tag. */
export function subjectClassSets(selector) {
  const compounds = splitTop(selector, /[\s>+~]/);
  for (let index = compounds.length - 1; index >= 0; index -= 1) {
    const compound = compounds[index].replace(/:not\((?:[^()]|\([^()]*\))*\)/g, '');
    const own = [...compound.replace(/:(?:is|where)\((?:[^()]|\([^()]*\))*\)/g, '').matchAll(/\.(-?[A-Za-z_][\w-]*)/g)].map(match => match[1]);
    const lists = [...compound.matchAll(/:(?:is|where)\(((?:[^()]|\([^()]*\))*)\)/g)].map(match => splitTop(match[1], /,/));
    const sets = lists.length === 0 ? [own] : lists.flat().map(alternative => [...own, ...[...alternative.matchAll(/\.(-?[A-Za-z_][\w-]*)/g)].map(match => match[1])]);
    if (sets.some(set => set.length > 0)) return sets.filter(set => set.length > 0);
  }
  return [];
}

/** Candidates in one stylesheet: the subjects of rules that set a border-image (other than none). */
export function cssCandidates(path, source) {
  const text = stripComments(source, { css: true });
  const rows = [];
  for (const match of text.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const value = /(?:^|[;\s])border-image(?:-source)?\s*:\s*([^;]+)/.exec(match[2]);
    if (value === null || /^\s*(none|initial|unset|inherit|revert)\b/.test(value[1])) continue;
    const selectorText = match[1].trim();
    if (selectorText.startsWith('@')) continue;
    const line = lineAt(text, match.index + match[1].indexOf(selectorText));
    for (const selector of splitTop(selectorText, /,/)) {
      for (const names of subjectClassSets(selector)) rows.push({ kind: 'css', path, line, names, selector });
    }
  }
  return rows;
}

/** Files and contents to scan, from a reader ({ list(prefix) → paths, read(path) → text }). */
export function unregisteredSurfaces(reader) {
  const paths = reader.list();
  // LM-R2: the lord screens' rows live in one file per area (src/ui/lord/<area>/surfaces.ts), spread into the registry.
  const registered = new Set([REGISTRY_PATH, ...paths.filter(isRegistryPart)].flatMap(path => [...registeredClasses(reader.read(path))]));
  const tsx = paths.filter(path => (/^src\/ui\/.+\.tsx$/.test(path) || /^src\/render\/[^/]+\.tsx$/.test(path) || path === 'src/App.tsx'));
  const css = paths.filter(path => /^src\/styles\/[^/]+\.css$/.test(path) || /^src\/ui\/.+\.css$/.test(path));
  const candidates = [...tsx.flatMap(path => tsxCandidates(path, reader.read(path))), ...css.flatMap(path => cssCandidates(path, reader.read(path)))];
  const missing = candidates.filter(row => !row.names.some(name => registered.has(name)));
  // One line per place and name.
  const seen = new Set();
  return { candidates: candidates.length, registered: registered.size, missing: missing.filter(row => {
    const key = `${row.path}:${row.line}:${row.kind}:${row.names.join('.')}`; if (seen.has(key)) return false; seen.add(key); return true;
  }) };
}

/** Reads the working tree under `root`. */
export function treeReader(root) {
  const walk = dir => readdirSync(join(root, dir)).flatMap(name => {
    const path = `${dir}/${name}`;
    return statSync(join(root, path)).isDirectory() ? walk(path) : [path];
  });
  return { list: () => ['src/ui', 'src/render', 'src/styles'].flatMap(walk).concat(['src/App.tsx']), read: path => readFileSync(join(root, path), 'utf8') };
}

/** Reads git objects at `head` (one cat-file process for all contents). */
export function gitReader(head, cwd = process.cwd()) {
  const list = () => gitPaths(['ls-tree', '-r', '--name-only', head, '--', 'src/ui', 'src/render', 'src/styles', 'src/App.tsx'], { cwd });
  const cache = new Map();
  const read = path => {
    if (!cache.has(path)) {
      const wanted = [path, ...list().filter(other => other !== path && !cache.has(other) && /\.(tsx|css|ts)$/.test(other))];
      const run = spawnSync('git', ['cat-file', '--batch'], { cwd, input: wanted.map(name => `${head}:${name}`).join('\n') + '\n', maxBuffer: 256 * 2 ** 20 });
      const out = run.stdout; let offset = 0;
      for (const name of wanted) {
        const newline = out.indexOf(10, offset);
        const header = out.subarray(offset, newline).toString('utf8');
        const size = Number(header.split(' ')[2]);
        if (header.endsWith('missing') || !Number.isFinite(size)) { offset = newline + 1; cache.set(name, null); continue; }
        cache.set(name, out.subarray(newline + 1, newline + 1 + size).toString('utf8'));
        offset = newline + 1 + size + 1;
      }
    }
    const text = cache.get(path);
    if (text === null || text === undefined) throw new Error(`${path} is not in ${head.slice(0, 8)}`);
    return text;
  };
  return { list, read };
}

export function checkSurfaceRegistry({ head, cwd = process.cwd() }) {
  try { execFileSync('git', ['cat-file', '-e', `${head}:${REGISTRY_PATH}`], { cwd, stdio: 'ignore' }); } catch { return { skipped: true, missing: [] }; }
  return unregisteredSurfaces(gitReader(head, cwd));
}

export function formatSurfaceRegistryResult(result) {
  if (result.skipped) return `surfaces: skipped (no ${REGISTRY_PATH} at this commit)`;
  if (result.missing.length === 0) return `surfaces: ${result.candidates} framed candidate(s), all in the registry`;
  const lines = [`surfaces: ${result.missing.length} framed candidate(s) not in ${REGISTRY_PATH} (add a row, or a NOT_SURFACES entry with the reason)`];
  for (const row of result.missing) lines.push(`  ${row.path}:${row.line} ${row.kind} ${row.names.length === 0 ? '(no class name)' : row.names.join('.')}`);
  return lines.join('\n');
}

if (isMain(import.meta.url)) {
  const index = process.argv.indexOf('--head');
  const head = git(['rev-parse', '--verify', `${index > 0 ? process.argv[index + 1] : 'HEAD'}^{commit}`]).trim();
  const result = checkSurfaceRegistry({ head });
  console.log(formatSurfaceRegistryResult(result));
  process.exitCode = result.missing.length > 0 ? 1 : 0;
}
