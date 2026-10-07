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
import { endingBackdrop, LegacyAxes, LegacyEndingBlock, LegacyEndingScreen } from "../src/ui/legacy/LegacyEndingScreen";
import { ENDING_IMAGES } from "../src/ui/endingArtManifest.generated";
import { LEGACY_SCREEN_COPY } from "../src/ui/legacy/legacyScreenCopy.ko";
import { chronicleBookView, ENDING_AXIS, exportChronicleText, legacyVerdictView } from "../src/ui/legacy/legacyScreenModel";
import { chapterOwnsRecord, chapterQuotes, recordSentence } from "../src/ui/legacy/chapterRecords";
import { chronicleView } from "../src/ui/chronicleModel";
import { recordCard } from "../src/ui/chronicle/chronicleScreenModel";
import { legacyLedgerView } from "../src/ui/hud/legacyLedgerModel";
import { LEGACY_LEDGER_COPY } from "../src/ui/hud/legacyLedgerCopy.ko";
import { LedgerDrawer } from "../src/ui/hud/HudShell";
import { cashUpTo } from "../src/ui/hud/chapterLedgerTotals";
import { reorgLedgerView } from "../src/ui/hud/reorgLedgerModel";
import { wageLedgerView } from "../src/ui/hud/wageLedgerModel";
import { ledgerView } from "../src/ledger/ledgerView";
import { HEIR_CHOICE_PETITION_ID, LEGACY_CARD_PETITION_IDS } from "../src/content/legacyConfig";
import { clothTown } from "./helpers/clothTown";
import { LEGACY_ENDING_ANSWERS, throughLegacy } from "./helpers/legacyEndings";
import { legacyTown } from "./helpers/legacyTown";

let base: GameState | null = null;
const town = () => (base ??= legacyTown());
const ends = new Map<string, GameState>();
const endOf = (id: keyof typeof LEGACY_ENDING_ANSWERS) => { let end = ends.get(id); if (end === undefined) { end = throughLegacy(town(), LEGACY_ENDING_ANSWERS[id]); ends.set(id, end); } return end; };

