/**
 * LS1-18 (the user's ruling 2026-10-20; render-VIS-lapse-09b1367, seed 4): the stop's notice folds only the reasons that
 * are not a deadline — a deadline entering its last season is why the stop tells what is about to lapse, so its name is
 * never folded into "그 밖에 N건". Several deadlines of one kind are one line ("청원 2건 · 마지막 철", their names), as
 * the rail's one chip per kind. Before: 1306 spring's stop with the inheritance folded the petition 지대 감면 away.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { gunzipSync } from "node:zlib";

import type { GameState } from "../src/engine/engine.types";
import { autoPauseLines } from "../src/ui/hud/autoPauseLines";
import { autoPauseMemory, autoPauseStep, type AutoPauseItem } from "../src/ui/hud/autoPauseModel";
import { AutoPauseNotice } from "../src/ui/hud/AutoPauseNotice";
import { AUTO_PAUSE_COPY } from "../src/ui/hud/autoPauseCopy.ko";
import { INITIAL_UI_STATE } from "../src/ui/stateMachine/uiStateMachine";

const fixture = (name: string): GameState => JSON.parse(gunzipSync(readFileSync(new URL(`./fixtures/ls118/${name}.json.gz`, import.meta.url))).toString()) as GameState;
const winter = fixture("seed4-1305-winter");
const spring = fixture("seed4-1306-spring");
const notice = (state: GameState, shown: readonly AutoPauseItem[]) => renderToStaticMarkup(createElement(AutoPauseNotice, {
  state, hold: { mode: "stopped", shown } as never, paused: true, ui: INITIAL_UI_STATE, onLord: () => undefined, onModal: () => undefined, onDismiss: () => undefined }))
  .replace(/<[^>]+>/g, " ");

test("seed 4, 1306 spring: the stop with the inheritance names the petition in its last season", () => {
  const memory = autoPauseMemory(winter);
  const fresh = autoPauseStep(memory, spring, memory.baseline).fresh;
  assert.ok(fresh.some(item => item.kind === "deadline"), "the petition's last season is one of the stop's reasons");
  assert.ok(fresh.length > 4, "more reasons than the notice lists");
  const text = notice(spring, fresh);
  assert.match(text, /지대 감면/, "the deadline's name is on the notice");
  assert.match(text, /이번 철이 지나면 거절로 처리되고/);
});

test("deadlines are never folded; only the other reasons are counted", () => {
  const memory = autoPauseMemory(winter);
  const fresh = autoPauseStep(memory, spring, memory.baseline).fresh;
  const lines = autoPauseLines(spring, fresh);
  const others = lines.filter(line => line.deadline !== true).length;
  const deadlines = lines.filter(line => line.deadline === true).length;
  const text = notice(spring, fresh);
  const hidden = others - Math.max(0, 4 - deadlines);
  if (hidden > 0) assert.ok(text.includes(AUTO_PAUSE_COPY.more(hidden)), "the count is the other reasons left out");
});

test("two deadlines of one kind are one line, its count and names", () => {
  const memory = autoPauseMemory(winter);
  const deadline = autoPauseStep(memory, spring, memory.baseline).fresh.find(item => item.kind === "deadline");
  assert.ok(deadline !== undefined && deadline.kind === "deadline");
  const twin: AutoPauseItem = { ...deadline, key: `${deadline.key}:twin`, deadline: { ...deadline.deadline, chipId: "estate-petition:twin", subjectId: "twin" } };
  const lines = autoPauseLines(spring, [deadline, twin]);
  assert.equal(lines.length, 1);
  assert.equal(lines[0]!.deadline, true);
  assert.match(lines[0]!.sentence, /^청원 2건 · 마지막 철/);
  assert.match(lines[0]!.sentence, /지대 감면/);
});
