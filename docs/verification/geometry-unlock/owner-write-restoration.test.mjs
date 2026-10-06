import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import * as wrapper from './integrated-geometry-prep.wrapper.mjs';

for (const outcome of ['success', 'throw', 'partial-setup']) {
 test(`private fixture write permission restored after ${outcome}`, async () => {
  assert.equal(typeof wrapper.withFixtureWriteRestoration, 'function');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'geometry-unlock-'));
  const source = path.join(root, 'source');
  const target = path.join(root, 'copy');
  fs.mkdirSync(source);
  fs.writeFileSync(path.join(source, 'original'), 'unchanged');
  fs.chmodSync(path.join(source, 'original'), 0o444);
  fs.chmodSync(source, 0o555);
  const failure = new Error(outcome);
  try {
   const task = wrapper.withFixtureWriteRestoration(async register => {
    register(target);
    fs.mkdirSync(path.join(target, 'nested'), { recursive: true });
    fs.copyFileSync(path.join(source, 'original'), path.join(target, 'nested', 'copy'));
    fs.chmodSync(path.join(target, 'nested', 'copy'), 0o444);
    fs.symlinkSync(source, path.join(target, 'source-link'));
    fs.chmodSync(path.join(target, 'nested'), 0o555);
    if (outcome === 'partial-setup') throw failure;
    fs.chmodSync(target, 0o555);
    assert.equal(fs.statSync(target).mode & 0o777, 0o555);
    assert.equal(fs.statSync(path.join(target, 'nested', 'copy')).mode & 0o777, 0o444);
    if (outcome === 'throw') throw failure;
    return 17;
   });
   if (outcome === 'success') assert.equal(await task, 17);
   else await assert.rejects(task, error => error === failure);
   for (const name of [target, path.join(target, 'nested'), path.join(target, 'nested', 'copy')]) {
    assert.ok(fs.statSync(name).mode & 0o200, name);
   }
   assert.equal(fs.statSync(source).mode & 0o777, 0o555);
   assert.equal(fs.statSync(path.join(source, 'original')).mode & 0o777, 0o444);
   assert.equal(fs.readFileSync(path.join(source, 'original'), 'utf8'), 'unchanged');
   fs.rmSync(target, { recursive: true });
   assert.ok(!fs.existsSync(target));
  } finally {
   const writable = p => { const s = fs.lstatSync(p); if (s.isSymbolicLink()) return; fs.chmodSync(p, s.mode | 0o200); if (s.isDirectory()) for (const name of fs.readdirSync(p)) writable(path.join(p, name)); };
   writable(root);
   fs.rmSync(root, { recursive: true });
  }
 });
}
