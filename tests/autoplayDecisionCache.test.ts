import assert from "node:assert/strict";
import test from "node:test";
import { sampleAutoplayDecision } from "../src/ui/autoplayDecisionCache";
import type { AutoplayAction } from "../src/engine/autoplay.types";
const none: AutoplayAction = { kind: "none" };
test("disabled advisor performs no evaluation and enabling evaluates immediately", () => {
  let calls = 0;
  const decide = () => { calls += 1; return none; };
  const state = { tick: 0 };
  const disabled = sampleAutoplayDecision(null, { state, enabled: false, pending: false }, decide);
  assert.equal(calls, 0);
  const enabled = sampleAutoplayDecision(disabled, { state, enabled: true, pending: false }, decide);
  assert.equal(calls, 1);
  assert.equal(enabled.decision?.action, none);
});

test("none decisions are sampled once per120ticks while hints reuse the same result", () => {
  let calls = 0;
  const decide = () => { calls += 1; return none; };
  let cached = sampleAutoplayDecision(null, { state: { tick: 0 }, enabled: true, pending: false }, decide);
  const first = cached.decision;
  for (let tick = 1; tick < 120; tick += 1) {
    cached = sampleAutoplayDecision(cached, { state: { tick }, enabled: true, pending: false }, decide);
    assert.equal(cached.decision, first);
  }
  assert.equal(calls, 1);
  cached = sampleAutoplayDecision(cached, { state: { tick: 120 }, enabled: true, pending: false }, decide);
  assert.equal(calls, 2);
  assert.notEqual(cached.decision, first);
});

test("same tick manual edits refresh but unchanged paused renders do not", () => {
  let calls = 0;
  const decide = () => { calls += 1; return none; };
  const state = { tick: 10 };
  const first = sampleAutoplayDecision(null, { state, enabled: true, pending: false }, decide);
  const paused = sampleAutoplayDecision(first, { state, enabled: true, pending: false }, decide);
  assert.equal(calls, 1);
  assert.equal(paused.decision, first.decision);
  sampleAutoplayDecision(paused, { state: { tick: 10 }, enabled: true, pending: false }, decide);
  assert.equal(calls, 2);
});

test("pending visualized action blocks new evaluation until it settles", () => {
  let calls = 0;
  const decide = () => { calls += 1; return none; };
  const first = sampleAutoplayDecision(null, { state: { tick: 0 }, enabled: true, pending: false }, decide);
  const pending = sampleAutoplayDecision(first, { state: { tick: 150 }, enabled: true, pending: true }, decide);
  assert.equal(calls, 1);
  assert.equal(pending.decision, first.decision);
  sampleAutoplayDecision(pending, { state: pending.observedState, enabled: true, pending: false }, decide);
  assert.equal(calls, 2);
});

test("disabling discards cached actions and reenable or clock reset refreshes", () => {
  let calls = 0;
  const decide = () => { calls += 1; return none; };
  const state = { tick: 200 };
  const first = sampleAutoplayDecision(null, { state, enabled: true, pending: false }, decide);
  const disabled = sampleAutoplayDecision(first, { state, enabled: false, pending: false }, decide);
  assert.equal(disabled.decision, null);
  const enabled = sampleAutoplayDecision(disabled, { state, enabled: true, pending: false }, decide);
  assert.equal(calls, 2);
  sampleAutoplayDecision(enabled, { state: { tick: 0 }, enabled: true, pending: false }, decide);
  assert.equal(calls, 3);
});
