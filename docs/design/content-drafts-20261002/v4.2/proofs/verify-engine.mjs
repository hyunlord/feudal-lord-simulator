// REPO=/path/to/checkout ESBUILD_FROM=/path/to/package.json node proofs/verify-engine.mjs
// Existing esbuild dependency only. Writes a temporary bundle and ENGINE_DELTA_QA.json; never modifies REPO.
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
const root = process.env.REPO ?? '/Users/rexxa/fls-astra-content42';
const out = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
assert.equal(head, '9181ce03394f8be064c131d1ddfae121249e9694', 'Use the audited checkout revision');
const read = p => JSON.parse(readFileSync(p, 'utf8'));
const merge = (base, delta) => [...new Map([...base, ...delta].map(x => [x.id, x])).values()];
const entries = merge(read(join(out, 'records/registry-input.json')), read(join(out, 'registry-v4.2.json')).entries);
const events = merge(read(join(out, 'records/canonical-input.json')), read(join(out, 'events-v4.2.json')));
const canon = join(root, 'docs/design/content-drafts-20261002/v4');
const derived = read(join(canon, 'READ_MODEL.json')).derived;
const policy = read(join(canon, 'registry-v4.json')).policy;
const live = entries.filter(e => !e.unsupportedFilters.length);
const blocked = entries.filter(e => e.unsupportedFilters.length).map(e => ({ id: e.id, contentClass: e.contentClass, blockedBy: e.unsupportedFilters.map(f => f.id) }));
const copy = Object.fromEntries(events.map(e => [e.id, { title: e.title, body: e.body, sender: e.sender?.role ?? e.sender?.faction ?? '', senderFaction: e.sender?.faction ?? '', choices: Object.fromEntries(e.choices.map(c => [c.id, c])) }]));
const { build } = createRequire(process.env.ESBUILD_FROM ?? join(root, 'package.json'))('esbuild');
const temporary = mkdtempSync(join(tmpdir(), 'astra-engine42-'));
try {
  const bundle = join(temporary, 'engine.mjs');
  await build({ stdin: { contents: `export * from './src/engine/registryV4.ts';export * from './src/engine/registryDsl.ts';export * from './src/engine/timberTrade.ts';export * from './src/engine/townAgency.ts';export * from './src/engine/registry.ts';export * from './src/ledger/ledger.ts';export {decodeSave} from './src/save/saveCodec.ts';`, resolveDir: root, loader: 'js' }, outfile: bundle, bundle: true, platform: 'node', format: 'esm', logLevel: 'silent', plugins: [{ name: 'external-data-only', setup(b) {
    b.onLoad({ filter: /v4Entries\.generated\.ts$/ }, () => ({ loader: 'js', contents: `export const V4_LIVE_ENTRIES=${JSON.stringify(live)};export const V4_BLOCKED_ENTRIES=${JSON.stringify(blocked)};export const V4_POLICY=${JSON.stringify(policy)};export const V4_DERIVED=${JSON.stringify(derived)};` }));
    b.onLoad({ filter: /v4Copy\.generated\.ts$/ }, () => ({ loader: 'js', contents: `export const V4_COPY=${JSON.stringify(copy)};` }));
  } }] });
  const e = await import(pathToFileURL(bundle).href);
  const enabled = e.registryV4Support().filter(x => x.runs).map(x => x.id);
  assert.deepEqual(enabled, read(join(out, 'proofs/enabled.json')));
  const raw = e.decodeSave(new Uint8Array(readFileSync(join(root, 'fixtures/saves/v49/chapter-two-town.save.json')))).envelope.state;
  const state = { ...raw, agency: e.initialAgency(), registry: e.initialRegistry() };
  const results = [];
  for (const id of ['ck_evt_163', 'ck_evt_165', 'ck_evt_206', 'ck_evt_209']) {
    const entry = e.v4Entry(id);
    for (const previous of [0, 2, 4, 6, 10, 12]) {
      const s = { ...state, timberOrder: previous };
      const choices = e.v4EnabledChoices(s, entry, {});
      for (const c of entry.choices.filter(c => c.commands[0]?.type === 'order_timber')) {
        const amount = c.commands[0].args.amount;
        const allowed = choices.includes(c.id);
        assert.equal(allowed, amount !== previous, `${id}/${c.id}/${previous}`);
        if (!allowed) continue;
        const after = e.runCommands(s, c.commands, { state: s, bound: {}, vars: {} });
        assert.ok(after);
        assert.equal(after.timberOrder ?? 0, amount);
        assert.equal(e.treasuryBalance(after), e.treasuryBalance(s));
        const day = { ...after, tick: 77600 };
        const delivered = e.advanceTimberTrade(day);
        const count = Math.min(amount, 2);
        assert.equal(delivered.treasuryTimber - day.treasuryTimber, count);
        assert.equal(e.treasuryBalance(delivered) - e.treasuryBalance(day), count === 0 ? 0 : -18 * count);
        assert.equal(delivered.timberOrder ?? 0, Math.max(0, amount - 2));
        results.push({ id, choice: c.id, previous, amount, immediateCash: 0, delivered: count, cost: 18 * count, remaining: delivered.timberOrder ?? 0 });
      }
    }
  }
  const entry = e.v4Entry('ck_evt_150');
  const claim = { id: 'qa-claim', claimant: 'lord', estateId: 'qa-estate', strength: 20, evidence: [], status: 'suing' };
  const suit = { id: 'qa-suit', claimId: claim.id, plaintiff: 'lord', defendant: 'neighbour_3', estateId: 'qa-estate', stage: 'evidence', costs: 60, stageSince: 0, patronSupport: 0, enforcements: 0 };
  const s = { ...state, estates: { ...state.estates, claims: [claim], suits: [suit] } };
  const bound = { claim, suit };
  const evidence = [];
  for (const c of entry.choices) {
    const after = e.runCommands(s, c.commands, { state: s, bound, vars: {} });
    assert.ok(after);
    if (c.id === 'a' || c.id === 'b') {
      const costs = c.id === 'a' ? 44 : 20;
      assert.equal(e.treasuryBalance(s) - e.treasuryBalance(after), costs);
      const ev = after.estates.claims[0].evidence;
      assert.equal(ev.reduce((n, x) => n + x.weight, 0), c.id === 'a' ? 18 : 10);
      evidence.push({ choice: c.id, cost: costs, evidence: ev });
    }
  }
  const have = { ...claim, evidence: [{ kind: 'witnesses', weight: 8, tick: 0 }] };
  const s2 = { ...s, estates: { ...s.estates, claims: [have] } };
  assert.equal(e.v4EnabledChoices(s2, entry, { claim: have, suit }).includes('a'), false);
  const poor = e.postLedgerEntries(s, [{ account: 'cash', category: 'rent', amount: 43 - e.treasuryBalance(s), sourceRefs: [{ type: 'actor', id: 'qa' }] }]);
  const p = { ...s, treasuryCoin: poor.treasuryCoin, ledger: poor.ledger };
  assert.equal(e.v4EnabledChoices(p, entry, bound).includes('a'), false);
  assert.equal(e.runCommands(p, entry.choices[0].commands, { state: p, bound, vars: {} }), null);
  assert.equal(e.treasuryBalance(p), 43);
  const report = { head, scope: 'Actual engine bundled with external proposed data; constructed fixtures. No registry random offer or125-year/browser claim.', support: { total: e.registryV4Support().length, enabled: enabled.length, unchanged: true }, timberCases: results, evidence150: evidence, boundaries: { duplicateWitnessDisablesCompound: true, cash43DisablesCompound44: true, failedCompoundAtomic: true }, pass: true };
  writeFileSync(join(out, 'proofs/ENGINE_DELTA_QA.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ pass: true, enabled: enabled.length, timberCases: results.length, evidence150: evidence.length }));
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
