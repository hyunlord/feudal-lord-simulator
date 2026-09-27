import assert from "node:assert/strict";
import test from "node:test";
import { createUiChannel } from "../src/state/uiChannel";

// CODE-1c: the store's UI channel — a committed tick reaches the UI at most every interval and the last one always
// does; an action reaches it at once. Driven by a fake clock and fake timers.
function harness() {
  let now = 0; let state = { tick: 0 };
  const timers: { at: number; run: () => void; id: number }[] = []; let nextId = 1;
  const channel = createUiChannel({ initial: state, read: () => state, intervalMs: 250, now: () => now,
    setTimer: (run, delayMs) => { const id = nextId++; timers.push({ at: now + delayMs, run, id }); return id; },
    clearTimer: id => { const index = timers.findIndex(timer => timer.id === id); if (index >= 0) timers.splice(index, 1); } });
  const seen: number[] = [];
  channel.subscribe(() => seen.push(channel.getState().tick));
  const advance = (ms: number) => {
    const until = now + ms;
    for (;;) {
      const due = timers.filter(timer => timer.at <= until).sort((a, b) => a.at - b.at)[0];
      if (due === undefined) break;
      now = due.at; timers.splice(timers.indexOf(due), 1); due.run();
    }
    now = until;
  };
  return { channel, seen, timers, advance, tick: () => { state = { tick: state.tick + 1 }; channel.publishThrottled(); }, act: () => { state = { tick: state.tick + 1000 }; channel.publish(); } };
}

test("ticks every 77 ms (5x) reach the UI four times a second, the last one included", () => {
  const h = harness();
  for (let index = 0; index < 13; index += 1) { h.tick(); h.advance(77); }
  h.advance(500);
  assert.deepEqual(h.seen, [1, 4, 7, 10, 13]);
  assert.equal(h.channel.getState().tick, 13);
  assert.equal(h.timers.length, 0);
});

test("an action reaches the UI at once and cancels the waiting tick", () => {
  const h = harness();
  h.tick(); h.advance(50); h.tick();
  assert.equal(h.timers.length, 1);
  h.act();
  assert.deepEqual(h.seen, [1, 1002]);
  assert.equal(h.timers.length, 0);
  h.advance(1000);
  assert.deepEqual(h.seen, [1, 1002]);
});

test("an unchanged state is not announced", () => {
  const h = harness();
  h.channel.publish(); h.channel.publishThrottled();
  assert.deepEqual(h.seen, []);
});
