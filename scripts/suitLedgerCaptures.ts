// SUIT-THREAD (renderer A) captures on the DGX: the lord screen's 약속·소송 with the lord sued and forewarned, through
// the real way in (the dock's ledger → its lord tab → 영주 집무 열기 → 약속·소송), paused, 1280 × 800 DPR 1 unless named.
// Each press is the screen's own button (the game's command), and the game's state is read after it:
//  d1-defence-filed      a house's suit against the lord just filed (lord2 neighbour-suit): the defence row; a deed
//                        brought by its button: d2-defence-evidence (the suit holds the lord's deed, the hearing moved)
//  d1-tablet-dpr2        the same at 1180 × 820, DPR 2, by touch (48 px targets)
//  d3-defence-patronage  its patronage stage (suit-defence-patronage): a patron won by its button: d4-patron-chosen
//  d5-defence-enforcing  judged for the house, its enforcement (suit-defence-enforcing): men put in by the hold button:
//                        d6-held (the hold risen, the button shut with the engine's reason)
//  d7-concord-paid       lord2 neighbour-suit, the concord paid by its button: the suit closed, the engine's sentence
//  t1-entry-threat       a forcible entry forewarned (suit-entry-threat): men put in by the guard button: t2-guarded
//  t3-entry-forced       the house came in (suit-entry-forced): the novel claim; filed by its button: t4-novel-filed
//                        (the track from the filing to the hearing)
//  m1-moment-lost        the house's enforcement that took the piece (suit-neighbour-took): its moment's card
//  k1-contested-ended    Astra's lordplay2 final save: the contested inheritance's card after the lost suit
// Each view's facts go to captures.json; a missing fact fails the run. No text under 12 px, no button under 44 px (48 by
// touch), no native control or title, no primary button in the ledger (its choices are equal).
//   scripts/remote/run.sh render-SUIT-ledger-captures-<sha7> --light -- bash scripts/suitLedgerCaptures.sh
import { refuseHeavyOnMac } from "./remote/localGuard.mjs";
refuseHeavyOnMac("브라우저 캡처(scripts/suitLedgerCaptures.ts)", { remote: "scripts/remote/run.sh render-SUIT-ledger-captures-<sha7> --light -- bash scripts/suitLedgerCaptures.sh", entry: import.meta.url });
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import type { GameState } from "../src/engine/engine.types";
import { decodeSave } from "../src/save/saveCodec";
import { loadChromium, openScene } from "./renderCommitProbe.mjs";

type Box = { x: number; y: number; width: number; height: number };
type Locator = { first: () => Locator; count: () => Promise<number>; click: () => Promise<void>; tap: () => Promise<void>; boundingBox: () => Promise<Box | null>;
  waitFor: (options: object) => Promise<void>; evaluate: (f: (node: Element) => void) => Promise<void> };
type Page = { locator: (selector: string) => Locator; waitForTimeout: (ms: number) => Promise<void>; screenshot: (options: object) => Promise<Buffer>;
  evaluate: <T, A = undefined>(f: (arg: A) => T | Promise<T>, arg?: A) => Promise<T>; viewportSize: () => { width: number; height: number } };
type Opened = { context: { close: () => Promise<void> }; page: Page };

const [out] = process.argv.slice(2);
const flag = (name: string) => { const index = process.argv.indexOf(`--${name}`); return index > 0 ? process.argv[index + 1] : undefined; };
const url = flag("url"); const lord2 = flag("lord2");
if (out === undefined || url === undefined || lord2 === undefined) throw new Error("usage: suitLedgerCaptures.ts <out> --url <url> --lord2 <dir>");
mkdirSync(out, { recursive: true });
const INIT = `globalThis.__name = globalThis.__name || (target => target); try { localStorage.setItem('feudal-lord-simulator:tutorial:v1', JSON.stringify({ enabled: false, acks: [], pulsed: [], log: [] })); } catch (error) { void error; }`;
const load = (name: string): GameState | null => { try { return JSON.parse(readFileSync(join(lord2, `${name}.json`), "utf8")) as GameState; } catch { return null; } };
const astra = (): GameState => decodeSave(new Uint8Array(gunzipSync(readFileSync("docs/qa/lordplay2-20261008/saves/manual-final.savebin.gz")))).envelope.state as GameState;
const seatTile = (state: GameState): [number, number] => {
  const seat = state.buildings.find(building => building.kind === "manor_house") ?? state.buildings.find(building => building.kind === "house") ?? state.buildings[0]!;
  return [seat.tx, seat.ty];
};

