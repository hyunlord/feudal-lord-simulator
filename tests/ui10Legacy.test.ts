/**
 * UI-10 the campaign's end (spec docs/design/chapter-five-legacy.md LG-7…LG-9): the six answer sets of scenario L9
 * (tests/helpers/legacyEndings.ts) make the six ending views; the chronicle book's pages (title, five chapters, the
 * family tree, the nine factions, the legacy) and the book so far; the Korean text export through the platform's files
 * service (the memory platform records it, the web one hands the browser a download).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LEGACY_ENDING_IDS } from "../src/content/legacyConfig";
import { campaignChronicle, campaignChronicleText } from "../src/engine/campaignChronicle";
import type { GameState } from "../src/engine/engine.types";
import { legacyEnding } from "../src/engine/legacy";
import { createMemoryPlatformServices } from "../src/platform/memoryPlatform";
import { createWebPlatformServices } from "../src/platform/webPlatform";
import { ChronicleBook } from "../src/ui/legacy/ChronicleBook";
import { LegacyAxes, LegacyEndingBlock } from "../src/ui/legacy/LegacyEndingScreen";
import { LEGACY_SCREEN_COPY } from "../src/ui/legacy/legacyScreenCopy.ko";
import { chronicleBookView, ENDING_AXIS, exportChronicleText, legacyVerdictView } from "../src/ui/legacy/legacyScreenModel";
import { clothTown } from "./helpers/clothTown";
import { LEGACY_ENDING_ANSWERS, throughLegacy } from "./helpers/legacyEndings";
import { legacyTown } from "./helpers/legacyTown";

let base: GameState | null = null;
const town = () => (base ??= legacyTown());
const ends = new Map<string, GameState>();
const endOf = (id: keyof typeof LEGACY_ENDING_ANSWERS) => { let end = ends.get(id); if (end === undefined) { end = throughLegacy(town(), LEGACY_ENDING_ANSWERS[id]); ends.set(id, end); } return end; };

test("UI-10 L9 the six answer sets make the six ending views: title, sentence, the leading axis, its arms, the quoted records", () => {
  const css = readFileSync("src/styles/legacy.css", "utf8");
  const plates = new Set<string>();
  for (const id of LEGACY_ENDING_IDS) {
    const end = endOf(id);
    const view = legacyVerdictView(end)!;
    assert.equal(view.ending.id, id);
    assert.equal(view.ending.final, true, id);
    assert.equal(view.ending.sentence, legacyEnding(end)!.sentence);
    assert.equal(view.lead, ENDING_AXIS[id], id);
    assert.equal(view.ending.axis, ENDING_AXIS[id]);
    // The three axes: the engine's scores, each with its parts in words.
    assert.deepEqual(view.axes.map(axis => [axis.axis, axis.score]), (["town", "family", "church"] as const).map(axis => [axis, end.legacy!.scores![axis]]));
    assert.deepEqual(view.axes.filter(axis => axis.lead).map(axis => axis.axis), [view.lead]);
    for (const axis of view.axes) {
      assert.ok(axis.parts.length >= 6, axis.axis);
      assert.ok(axis.parts.every(part => part.label !== part.key && /[가-힣]/.test(part.line)), JSON.stringify(axis.parts));
    }
    // The quotes: dated lines of the ledger's records.
    assert.ok(view.ending.quotes.length >= 2, id);
    assert.deepEqual(view.ending.quotes.map(quote => quote.id), legacyEnding(end)!.quotes.filter(quote => end.history!.records.some(record => record.id === quote)));
    assert.ok(view.ending.quotes.every(quote => /\d{4}/.test(quote.date) && quote.sentence.length > 0), JSON.stringify(view.ending.quotes));
    assert.equal(view.ending.emblem.kind, "arms", "the town's, the house's or the bishop's arms");
    // Each ending's own plate: a colourway rule in the stylesheet, its title and id in the markup.
    assert.match(css, new RegExp(`\\.legacy-ending-block\\[data-ending="${id}"\\] \\{ --legacy-plate: var\\(--palette-[a-z-]+\\); --legacy-trim: var\\(--palette-[a-z-]+\\); \\}`), id);
    plates.add(css.match(new RegExp(`data-ending="${id}"\\] \\{([^}]*)\\}`))![1]!);
    const markup = renderToStaticMarkup(createElement(LegacyEndingBlock, { ending: view.ending }));
    assert.ok(markup.includes(`data-ending="${id}"`) && markup.includes(view.ending.title) && markup.includes(`data-axis="${ENDING_AXIS[id]}"`));
    assert.equal((markup.match(/class="legacy-quote"/g) ?? []).length, view.ending.quotes.length);
    const axes = renderToStaticMarkup(createElement(LegacyAxes, { axes: view.axes }));
    assert.equal((axes.match(/data-lead="true"/g) ?? []).length, 1);
  }
  assert.equal(plates.size, LEGACY_ENDING_IDS.length, "six colourways");
});

test("UI-10 LG-9 the chronicle book: a title page, five chapters, the family tree, nine factions, the legacy", () => {
  const end = endOf("free_borough");
  const book = chronicleBookView(end);
  const engine = campaignChronicle(end);
  assert.equal(book.finished, true);
  assert.deepEqual(book.pages.map(page => page.kind), ["title", "chapter", "chapter", "chapter", "chapter", "chapter", "family", "factions", "legacy"]);
  const title = book.pages[0]!;
  assert.ok(title.kind === "title" && title.contents.length === book.pages.length - 1 && title.status === LEGACY_SCREEN_COPY.book.finished);
  const chapters = book.pages.flatMap(page => page.kind === "chapter" ? [page] : []);
  assert.deepEqual(chapters.map(page => [page.chapter, page.closed]), [[1, true], [2, true], [3, true], [4, true], [5, true]]);
  for (const [index, page] of chapters.entries()) {
    const chapter = engine.chapters[index]!;
    assert.ok(page.heading.startsWith(`제${chapter.chapter}장 `) && page.heading.includes(chapter.title), page.heading);
    assert.equal(page.summary, chapter.summary);
    assert.deepEqual(page.events.map(line => line.text), chapter.events.map(line => line.text));
    assert.deepEqual(page.decisions.map(line => line.id), chapter.decisions.map(line => line.recordId));
    assert.ok(page.decisions.every(line => line.chosen.length > 0 && !line.chosen.includes("undefined")));
  }
  assert.ok(chapters.some(page => page.events.some(line => line.art !== null)), "the events' pictures");
  const family = book.pages.find(page => page.kind === "family")!;
  assert.ok(family.kind === "family");
  const people = family.houses.flatMap(house => house.people);
  assert.equal(people.length, engine.family.people.length);
  assert.ok(people.filter(person => person.head).length >= 3);
  assert.equal(people.find(person => person.id === end.legacy!.heir!.personId)?.head, true);
  assert.ok(people.every(person => /^\d{4}–/.test(person.life) && person.generationLabel.endsWith("대")));
  assert.ok(people.some(person => person.parents !== ""), "parents named");
  const factions = book.pages.find(page => page.kind === "factions")!;
  assert.ok(factions.kind === "factions" && factions.factions.length === 9);
  assert.ok(factions.factions.find(faction => faction.id === "town")!.entries.length > 0);
  const legacy = book.pages.at(-1)!;
  assert.ok(legacy.kind === "legacy" && legacy.verdict?.ending.id === "free_borough" && legacy.scoresLine !== null);
  // The book's markup: its first page, the page count, the turns (the prev button disabled on the first page).
  const markup = renderToStaticMarkup(createElement(ChronicleBook, { state: end, onClose: () => undefined }));
  assert.ok(markup.includes(`data-pages="${book.pages.length}"`) && markup.includes('data-page="title"') && markup.includes(LEGACY_SCREEN_COPY.book.pageOf(1, book.pages.length)));
  assert.match(markup, /class="[^"]*legacy-book-prev[^"]*"[^>]*disabled=""/);
  assert.doesNotMatch(markup, /\btitle="/);
});

test("UI-10 LG-9 the book so far: at chapter 5's start the last chapter is still being written and the ending is provisional; before chapter 5 no legacy page", () => {
  const book = chronicleBookView(town());
  assert.equal(book.finished, false);
  const chapters = book.pages.flatMap(page => page.kind === "chapter" ? [page] : []);
  assert.equal(chapters.at(-1)!.chapter, 5);
  assert.equal(chapters.at(-1)!.closed, false);
  const legacy = book.pages.at(-1)!;
  assert.ok(legacy.kind === "legacy" && legacy.verdict !== null && legacy.verdict.ending.final === false);
  const early = chronicleBookView(clothTown());
  const none = early.pages.at(-1)!;
  assert.ok(none.kind === "legacy" && none.verdict === null && none.scoresLine === null);
  assert.equal(legacyVerdictView(clothTown()), null);
  assert.equal(early.pages.filter(page => page.kind === "factions").length, 1);
});

test("UI-10 LG-9 the export: the engine's Korean text saved through the platform files service as 연대기-<house>-1450.txt", async () => {
  const end = endOf("free_borough");
  const platform = createMemoryPlatformServices();
  const result = await exportChronicleText(end, platform.files);
  assert.equal(result.saved, true);
  assert.equal(platform.savedFiles.length, 1);
  assert.equal(platform.savedFiles[0]!.text, campaignChronicleText(end));
  assert.equal(platform.savedFiles[0]!.fileName, result.fileName);
  assert.match(result.fileName, /^연대기-[^\s/\\]+-1450\.txt$/);
  // A host that cannot save says so (the screen tells the player), it does not throw.
  const failed = await exportChronicleText(end, { saveText: async () => { throw new Error("blocked"); } });
  assert.equal(failed.saved, false);
});

test("UI-10 the web platform saves a text file as a download: a Blob URL, a temporary <a download> pressed, the URL revoked after", async () => {
  const calls: string[] = [];
  const blobs: { readonly parts: unknown[]; readonly type: string }[] = [];
  const link = { href: "", download: "", style: { display: "" }, click: () => calls.push(`click ${link.download}`), remove: () => calls.push("remove") };
  const view = {
    URL: { createObjectURL: (value: { parts: unknown[]; type: string }) => { blobs.push({ parts: value.parts, type: value.type }); calls.push("create"); return "blob:1"; }, revokeObjectURL: (url: string) => calls.push(`revoke ${url}`) },
    Blob: class { parts: unknown[]; type: string; constructor(parts: unknown[], options: { type: string }) { this.parts = parts; this.type = options.type; } },
    document: { createElement: (tag: string) => { calls.push(`element ${tag}`); return link; }, body: { appendChild: () => calls.push("append") } },
    setTimeout: (run: () => void) => { calls.push("later"); run(); return 0; },
    navigator: { language: "ko" }, devicePixelRatio: 1, innerWidth: 1280, innerHeight: 800,
  };
  const platform = createWebPlatformServices({ window: view as unknown as Window & typeof globalThis });
  assert.equal(await platform.files.saveText("연대기-시험-1450.txt", "첫 줄\n둘째 줄"), true);
  assert.deepEqual(calls, ["create", "element a", "append", "click 연대기-시험-1450.txt", "remove", "later", "revoke blob:1"]);
  assert.deepEqual(blobs, [{ parts: ["\uFEFF", "첫 줄\n둘째 줄"], type: "text/plain;charset=utf-8" }]);
  assert.equal(await createWebPlatformServices({}).files.saveText("a.txt", "b"), false, "no window: not saved");
});
