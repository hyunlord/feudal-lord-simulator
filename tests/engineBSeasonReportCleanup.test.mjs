import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';
import { stopOwnedServer } from '../scripts/engineBSeasonReportCapture.mjs';

const child = () => Object.assign(new EventEmitter(), { pid: 43210, exitCode: null, signalCode: null });

test('normal shutdown terminates the owned group and clears descendants after leader exit', async t => {
  const server = child(), signals = [];
  t.mock.method(process, 'kill', (pid, signal) => {
    signals.push([pid, signal]);
    if (signal === 'SIGTERM') queueMicrotask(() => { server.exitCode = 0; server.emit('exit', 0); });
    return true;
  });
  await stopOwnedServer(server);
  assert.deepEqual(signals, [[-43210, 'SIGTERM'], [-43210, 'SIGKILL']]);
  assert.equal(server.listenerCount('exit'), 0);
});

test('a surviving group is still cleared when its leader has already exited', async t => {
  const server = child(), signals = []; server.exitCode = 0;
  t.mock.method(process, 'kill', (pid, signal) => { signals.push([pid, signal]); return true; });
  await stopOwnedServer(server);
  assert.deepEqual(signals, [[-43210, 'SIGKILL']]);
});

test('forced shutdown escalates the whole group under a fake clock', async t => {
  const server = child(), signals = [];
  t.mock.timers.enable({ apis: ['setTimeout'] });
  t.mock.method(process, 'kill', (pid, signal) => {
    signals.push([pid, signal]);
    if (signal === 'SIGKILL' && server.signalCode === null) {
      server.signalCode = 'SIGKILL'; queueMicrotask(() => server.emit('exit', null, 'SIGKILL'));
    }
    return true;
  });
  const stopping = stopOwnedServer(server);
  t.mock.timers.tick(3000);
  await stopping;
  assert.deepEqual(signals, [[-43210, 'SIGTERM'], [-43210, 'SIGKILL'], [-43210, 'SIGKILL']]);
});

test('missing groups are harmless but permission failures remain failures', async t => {
  const server = child(); server.exitCode = 0;
  const kill = t.mock.method(process, 'kill', () => { throw Object.assign(new Error('gone'), { code: 'ESRCH' }); });
  await stopOwnedServer(server);
  kill.mock.mockImplementation(() => { throw Object.assign(new Error('denied'), { code: 'EPERM' }); });
  await assert.rejects(stopOwnedServer(server), /denied/);
});
