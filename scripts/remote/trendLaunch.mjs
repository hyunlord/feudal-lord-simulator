// Starts the per-commit trend run (scripts/remote/run.sh --task trend) for a pushed trunk commit, fully apart from the
// push. The pre-push hook calls it; it returns as soon as the run's own process exists, so the push never waits.
//   node scripts/remote/trendLaunch.mjs <sha> <log file>        prints the background pid, or exits 1 ("시작 실패")
// The background process is a new session (setsid: no terminal, out of the push's process group, so a caller that kills
// the push does not kill it), its stdin is /dev/null and its stdout/stderr go to the log: nothing of the push's is held.
// It runs run.sh (with FLS_REMOTE_DETACH=1 the DGX run is a systemd scope that survives the ssh), then writes one line:
//   trend <sha8>: 시작됨 (<run>)            run.sh reported the detached DGX run
//   trend <sha8>: 시작 실패 — <reason>      run.sh failed, timed out, or did not report a detached run
// FLS_TREND_LAUNCH_CMD replaces run.sh (tests); FLS_TREND_LAUNCH_TIMEOUT_MS bounds the start (default 20 min: the
// first sync of a fresh checkout can take minutes).
import { spawn } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, openSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const top = resolve(here, '..', '..');
const stamp = () => new Date().toLocaleString('sv-SE'); // local time, as the rest of the log

function launch(sha, log) {
  mkdirSync(dirname(log), { recursive: true });
  const fd = openSync(log, 'a');
  const child = spawn(process.execPath, [fileURLToPath(import.meta.url), '--run', sha, log],
    { cwd: top, detached: true, stdio: ['ignore', fd, fd], env: process.env });
  child.on('error', error => { appendFileSync(log, `${stamp()} trend ${sha.slice(0, 8)}: 시작 실패 — ${error.message}\n`); process.exit(1); });
  if (child.pid === undefined) { appendFileSync(log, `${stamp()} trend ${sha.slice(0, 8)}: 시작 실패 — no process\n`); process.exit(1); }
  child.unref();
  process.stdout.write(`${child.pid}\n`);
}

function run(sha, log) {
  const short = sha.slice(0, 8);
  const custom = process.env.FLS_TREND_LAUNCH_CMD;
  const [command, ...args] = custom ? ['/bin/sh', '-c', custom] : [join(top, 'scripts/remote/run.sh'), '--task', 'trend', '--commits', sha];
  const timeoutMs = Number(process.env.FLS_TREND_LAUNCH_TIMEOUT_MS ?? 20 * 60_000);
  appendFileSync(log, `${stamp()} trend ${short}: launching (pid ${process.pid})\n`);
  const child = spawn(command, args, { cwd: top, stdio: ['ignore', 'pipe', 'pipe'],
    // The run is named after the measured commit: run.sh appends the checkout's own commit, so a plain "infra-TREND"
    // collided whenever two pushes went from one checkout ("already running", 2026-10-02).
    env: { ...process.env, FLS_REMOTE_LABEL: `infra-TREND-${short}`, FLS_REMOTE_DETACH: '1' } });
  let output = '';
  const keep = chunk => { const text = chunk.toString(); output += text; appendFileSync(log, text); };
  child.stdout.on('data', keep); child.stderr.on('data', keep);
  const timer = setTimeout(() => { child.kill('SIGTERM'); finish(`시작 실패 — ${Math.round(timeoutMs / 1000)}초 안에 DGX 실행이 시작되지 않음`); }, timeoutMs);
  let done = false;
  function finish(line) { if (done) return; done = true; clearTimeout(timer); appendFileSync(log, `${stamp()} trend ${short}: ${line}\n`); process.exit(0); }
  child.on('error', error => finish(`시작 실패 — ${error.message}`));
  child.on('close', code => {
    const started = /remote: (\S+) running detached/.exec(output);
    if (code === 0 && started) finish(`시작됨 (${started[1]})`);
    else finish(`시작 실패 — run.sh exit ${code}${started ? '' : ', no detached run reported'}: ${output.trim().split('\n').slice(-1)[0] ?? ''}`);
  });
}

const [mode, sha, log] = process.argv[2] === '--run' ? ['run', process.argv[3], process.argv[4]] : ['launch', process.argv[2], process.argv[3]];
if (!sha || !log) { console.error('usage: node scripts/remote/trendLaunch.mjs <sha> <log file>'); process.exit(2); }
if (!existsSync(join(top, 'scripts/remote/run.sh')) && !process.env.FLS_TREND_LAUNCH_CMD) { appendFileSync(log, `${stamp()} trend ${sha.slice(0, 8)}: 시작 실패 — no scripts/remote/run.sh\n`); process.exit(1); }
if (mode === 'run') run(sha, log); else launch(sha, log);