test("UI-10 L9 the six answer sets make the six ending views: title, sentence, the leading axis, its arms, the quoted records, its own painting (INSTALL-33)", () => {
  const css = readFileSync("src/styles/legacy.css", "utf8");
  const plates = new Set<string>();
  const backdrops = new Set<string>();
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
    // INSTALL-33: the screen's backdrop is the ending's own painting.
    const screen = renderToStaticMarkup(createElement(LegacyEndingScreen, { state: end, view, onBook: () => undefined, onKeepPlaying: () => undefined }));
    assert.ok(screen.includes(`data-backdrop="${id}"`) && screen.includes(ENDING_IMAGES[id].url), id);
    backdrops.add(ENDING_IMAGES[id].url);
  }
  assert.equal(plates.size, LEGACY_ENDING_IDS.length, "six colourways");
  assert.equal(backdrops.size, LEGACY_ENDING_IDS.length, "six paintings");
  // A provisional ending (the scores' before the last market day) keeps the shared campaign-ending painting.
  const early = legacyVerdictView(town())!;
  assert.equal(early.ending.final, false);
  assert.deepEqual(endingBackdrop(early.ending).id, "ch5_campaign_ending");
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
    const opened = end.politics!.chapterEnds[index - 1]?.tick ?? null;
    const own = chapter.events.filter(line => chapterOwnsRecord(end.history!.records.find(record => record.id === line.recordId)!, chapter.chapter, opened));
    assert.deepEqual(page.events.map(line => line.id), own.map(line => line.recordId), page.heading);
    // The engine's quotes (none of the tick the chapter opened on), and in chapter 5 its cards' answers too (gate fix 1).
    assert.ok(chapter.decisions.every(line => page.decisions.some(decision => decision.id === line.recordId)
      || end.history!.records.find(record => record.id === line.recordId)!.tick <= (end.politics!.chapterEnds[index - 1]?.tick ?? -1)), page.heading);
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

test("UI-10 gate 1–2: chapter 5's page and book quote its own four cards' answers, and neither opens on chapter 4's closing tick", () => {
  const end = endOf("free_borough");
  const opened = end.politics!.chapterEnds.find(entry => entry.chapter === 4)!.tick;
  const byId = new Map(end.history!.records.map(record => [record.id, record]));
  const cards = end.history!.records.filter(record => record.kind === "decision" && LEGACY_CARD_PETITION_IDS.includes(String(record.params?.defId) as never));
  assert.equal(cards.length, 4, "the four chapter-5 cards were answered");
  const page = chronicleView(end)!;
  assert.equal(page.chapter, 5);
  for (const card of cards) assert.ok(page.decisions.some(decision => decision.id === card.id), String(card.params?.defId));
  assert.ok(page.entries.every(entry => byId.get(entry.id)!.tick > opened), "no record of chapter 4's closing tick");
  const book = chronicleBookView(end).pages.find(entry => entry.kind === "chapter" && entry.chapter === 5)!;
  assert.ok(book.kind === "chapter");
  assert.deepEqual(book.decisions.map(line => line.id), page.decisions.map(decision => decision.id), "the book quotes what the page quotes");
  assert.ok([...book.events, ...book.decisions].every(line => byId.get(line.id)!.tick > opened));
  // The rule: the opening tick is the closing chapter's, except the new chapter's own start milestone; chapter 1 owns tick 0.
  assert.equal(chapterOwnsRecord({ tick: 100, template: "reorg.charter", params: {} }, 5, 100), false);
  assert.equal(chapterOwnsRecord({ tick: 100, template: "milestone.chapter_start", params: { chapter: 5 } }, 5, 100), true);
  assert.equal(chapterOwnsRecord({ tick: 100, template: "milestone.chapter_end", params: { chapter: 4 } }, 5, 100), false);
  assert.equal(chapterOwnsRecord({ tick: 101, template: "reorg.charter", params: {} }, 5, 100), true);
  assert.equal(chapterOwnsRecord({ tick: 0, template: "milestone.first_building", params: {} }, 1, null), true);
  // Other chapters keep the engine's three.
  const four = end.politics!.chapterEnds.find(entry => entry.chapter === 4)!;
  assert.ok(chapterQuotes(end, 4, four.chronicle.decisions, four.tick).length <= four.chronicle.decisions.length);
});

test("UI-10 gate 3: a distant kinsman seated for the nephew's answer is named 먼 친척 on the page, in the quotes, the cards and the book — never 조카", () => {
  const end = endOf("free_borough");
  const heir = end.legacy!.candidates.find(candidate => candidate.personId === end.legacy!.heir!.personId)!;
  assert.equal(heir.relation, "kinsman", "the helper town's heir is a distant kinsman (as seed 2's)");
  const record = end.history!.records.find(entry => entry.kind === "decision" && entry.params?.defId === HEIR_CHOICE_PETITION_ID)!;
  assert.equal(record.params?.chosen, "refuse");
  const kinsman = "먼 친척에게 잇게 한다";
  assert.ok(recordSentence(end, record).endsWith(kinsman));
  assert.ok(recordCard(end, { key: record.id, tick: record.tick, record, bundle: null }).sentence.endsWith(kinsman));
  const page = chronicleView(end)!;
  assert.ok(page.decisions.find(decision => decision.id === record.id)!.sentence.includes(kinsman));
  assert.ok(page.stats.some(line => line.includes("후계자 먼 친척")) && !page.stats.some(line => line.includes("후계자 조카")));
  const quotes = legacyVerdictView(end)!.ending.quotes;
  assert.ok(quotes.some(quote => quote.id === record.id && quote.sentence.endsWith(kinsman)));
  const book = chronicleBookView(end).pages.find(entry => entry.kind === "chapter" && entry.chapter === 5)!;
  assert.ok(book.kind === "chapter");
  const line = book.decisions.find(decision => decision.id === record.id)!;
  assert.ok(line.text.endsWith(kinsman) && line.chosen.includes(kinsman));
  assert.ok(![...quotes.map(quote => quote.sentence), ...page.stats, line.text, line.chosen].some(text => text.includes("조카")));
});

test("UI-10 gate 4: the ledger drawer's stock tab has a chapter-5 section — this period, last period and the chapter-5 total of its six categories", () => {
  const end = endOf("free_borough");
  const view = legacyLedgerView(end)!;
  assert.deepEqual(view.rows.map(row => row.category), ["royal_subsidy", "succession_relief", "legacy_endowment", "charter_fee", "church_rebuilding", "fee_farm"]);
  const fourEnd = end.politics!.chapterEnds.find(entry => entry.chapter === 4)!.tick;
  for (const row of view.rows) {
    assert.equal(row.chapterTotal, cashUpTo(end, row.category, end.tick) - cashUpTo(end, row.category, fourEnd), row.category);
    assert.ok(row.label.length > 0 && row.shown.every(amount => /^−?(?:£[\d,]+(?: \d+s)?(?: \d+d)?|\d+s(?: \d+d)?|\d+d)$/.test(amount)));
  }
  assert.ok(view.rows.find(row => row.category === "royal_subsidy")!.chapterTotal < 0, "the Crown's tax was paid");
  assert.equal(legacyLedgerView(clothTown()), null, "before chapter 5");
  const markup = renderToStaticMarkup(createElement(LedgerDrawer, { state: end, onInspect: () => undefined, onClose: () => undefined, viewTab: null, mapTab: null }));
  assert.ok(markup.includes("ledger-legacy-ledger") && markup.includes(LEGACY_LEDGER_COPY.heading) && markup.includes(LEGACY_LEDGER_COPY.chapterTotal));
});

test("UI-10 gate 5–6: the buttons stay in view — the ending's three in a footer held at the panel's bottom, a card's [나중에 정하기] its body's last row", () => {
  const css = readFileSync("src/styles/legacy.css", "utf8");
  // UI-AUDIT-1: the footer is the body's last row; the verdict scrolls in the row above it, not under it.
  assert.match(css, /\.legacy-ending-body \{ grid-template-rows: minmax\(0, 1fr\) auto;[^}]*overflow: hidden; \}/);
  assert.match(css, /\.legacy-ending-scroll \{[^}]*overflow-y: auto; \}/);
  assert.match(css, /\.legacy-ending-footer \{[^}]*background: var\(--parchment\);[^}]*border-top:/);
  const hud = readFileSync("src/styles/hudShell.css", "utf8");
  // UI-AUDIT-1: the card grows with its body; [나중에 정하기] is the body's last row, never over an answer.
  // DEC-CARD: every petition is the heavy decision card — the later button its body's last row, the card as tall as its body.
  assert.match(readFileSync("src/ui/decisionCard/DecisionCard.tsx", "utf8"), /<\/ol>\s*<Button type="button" className="story-modal-later"[^\n]*\n\s*<\/div>/, "the later button the body's last row");
  assert.match(readFileSync("src/styles/decisionCard.css", "utf8"), /\.petition-card\.decision-card \{[^}]*min-height: 0; \}/, "the card grows with its body");
  // UI-AUDIT-1: the chapter page's footer is the body's row under the scrolling lines (not held over them).
  assert.match(hud, /\.chapter-page-main \{ grid-template-rows: minmax\(0, 1fr\) auto;/, "the lines above the footer");
  assert.match(hud, /\.chapter-page-scroll \{[^}]*overflow-y: auto;/, "the lines scroll");
  assert.match(hud, /\.chapter-page-main > \.chronicle-page-footer \{ display: grid;[^}]*background: var\(--parchment\);[^}]*border-top:/, "the chapter page's footer");
  assert.match(readFileSync("src/ui/hud/StoryModals.tsx", "utf8"), /<\/div>\s*\{\/\*[^]*?\*\/\}\s*<div className="chronicle-page-footer">\s*<div className="chronicle-actions">/, "the footer after the two columns");
  const source = readFileSync("src/ui/legacy/LegacyEndingScreen.tsx", "utf8");
  const footer = source.slice(source.indexOf('className="legacy-ending-footer"'));
  for (const button of ["legacy-open-book", "legacy-export", "legacy-keep"]) assert.ok(footer.includes(button), button);
});

