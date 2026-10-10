import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { standingPolicies, stewardReport } from '../src/engine/decisionReads';
import { answerAudit, advanceStewardship, stewardshipOf } from '../src/engine/stewardship';
import { gameReducer } from '../src/state/gameStore';
import { standingPolicyScreen } from '../src/ui/lord/steward/standingPolicyModel';
import { StandingPolicyPanel } from '../src/ui/lord/steward/StandingPolicyPanel';
import { seasonStewardView } from '../src/ui/lord/steward/seasonStewardModel';
import { SeasonStewardSection } from '../src/ui/lord/steward/SeasonStewardSection';
import { delegated } from './helpers/engineBTlinkFixtures';

function tolerated() {
  const base = delegated();
  const state = { ...base, stewardship: { ...stewardshipOf(base), audits: [{ id: 'tolerated-audit', estateId: 'delegated-estate', stewardId: 'current', tick: 1000, deadline: 2000, mode: 'accounts' as const, revealedKept: 0, revealedErrors: 160, hidden: 0, status: 'pending' as const }] } };
  return answerAudit(state, 'tolerated-audit', 'tolerate');
}

test('tolerated audit exposes only withdrawal in the existing policy panel and dispatches the real command', () => {
  // Given a real tolerated audit.
  const state = tolerated();
  const key = 'audit:delegated-estate:current';
  // When the player reads and withdraws the policy.
  const view = standingPolicies(state).find(row => row.kind === key);
  assert.ok(view, 'the standing policy read includes the steward');
  const row = standingPolicyScreen(state)?.families.flatMap(family => family.kinds).find(item => item.kind === key);
  assert.ok(row);
  assert.deepEqual(row.options.map(option => option.setting), ['lord']);
  const option = row.options[0];
  assert.ok(option);
  const html = renderToStaticMarkup(createElement(StandingPolicyPanel, { state, dispatch: () => undefined, onOpen: () => undefined, onPerson: () => undefined, focus: key }));
  assert.match(html, /눈감아 주기를 거둔다/);
  assert.match(html, /철마다/);
  const revoked = gameReducer(state, option.command);
  // Then the policy is withdrawn and cannot be silently re-enabled from the panel.
  assert.equal(stewardshipOf(revoked).standing?.[key], 'lord');
  assert.deepEqual(standingPolicyScreen(revoked)?.families.flatMap(family => family.kinds).find(item => item.kind === key)?.options, []);
});

test('the steward report renders actual seasonal tolerated losses and excludes other seasons', () => {
  // Given the engine has posted the next quarter after tolerance.
  const state = advanceStewardship({ ...tolerated(), tick: 2000 });
  const actual = stewardshipOf(state).summaries.filter(row => row.tick === 2000).flatMap(row => row.toleratedLosses ?? []);
  assert.ok(actual.length > 0);
  // When reading that season.
  const report = stewardReport(state, 2000, 3000);
  assert.equal(report.toleratedLosses.reduce((sum, row) => sum + row.amount, 0), actual.reduce((sum, row) => sum + row.amount, 0));
  const view = seasonStewardView(state, 2000);
  assert.ok(view);
  const html = renderToStaticMarkup(createElement(SeasonStewardSection, { view }));
  // Then real loss and source policy are visible, without duplicating another season.
  assert.match(html, /눈감아 준 오류로 이번 철 수입/);
  assert.equal(stewardReport(state, 0, 1000).toleratedLosses.length, 0);
});

test('a policy-handled audit appears as a steward report with its policy link', () => {
  // Given a recorded audit the steward handled under the lord's standing tolerance.
  const base = tolerated();
  const own = stewardshipOf(base);
  const audit = own.audits[0];
  assert.ok(audit);
  const state = { ...base, stewardship: { ...own, audits: [{ ...audit, id: 'next-audit', tick: 2000,
    decidedBy: 'steward' as const, policyAuditId: audit.id }] } };
  // When the closed season is displayed.
  const view = seasonStewardView(state, 2000);
  assert.ok(view);
  const item = view.items.find(row => row.id === 'next-audit');
  // Then it stays in the report, with a way to the real persistent policy.
  assert.ok(item);
  assert.equal(item.kind, 'audit:delegated-estate:current');
  assert.match(item.summary, /상시 방침대로/);
  assert.match(renderToStaticMarkup(createElement(SeasonStewardSection, { view, onPolicy: () => undefined })), /data-steward-policy="audit:delegated-estate:current"/);
});

test('the live treasury drawer names actual tolerance debits without changing its total', async () => {
  const { TreasuryByEstate } = await import('../src/ui/lord/treasury/TreasuryByEstate');
  const { treasuryByEstate } = await import('../src/ui/lord/treasury/treasuryModel');
  const { standingBrowserFixture } = await import('../scripts/engineBStandingFixture');
  // Given the real posted seasonal loss.
  const { state, loss } = standingBrowserFixture();
  const before = treasuryByEstate(state);
  assert.ok(before);
  // When the existing stock drawer is rendered.
  const html = renderToStaticMarkup(createElement(TreasuryByEstate, { state }));
  // Then its reason and negative amount are visible, as detail of existing totals.
  assert.match(html, new RegExp(`data-tolerance-amount="-${loss}"`));
  assert.match(html, /눈감아 준 오류로 수입/);
  assert.equal(treasuryByEstate(state)?.net, before.net);
});