const chromium = await loadChromium() as unknown as { launch: (options: object) => Promise<{ close: () => Promise<void> }> };
const browser = await chromium.launch({ channel: "chrome", headless: true });
const rows: Record<string, unknown>[] = [];
const failures: string[] = [];
const expect = (name: string, ok: boolean, what: string) => { if (!ok) failures.push(`${name}: ${what}`); };

type View = { width?: number; height?: number; dpr?: number; touch?: boolean; ledger?: boolean; delay?: number };
async function open(state: GameState, view: View = {}): Promise<Opened & { press: (selector: string) => Promise<void> }> {
  const { width = 1280, height = 800, dpr = 1, touch = false, ledger = true, delay = 600000 } = view;
  const opened = await openScene(browser, { state, tile: seatTile(state), baseUrl: url, width, height, dpr, zoom: 1.1, run: false, hasTouch: touch, isMobile: touch,
    loadTimeout: 120_000, initScript: INIT, query: `&story-delay=${delay}` }) as unknown as Opened;
  const press = async (selector: string) => { const target = opened.page.locator(selector).first(); if (touch) await target.tap(); else await target.click(); await opened.page.waitForTimeout(500); };
  if (ledger) {
    await press("[data-dock='ledger']"); await press("[data-ledger-tab='lord']"); await press("[data-lord-open]"); await press("[data-lord-nav='ledger']");
    await opened.page.locator(".lord-ledger").first().waitFor({ timeout: 15_000 });
    await opened.page.waitForTimeout(800);
  }
  return { ...opened, press };
}
/** What the ledger shows: the houses' suits with the defence, the threats, the claims; the floors. */
const facts = (page: Page) => page.evaluate(() => {
  const root = document.querySelector(".lord-ledger");
  const texts = [...(root?.querySelectorAll("*") ?? [])].filter(el => [...el.childNodes].some(node => node.nodeType === 3 && (node.textContent ?? "").trim() !== ""));
  const shut = (button: Element | null) => button === null ? null : (button as HTMLButtonElement).disabled ? "shut" : "open";
  return {
    against: [...(root?.querySelectorAll(".lord-ledger-suit[data-neighbour='true']") ?? [])].map(li => ({ id: li.getAttribute("data-suit"), stage: li.getAttribute("data-stage"),
      hearing: li.querySelector("[data-hearing]")?.textContent ?? null, verdict: li.querySelector("[data-verdict]")?.textContent ?? null, settled: li.querySelector("[data-settled]")?.textContent ?? null,
      defence: li.querySelector(".lord-ledger-defence") !== null,
      evidence: [...li.querySelectorAll("[data-block='defence-evidence'] [data-evidence]")].map(row => `${row.getAttribute("data-evidence")}:${row.querySelector("[data-given]")?.textContent ?? shut(row.querySelector("button"))}`),
      evidenceShut: li.querySelector("[data-block='defence-evidence'] [data-evidence-shut]")?.textContent ?? null,
      patrons: [...li.querySelectorAll("[data-block='defence-patron'] [data-seek]")].map(button => button.getAttribute("data-seek")),
      patron: li.querySelector("[data-block='defence-patron'] [data-patron]")?.textContent ?? null,
      pay: shut(li.querySelector("[data-concord='pay']")), yield: shut(li.querySelector("[data-concord='yield']")), hold: shut(li.querySelector(".lord-ledger-hold")),
      lines: [...li.querySelectorAll(".lord-ledger-defence .lord-ledger-line, .lord-ledger-defence .lord-ledger-shut")].map(node => node.textContent) })),
    suits: [...(root?.querySelectorAll(".lord-ledger-suit:not([data-neighbour])") ?? [])].map(li => ({ id: li.getAttribute("data-suit"), stage: li.getAttribute("data-stage"),
      track: [...li.querySelectorAll(".lord-ledger-step")].map(step => step.getAttribute("data-step")), hearing: li.querySelector("[data-hearing]")?.textContent ?? null,
      costs: li.querySelector("[data-stage-costs]")?.textContent ?? null })),
    threats: [...(root?.querySelectorAll(".lord-ledger-threat") ?? [])].map(li => ({ id: li.getAttribute("data-threat"), guarded: li.getAttribute("data-guarded"),
      guard: shut(li.querySelector(".lord-ledger-guard")), appease: shut(li.querySelector(".lord-ledger-appease")), lines: [...li.querySelectorAll(".lord-ledger-line")].map(node => node.textContent) })),
    past: [...(root?.querySelectorAll("[data-block='past-entries'] [data-record]") ?? [])].map(node => node.textContent),
    claims: [...(root?.querySelectorAll(".lord-ledger-claim") ?? [])].map(li => ({ id: li.getAttribute("data-claim"), novel: li.getAttribute("data-novel"),
      button: li.querySelector(".lord-ledger-file")?.textContent ?? null, file: shut(li.querySelector(".lord-ledger-file")), refusal: li.querySelector("[data-refusal]")?.textContent ?? null,
      hearing: li.querySelector("[data-claim-hearing]")?.textContent ?? null })),
    primaries: root?.querySelectorAll(".ui-btn--primary").length ?? null,
    smallestText: Math.min(...texts.map(el => parseFloat(getComputedStyle(el).fontSize))),
    smallestButton: Math.min(...[...(root?.querySelectorAll("button") ?? [])].map(button => button.getBoundingClientRect().height)),
    natives: root?.querySelectorAll("input, select, [title]").length ?? null,
  };
});
type Facts = Awaited<ReturnType<typeof facts>>;
const engine = (page: Page) => page.evaluate(() => {
  const state = (window as unknown as { __FEUDAL_PHASE10_PROOF__: { state: () => GameState } }).__FEUDAL_PHASE10_PROOF__.state();
  return { tick: state.tick, suits: (state.estates?.suits ?? []).filter(suit => suit.stage !== "closed" || suit.settled !== undefined).map(suit => ({ id: suit.id, stage: suit.stage,
    defenceEvidence: (suit.defenceEvidence ?? []).map(entry => entry.kind), defencePatron: suit.defencePatron ?? null, hold: suit.hold ?? null, settled: suit.settled ?? null, fast: suit.fast ?? null })),
    threats: (state.estates?.threats ?? []).map(threat => ({ id: threat.id, guarded: threat.guarded ?? null })) };
});
const writeFile = (file: string, data: Buffer) => writeFileSync(join(out!, file), data);
/** The panel's screen, `focus` scrolled to the top; `root` another box (a card). */
async function shot(page: Page, name: string, focus: string | null, dpr: number, root = ".slot-panel.lord-screen"): Promise<string> {
  if (focus !== null) await page.locator(focus).first().evaluate(node => node.scrollIntoView({ block: "start" }));
  await page.waitForTimeout(300);
  const box = await page.locator(root).first().boundingBox();
  const file = `${name}.jpg`;
  await writeFile(file, await page.screenshot({ type: "jpeg", quality: dpr === 2 ? 30 : 50, clip: { x: Math.max(0, box!.x), y: Math.max(0, box!.y), width: box!.width, height: box!.height } }));
  return file;
}
function common(name: string, seen: Facts, touch = false) {
  expect(name, seen.smallestText >= 12, `smallest text ${seen.smallestText}`);
  expect(name, seen.natives === 0, `native controls or title ${seen.natives}`);
  expect(name, seen.primaries === 0, `primary buttons ${seen.primaries}`);
  expect(name, !Number.isFinite(seen.smallestButton) || seen.smallestButton >= (touch ? 48 : 44), `button height ${seen.smallestButton}`);
}
async function view(name: string, state: GameState | null, focus: string | null, options: View, check: (seen: Facts) => void, after?: (opened: Opened & { press: (selector: string) => Promise<void> }, seen: Facts) => Promise<void>) {
  if (state === null) { rows.push({ name, file: null, note: "state not found" }); failures.push(`${name}: no state`); return; }
  const opened = await open(state, options);
  const seen = await facts(opened.page);
  common(name, seen, options.touch ?? false);
  check(seen);
  rows.push({ name, file: await shot(opened.page, name, focus, options.dpr ?? 1), viewport: `${options.width ?? 1280}x${options.height ?? 800}`, dpr: options.dpr ?? 1, ...seen, engine: await engine(opened.page) });
  if (after !== undefined) await after(opened, seen);
  await opened.context.close();
}
async function again(opened: Opened, name: string, focus: string | null): Promise<{ seen: Facts; game: Awaited<ReturnType<typeof engine>> }> {
  await opened.page.waitForTimeout(700);
  const seen = await facts(opened.page);
  common(name, seen);
  const game = await engine(opened.page);
  rows.push({ name, file: await shot(opened.page, name, focus, 1), ...seen, engine: game });
  return { seen, game };
}
const AGAINST = ".lord-ledger-suit[data-neighbour='true'][data-stage]:not([data-stage='closed'])";

