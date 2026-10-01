import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { GoalCards } from "../src/ui/tutorial/TutorialShell";
import type { GoalCard, TutorialController } from "../src/ui/tutorial/useTutorialController";
import { CHAPTER_COPY } from "../src/ui/chapterCopy.ko";

// UI-6c: the chapter's goal card is a one-line chip (title and count) until pressed or its next goal changes; a card
// without a fold key keeps its full body.
const chapter: GoalCard = { key: "chapter", title: CHAPTER_COPY.card(2), why: CHAPTER_COPY.goals.wall_or_market!, progress: { current: 0, target: 2 },
  ctaLabel: CHAPTER_COPY.cta, status: "active", help: null, hasTarget: false, foldKey: "wall_or_market" };
const markup = (cards: readonly GoalCard[]) => renderToStaticMarkup(createElement(GoalCards, {
  tutorial: { cards, log: [], press: () => undefined, lookAt: () => undefined } as unknown as TutorialController,
  onToggleDrawer: () => undefined, drawerOpen: false, maxActive: 1 }));

test("the chapter card starts folded: its title and count on one button, no reason, no goal button", () => {
  const html = markup([chapter]);
  assert.match(html, /data-folded="true"/);
  assert.match(html, /class="[^"]*goal-card-fold[^"]*"[^>]*aria-expanded="false"|aria-expanded="false"[^>]*class="[^"]*goal-card-fold/);
  assert.ok(html.includes(CHAPTER_COPY.card(2)) && html.includes("0/2"));
  assert.equal(html.includes(CHAPTER_COPY.cta), false);
  assert.equal(html.includes(CHAPTER_COPY.goals.wall_or_market!), false);
});

test("a card without a fold key keeps its reason and button", () => {
  const html = markup([(({ foldKey: _fold, ...rest }) => rest)(chapter)]);
  assert.equal(html.includes('data-folded="true"'), false);
  assert.ok(html.includes(CHAPTER_COPY.cta) && html.includes(CHAPTER_COPY.goals.wall_or_market!));
});

test("UI-AUDIT-1: the folded chapter chip carries its short form (the goal icon, the chapter's number, the count) and keeps the whole title as its name", () => {
  const html = markup([{ ...chapter, shortTitle: CHAPTER_COPY.short(2) }]);
  assert.match(html, new RegExp(`class="goal-card-short"><span[^>]*data-icon="action.open"[^>]*></span>${CHAPTER_COPY.short(2)}</span>`));
  assert.match(html, /class="goal-card-title goal-card-title--full"/, "the title stays for wider views and when opened");
  assert.ok(html.includes(`aria-label="${CHAPTER_COPY.card(2)} 0/2"`));
  const css = readFileSync("src/styles/hudShell.css", "utf8");
  assert.match(css, /@media \(max-width: 1280px\) and \(pointer: fine\) \{[^}]*\.goal-card--folded \.goal-card-short \{ display: inline-flex;[^}]*\}\s*[^}]*\.goal-card--folded \.goal-card-title--full \{ display: none; \}/);
});
