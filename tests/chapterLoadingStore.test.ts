/**
 * NAT-4: the new game's loading screen survives the remount a start causes. start_new_game bumps the game store's
 * session key, so App remounts in the same click; the flag (and its timer) now lives at module level
 * (src/ui/chapterLoadingStore.ts), and App reads it through useChapterLoading.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { chapterLoadingVisible, showChapterLoading, useChapterLoading } from "../src/ui/chapterLoadingStore";

test("the loading flag is module state: a component mounted after the start still sees it, until its time is up", async () => {
  assert.equal(chapterLoadingVisible(), false);
  showChapterLoading(40);
  assert.equal(chapterLoadingVisible(), true);
  // A fresh mount (the app after the session-key remount) reads the same flag; server rendering reads "not shown".
  const Probe = () => createElement("i", null, String(useChapterLoading()));
  assert.equal(renderToStaticMarkup(createElement(Probe)), "<i>false</i>", "the server snapshot");
  await new Promise(done => setTimeout(done, 20));
  showChapterLoading(40); // a second start restarts the time
  await new Promise(done => setTimeout(done, 30));
  assert.equal(chapterLoadingVisible(), true);
  await new Promise(done => setTimeout(done, 30));
  assert.equal(chapterLoadingVisible(), false);
});

test("every start the welcome offers shows the loading screen; the flag is not App state any more", () => {
  const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(app, /useState\(false\);\s*\n\s*useEffect\(\(\) => \{\s*\n\s*if \(!chapterLoading\)/, "no App-local loading flag");
  assert.match(app, /const chapterLoading = useChapterLoading\(\);/);
  assert.match(app, /onNewGame=\{\(scenarioId, land\) => \{ showChapterLoading\(CHAPTER_LOADING_MS\); startNewGameOverSave/);
  assert.match(app, /onChooseMode=\{\(scenarioId, land\) => \{ showChapterLoading\(CHAPTER_LOADING_MS\); startScenarioWithoutSave/);
  // A click anywhere that starts a new map (not today's map 1) shows it too.
  assert.match(app, /!isDefaultLand\(land\)\) \{ showChapterLoading\(CHAPTER_LOADING_MS\); startScenarioWithoutSave/);
});