test("UI-10 gate 7: a closed chapter's ledger total stops at its end — chapter 4's fee farm (paid from the spring after the charter) is chapter 5's", () => {
  const end = endOf("free_borough");
  const endOfChapter = (chapter: number) => end.politics!.chapterEnds.find(entry => entry.chapter === chapter)!.tick;
  const whole = (category: string) => ledgerView(end, "cash", "all").byCategory.find(row => row.category === category)?.amount ?? 0;
  const four = reorgLedgerView(end)!;
  const five = legacyLedgerView(end)!;
  for (const row of four.rows) assert.equal(row.chapterTotal, cashUpTo(end, row.category, endOfChapter(4)), row.category);
  const feeFour = four.rows.find(row => row.category === "fee_farm")!.chapterTotal;
  const feeFive = five.rows.find(row => row.category === "fee_farm")!.chapterTotal;
  assert.ok(whole("fee_farm") > 0, "the town paid its fee farm");
  assert.equal(feeFour + feeFive, whole("fee_farm"), "chapters 4 and 5 split the fee farm, nothing counted twice");
  assert.ok(feeFive > feeFour, `chapter 5 holds the fee farm (4: ${feeFour}, 5: ${feeFive})`);
  const wages = wageLedgerView(end)!;
  for (const row of wages.rows) assert.equal(row.chapterTotal, cashUpTo(end, row.category, endOfChapter(3)), row.category);
  // This period and last period stay the current ones (the drawer's own periods), for a closed chapter too.
  const recent = ledgerView(end, "cash", "recent").byCategory;
  for (const row of four.rows) assert.equal(row.thisSeason, recent.find(entry => entry.category === row.category)?.amount ?? 0, row.category);
  // A chapter being played counts up to now.
  const open = clothTown();
  const playing = reorgLedgerView(open);
  if (playing !== null && open.politics?.chapterEnds.every(entry => entry.chapter !== 4)) {
    for (const row of playing.rows) assert.equal(row.chapterTotal, cashUpTo(open, row.category, open.tick), row.category);
  }
});