await view("d1-defence-filed", load("neighbour-suit"), AGAINST, {}, seen => {
  const suit = seen.against.find(row => row.stage === "filed");
  expect("d1-defence-filed", suit !== undefined && suit.defence && suit.evidence.some(entry => entry.endsWith(":open")) && suit.pay !== null && suit.yield === "open" && suit.hold === "shut", JSON.stringify(seen.against));
}, async (opened, seen) => {
  const suit = seen.against.find(row => row.stage === "filed");
  if (suit === undefined) return;
  await opened.press(`[data-suit='${suit.id}'] [data-block='defence-evidence'] [data-bring='deed']`);
  const { seen: after, game } = await again(opened, "d2-defence-evidence", AGAINST);
  expect("d2-defence-evidence", game.suits.find(entry => entry.id === suit.id)?.defenceEvidence.includes("deed") === true, JSON.stringify(game.suits));
  expect("d2-defence-evidence", after.against.find(row => row.id === suit.id)?.hearing !== suit.hearing, "the hearing line moved");
});
await view("d1-tablet-dpr2", load("neighbour-suit"), AGAINST, { width: 1180, height: 820, dpr: 2, touch: true }, () => undefined);
await view("d3-defence-patronage", load("suit-defence-patronage"), AGAINST, {}, seen => {
  expect("d3-defence-patronage", seen.against.some(row => row.stage === "patronage" && row.patrons.length > 0 && row.evidenceShut !== null), JSON.stringify(seen.against));
}, async (opened, seen) => {
  const suit = seen.against.find(row => row.stage === "patronage" && row.patrons.length > 0);
  if (suit === undefined) return;
  await opened.press(`[data-suit='${suit.id}'] [data-block='defence-patron'] [data-seek='${suit.patrons[0]}']`);
  const { game } = await again(opened, "d4-patron-chosen", AGAINST);
  expect("d4-patron-chosen", game.suits.find(entry => entry.id === suit.id)?.defencePatron === suit.patrons[0], JSON.stringify(game.suits));
});
await view("d5-defence-enforcing", load("suit-defence-enforcing"), AGAINST, {}, seen => {
  expect("d5-defence-enforcing", seen.against.some(row => row.stage === "enforcing" && row.hold === "open" && row.verdict !== null), JSON.stringify(seen.against));
}, async (opened, seen) => {
  const suit = seen.against.find(row => row.stage === "enforcing");
  if (suit === undefined) return;
  const before = (await engine(opened.page)).suits.find(entry => entry.id === suit.id)?.hold ?? null;
  await opened.press(`[data-suit='${suit.id}'] .lord-ledger-hold`);
  const { seen: after, game } = await again(opened, "d6-held", AGAINST);
  expect("d6-held", (game.suits.find(entry => entry.id === suit.id)?.hold ?? 0) > (before ?? 0) && after.against.find(row => row.id === suit.id)?.hold === "shut", `${before} → ${JSON.stringify(game.suits)}`);
});
await view("d7-concord-before", load("neighbour-suit"), AGAINST, {}, () => undefined, async (opened, seen) => {
  const suit = seen.against.find(row => row.stage === "filed" && row.pay === "open");
  expect("d7-concord-before", suit !== undefined, JSON.stringify(seen.against));
  if (suit === undefined) return;
  await opened.press(`[data-suit='${suit.id}'] [data-concord='pay']`);
  const { seen: after, game } = await again(opened, "d7-concord-paid", `[data-suit='${suit.id}']`);
  expect("d7-concord-paid", game.suits.find(entry => entry.id === suit.id)?.settled === "pay" && after.against.find(row => row.id === suit.id)?.settled !== null, JSON.stringify(game.suits));
});
await view("t1-entry-threat", load("suit-entry-threat"), "[data-section='entry-threats']", {}, seen => {
  expect("t1-entry-threat", seen.threats.some(row => row.guard === "open" && row.appease === "open" && row.lines.length >= 2), JSON.stringify(seen.threats));
}, async (opened, seen) => {
  const threat = seen.threats.find(row => row.guard === "open");
  if (threat === undefined) return;
  await opened.press(`[data-guard='${threat.id}']`);
  const { seen: after, game } = await again(opened, "t2-guarded", "[data-section='entry-threats']");
  expect("t2-guarded", game.threats.find(entry => entry.id === threat.id)?.guarded === true && after.threats.find(row => row.id === threat.id)?.guarded === "true", JSON.stringify(game.threats));
});
await view("t3-entry-forced", load("suit-entry-forced"), "[data-section='suits']", {}, seen => {
  expect("t3-entry-forced", seen.claims.some(row => row.novel === "true" && row.file === "open" && row.hearing !== null) && seen.past.length > 0, JSON.stringify({ claims: seen.claims, past: seen.past }));
}, async (opened, seen) => {
  const claim = seen.claims.find(row => row.novel === "true" && row.file === "open");
  if (claim === undefined) return;
  await opened.press(`[data-file='${claim.id}']`);
  const { seen: after, game } = await again(opened, "t4-novel-filed", "[data-section='suits'] .lord-ledger-suit");
  const suit = after.suits.find(row => row.stage === "filed" && !row.track.includes("evidence"));
  expect("t4-novel-filed", suit !== undefined && game.suits.some(entry => entry.fast === true), JSON.stringify({ suits: after.suits, game: game.suits }));
});
// The moment's card (its chip comes once the story delay passes) and the contested card: not the ledger.
for (const [name, state, story, root] of [["m1-moment-lost", load("suit-neighbour-took"), "lord_moment", ".event-card[data-story='lord_moment']"],
  ["k1-contested-ended", astra(), "lord_decision", ".event-card[data-story='lord_decision']"]] as const) {
  if (state === null) { failures.push(`${name}: no state`); continue; }
  const opened = await open(state, { ledger: false, delay: 0 });
  const chip = `.event-chip[data-story='${story}']`;
  const found = await opened.page.locator(chip).first().waitFor({ timeout: 90_000 }).then(() => true).catch(() => false);
  if (found) await opened.press(chip);
  const card = await opened.page.evaluate(selector => {
    const node = document.querySelector(selector);
    return node === null ? null : { title: node.querySelector("h2")?.textContent ?? null, lines: [...node.querySelectorAll("p, li")].map(entry => entry.textContent) };
  }, root);
  expect(name, card !== null, `no ${root}`);
  if (name === "m1-moment-lost") expect(name, card?.title === "이웃이 점유를 가져갔다", JSON.stringify(card));
  if (name === "k1-contested-ended") expect(name, card?.lines.some(line => /영주의 소송: 끝남 · 판결: 영주가 졌습니다/.test(line ?? "")) === true, JSON.stringify(card));
  rows.push({ name, file: card === null ? null : await shot(opened.page, name, null, 1, root), card });
  await opened.context.close();
}

await browser.close();
writeFileSync(join(out, "captures.json"), `${JSON.stringify({ rows, failures }, null, 1)}\n`);
process.stderr.write(`suit-ledger captures: ${rows.length} rows, ${failures.length} failures\n${failures.join("\n")}\n`);
if (failures.length > 0) process.exitCode = 1;
