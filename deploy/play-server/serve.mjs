// Always-on play server (PLAY-1): serves the current release of the trunk build, nothing else.
//  - Root: $FLS_PLAY_ROOT/current, a symlink the updater swaps atomically; it is resolved on every request, so a new
//    release is live at once and a failed build leaves the old one in place.
//  - /status.json: $FLS_PLAY_ROOT/state/status.json (serving commit, build time, last update and its result).
//  - /status: the same as a small page, with the last update log lines.
//  - Bind: the Tailscale address only (FLS_PLAY_HOST, default 100.70.109.50), port 4173. No auth, no HTTPS
//    (tailnet only, work order PLAY-1). Node built-ins only, no install step.
import { createServer } from 'node:http';
import { readFile, realpath, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { extname, join, normalize, sep } from 'node:path';

const ROOT = process.env.FLS_PLAY_ROOT ?? join(homedir(), 'fls-play');
const HOST = process.env.FLS_PLAY_HOST ?? '100.70.109.50';
const PORT = Number(process.env.FLS_PLAY_PORT ?? 4173);
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
  '.woff': 'font/woff', '.ttf': 'font/ttf', '.txt': 'text/plain; charset=utf-8', '.map': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm', '.gz': 'application/gzip',
};

const escapeHtml = value => String(value).replace(/[&<>"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char]);

async function status() {
  try { return JSON.parse(await readFile(join(ROOT, 'state', 'status.json'), 'utf8')); } catch { return { lastResult: 'no status yet' }; }
}

async function statusPage() {
  const current = await status();
  let log = '';
  try { log = (await readFile(join(ROOT, 'state', 'updates.log'), 'utf8')).trim().split('\n').slice(-20).join('\n'); } catch { /* no log yet */ }
  const rows = Object.entries(current).map(([key, value]) => `<tr><th>${escapeHtml(key)}</th><td>${escapeHtml(typeof value === 'string' ? value : JSON.stringify(value))}</td></tr>`).join('');
  const failed = String(current.lastResult ?? '').startsWith('failed');
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>플레이 서버 상태</title><meta http-equiv="refresh" content="30"><style>
body{font:14px/1.5 system-ui,sans-serif;margin:16px;background:#f5f1e8;color:#2b2419}h1{font-size:18px}
table{border-collapse:collapse}th,td{text-align:left;padding:4px 10px;border-bottom:1px solid #d8cfbd;vertical-align:top}
.result{font-weight:600;color:${failed ? '#a3261b' : '#2f6b2a'}}pre{background:#fffaf0;border:1px solid #d8cfbd;padding:8px;overflow:auto;white-space:pre-wrap}
a{color:#6b3f12}</style></head><body><h1>플레이 서버 상태</h1>
<p class="result">마지막 결과: ${escapeHtml(current.lastResult ?? '-')}</p><p><a href="/">게임 열기</a> · <a href="/status.json">status.json</a> · 30초마다 새로 고침</p>
<table>${rows}</table><h2>최근 갱신 기록</h2><pre>${escapeHtml(log || '(없음)')}</pre></body></html>`;
}

async function releaseFile(pathname) {
  const base = await realpath(join(ROOT, 'current'));
  const relative = normalize(decodeURIComponent(pathname)).replace(/^([/\\])+/, '');
  let file = join(base, relative);
  if (file !== base && !file.startsWith(base + sep)) return null;
  const info = await stat(file).catch(() => null);
  if (info === null || info.isDirectory()) file = join(base, 'index.html');
  return file;
}

const server = createServer(async (request, response) => {
  try {
    const { pathname } = new URL(request.url ?? '/', 'http://play.local');
    if (request.method !== 'GET' && request.method !== 'HEAD') { response.writeHead(405).end(); return; }
    if (pathname === '/status.json') {
      response.writeHead(200, { 'content-type': TYPES['.json'], 'cache-control': 'no-store' });
      response.end(JSON.stringify(await status(), null, 2)); return;
    }
    if (pathname === '/status' || pathname === '/status.html') {
      response.writeHead(200, { 'content-type': TYPES['.html'], 'cache-control': 'no-store' });
      response.end(await statusPage()); return;
    }
    const file = await releaseFile(pathname);
    if (file === null) { response.writeHead(403).end(); return; }
    const body = await readFile(file);
    const type = TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream';
    // Vite's hashed bundles never change under one name; everything else (index.html, public assets) is revalidated.
    const cache = file.includes(`${sep}assets${sep}`) && /-[A-Za-z0-9_-]{8,}\.(js|css)$/.test(file) ? 'public, max-age=31536000, immutable' : 'no-cache';
    response.writeHead(200, { 'content-type': type, 'cache-control': cache, 'content-length': body.length });
    response.end(request.method === 'HEAD' ? undefined : body);
  } catch (error) {
    response.writeHead(error?.code === 'ENOENT' ? 503 : 500, { 'content-type': 'text/plain; charset=utf-8' });
    response.end(error?.code === 'ENOENT' ? 'no release yet — see /status\n' : 'server error\n');
  }
});
server.on('error', error => { console.error(`listen ${HOST}:${PORT} failed: ${error.message}`); process.exit(1); });
server.listen(PORT, HOST, () => console.log(`serving ${join(ROOT, 'current')} on http://${HOST}:${PORT}/`));
