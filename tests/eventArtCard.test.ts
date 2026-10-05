/**
 * EVENT-ART: the registry's event card (lord mode only) and its picture by the content canon v4 event id — the card's
 * words, choices, why and deadline from the engine; the answer through the reducer; the picture by id and by the
 * engine's artId; the shipped pictures exactly the registry's; nothing outside lord mode; never a home petition twice.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { buildKeyartDerivative, encodeJpeg, EVENT_ART_DERIVATIVES, JPEG_QUALITY, KEYART_DERIVATIVE_BY_URL, sha256 } from "../scripts/keyartDerivatives";
import { decodeJpeg } from "../scripts/jpegDecode";
import { categorize, evaluateBudget, loadBudgetConfig } from "../scripts/checks/distBudget.mjs";
import { enumerateRuntimeAssets } from "../scripts/provenanceLedgerAssets";
import { LORD_SLICE_SCENARIO_ID } from "../src/content/lordSliceConfig";
import { ALL_REGISTRY_ENTRIES } from "../src/content/registry/registryEntries";
import { REGISTRY_COPY } from "../src/content/registry/registryCopy.ko";
import type { RegistryEntry } from "../src/content/registry/registryTypes";
import type { GameState } from "../src/engine/engine.types";
import { enabledChoices, registryEntries, registryEntry, registryOf } from "../src/engine/registry";
import type { RegistryOccurrence } from "../src/engine/registry.types";
import { treasuryBalance } from "../src/ledger/ledger";
import { gameReducer } from "../src/state/gameStore";
import { newGameState } from "../src/state/newGame";
import { eventArtFor } from "../src/ui/eventArt";
import { EVENT_ART_IMAGES } from "../src/ui/eventArtManifest.generated";
import { shippedEventArtIds } from "../src/ui/eventArtSelection";
import { decisionModal, storyBeats } from "../src/ui/eventStory";
import { calendarDays } from "../src/ui/gameTimeCopy.ko";
import { RegistryOfferModal } from "../src/ui/hud/RegistryCard";
import { courtLine } from "../src/ui/lordCardsModel";
import { lordBeats } from "../src/ui/lordStoryBeats";
import { REGISTRY_CARD_COPY } from "../src/ui/registryCardCopy.ko";
import { openRegistryCards, registryCardView, registryOfferView, registryWhy } from "../src/ui/registryCardModel";
import { storyArtStyle } from "../src/ui/storyArt";

const SEASON = 1_000;
const lord = newGameState({ scenarioId: LORD_SLICE_SCENARIO_ID, seed: 1 })!;

/** The state with an offer of `entryId` open (as offerSeason writes one: offered now, a season to answer). */
function offered(state: GameState, entryId: string, conditions: readonly string[] = []): { state: GameState; occurrence: RegistryOccurrence } {
  const occurrence: RegistryOccurrence = { id: `registry:${entryId}::${Math.floor(state.tick / SEASON)}`, entryId, boundId: "", offeredTick: state.tick,
    deadline: state.tick + SEASON, status: "offered", receipt: { draw: 123, chancePermille: 500, conditions } };
  const registry = registryOf(state);
  return { state: { ...state, registry: { ...registry, occurrences: [...registry.occurrences, occurrence] } }, occurrence };
}
const entry = (id: string) => registryEntry(id)!;

test("the card's words, choices, why and deadline are the engine's (ck_evt_050: no conditions, the policy already growth)", () => {
  const { state, occurrence } = offered(lord, "ck_evt_050");
  assert.equal(state.agency?.policy, "growth");
  const view = registryOfferView(state)!;
  assert.equal(view.occurrenceId, occurrence.id);
  assert.equal(view.title, REGISTRY_COPY.ck_evt_050!.title);
  assert.equal(view.body, REGISTRY_COPY.ck_evt_050!.body);
  assert.equal(view.court, courtLine(state));
  assert.deepEqual(view.choices.map(choice => choice.label), ["stability", "growth", "revenue"].map(id => REGISTRY_COPY.ck_evt_050!.choices[id]!.label));
  // Enabled exactly as the engine's enabledChoices; growth is shut with why (the policy is growth already).
  assert.deepEqual(view.choices.filter(choice => choice.enabled).map(choice => choice.id), enabledChoices(state, entry("ck_evt_050"), "", occurrence.id));
  assert.deepEqual(view.choices.filter(choice => !choice.enabled).map(choice => [choice.id, choice.line]), [["growth", REGISTRY_CARD_COPY.already]]);
  assert.ok(view.choices.filter(choice => choice.enabled).every(choice => choice.treasury === 0));
  assert.deepEqual(view.why, [REGISTRY_CARD_COPY.noConditions, REGISTRY_CARD_COPY.drawn(500)]);
  assert.equal(view.waits, REGISTRY_CARD_COPY.waits(calendarDays(SEASON), 1300, "여름"));
  assert.equal(view.lapse, REGISTRY_CARD_COPY.lapse(null));
  assert.equal(view.art, "ck_evt_050");
  assert.match(view.from, /^보낸 쪽 · /);
});

test("why it came: the receipt's conditions in words, an unknown one said generically (never a raw key)", () => {
  const conditions = [JSON.stringify(entry("ck_evt_005").conditions)];
  const why = registryWhy({ receipt: { draw: 3, chancePermille: 500, conditions } });
  assert.deepEqual(why, ["장터가 서 있습니다", "시장 좌판세가 기본의 100%입니다", REGISTRY_CARD_COPY.drawn(500)]);
  // Every condition the registry's live entries carry has words.
  for (const item of registryEntries()) {
    if (item.conditions === undefined) continue;
    const lines = registryWhy({ receipt: { draw: 0, chancePermille: 500, conditions: [JSON.stringify(item.conditions)] } });
    assert.ok(!lines.includes(REGISTRY_CARD_COPY.unknownCondition), `${item.id}: ${lines.join(" / ")}`);
    assert.ok(lines.every(line => !/[a-z_]+\.[a-z]/i.test(line)), `${item.id}: a raw field in ${lines.join(" / ")}`);
  }
  const odd = registryWhy({ receipt: { draw: 0, chancePermille: 250, conditions: [JSON.stringify({ field: "marriage.open", op: "eq", value: true }), "not json"] } });
  assert.deepEqual(odd, [REGISTRY_CARD_COPY.unknownCondition, REGISTRY_CARD_COPY.unknownCondition, REGISTRY_CARD_COPY.drawn(250)]);
});

test("a choice the engine would not carry out is shut with its own condition as the reason", () => {
  const { state, occurrence } = offered(lord, "test:costly");
  const costly: RegistryEntry = { ...entry("ck_evt_050"), id: "test:costly", artId: null,
    choices: [{ id: "a", effects: [{ command: "none" }] }, { id: "b", effects: [{ command: "treasury", amount: -1 }], requires: { field: "treasury", op: "gte", value: 1_000_000 } }] };
  const view = registryCardView(state, { occurrence: { ...occurrence, entryId: costly.id }, entry: costly });
  assert.deepEqual(view.choices.map(choice => choice.enabled), [true, false]);
  assert.match(view.choices[1]!.line, /^지금은 고를 수 없습니다: 금고에 .+ 이상 있어야 합니다$/);
  // No words for its title, body or answers: the card's own fallbacks, no picture (no other picture stands in).
  assert.equal(view.title, REGISTRY_CARD_COPY.title);
  assert.deepEqual(view.choices.map(choice => choice.label), [REGISTRY_CARD_COPY.choice(1), REGISTRY_CARD_COPY.choice(2)]);
  assert.equal(view.art, null);
});

test("the answer goes through answer_registry_offer and applies the engine's effects; the card then goes", () => {
  const { state, occurrence } = offered(lord, "ck_evt_050");
  const answered = gameReducer(state, { type: "answer_registry_offer", occurrenceId: occurrence.id, choiceId: "stability" });
  assert.equal(answered.agency?.policy, "stability");
  assert.equal(registryOf(answered).occurrences.find(item => item.id === occurrence.id)?.status, "answered");
  assert.equal(registryOfferView(answered), null);
  assert.ok(!lordBeats(answered).some(beat => beat.kind === "registry_event"));
  // A shut choice changes nothing (the card stays).
  assert.equal(gameReducer(state, { type: "answer_registry_offer", occurrenceId: occurrence.id, choiceId: "growth" }), state);
  // Past its deadline the offer is not open: no card.
  assert.equal(registryOfferView({ ...state, tick: occurrence.deadline + 1 }), null);
  // The treasury the card shows is the engine's move (ck_evt_005's lower dues: none now).
  const dues = offered(lord, "ck_evt_005");
  const lower = registryOfferView(dues.state)!.choices.find(choice => choice.id === "a")!;
  const after = gameReducer(dues.state, { type: "answer_registry_offer", occurrenceId: dues.occurrence.id, choiceId: "a" });
  assert.equal(treasuryBalance(after) - treasuryBalance(dues.state), lower.treasury);
});

test("lord mode only, and a home petition never gets this card", () => {
  for (const scenarioId of ["core:sandbox", "core:campaign_market_town"]) {
    const { state } = offered(newGameState({ scenarioId })!, "ck_evt_050");
    assert.equal(state.agency, undefined, scenarioId);
    assert.deepEqual(openRegistryCards(state), []);
    assert.equal(registryOfferView(state), null);
    assert.ok(!storyBeats(state).some(beat => beat.kind === "registry_event"), scenarioId);
  }
  const home = offered(lord, "home:heriot");
  assert.deepEqual(openRegistryCards(home.state), []);
  assert.ok(!lordBeats(home.state).some(beat => beat.kind === "registry_event"));
});

test("the offer comes as a story beat whose [결정하기] opens the card, with the picture on its chip", () => {
  const { state, occurrence } = offered(lord, "ck_evt_027");
  const beat = lordBeats(state).find(item => item.kind === "registry_event")!;
  assert.equal(beat.id, `registry:${occurrence.id}`);
  assert.equal(beat.decision, "registry_offer");
  assert.equal(decisionModal("registry_offer"), "registry_offer");
  assert.equal(beat.illustration, "ck_evt_027");
  assert.equal(beat.title, REGISTRY_COPY.ck_evt_027!.title);
  assert.match(String(storyArtStyle("ck_evt_027", 64).backgroundImage), /assets\/event-art\/ck_evt_027\.jpg/);
});

test("the card renders the picture whole, equal answers all secondary, a shut one disabled; no picture without one", () => {
  const { state } = offered(lord, "ck_evt_050");
  const html = renderToStaticMarkup(createElement(RegistryOfferModal, { view: registryOfferView(state)!, onAnswer: () => undefined, onLater: () => undefined }));
  assert.match(html, /data-registry-offer="ck_evt_050"/);
  assert.match(html, /data-art="ck_evt_050"[^>]*background-size:contain/);
  assert.equal((html.match(/class="petition-option registry-card-option ui-btn ui-btn--secondary"/g) ?? []).length, 3);
  assert.ok(!html.includes("ui-btn--primary"), "one primary per screen at most; equal answers are secondary (LR1-D2)");
  assert.match(html, /data-choice="growth" data-enabled="false" disabled=""/);
  assert.match(html, new RegExp(REGISTRY_CARD_COPY.whyHeading));
  const noArt = { ...registryOfferView(state)!, art: null };
  assert.ok(!renderToStaticMarkup(createElement(RegistryOfferModal, { view: noArt, onAnswer: () => undefined, onLater: () => undefined })).includes("lord-card-art"));
});

test("the picture by the entry's id, or by the artId the engine sets; none for an id without one", () => {
  assert.equal(eventArtFor({ id: "ck_evt_005", artId: null }), "ck_evt_005");
  assert.equal(eventArtFor({ id: "ck_evt_005", artId: "ck_evt_013" }), "ck_evt_013", "the engine's artId wins");
  assert.equal(eventArtFor({ id: "test:none", artId: null }), null);
  assert.equal(eventArtFor({ id: "ck_evt_001", artId: null }), null, "a picture this build does not ship is not shown");
  // The selection follows the registry alone: an entry added later ships its picture; an artId ships its own.
  const later: RegistryEntry = { ...entry("ck_evt_050"), id: "ck_evt_101" };
  const pointed: RegistryEntry = { ...entry("ck_evt_050"), id: "ck_evt_999", artId: "ck_evt_150" };
  const home = ALL_REGISTRY_ENTRIES.find(item => item.generator === "home_cycle")!;
  assert.deepEqual(shippedEventArtIds(EVENT_ART_IMAGES, [later, pointed, { ...home, artId: "ck_evt_012" }]), ["ck_evt_101", "ck_evt_150"]);
});

test("the build ships exactly the registry's pictures, re-encoded smaller, deterministic, in their own on-demand category", () => {
  const live = registryEntries().filter(item => item.generator === undefined).map(item => item.artId ?? item.id).filter(id => id in EVENT_ART_IMAGES).sort();
  assert.deepEqual(shippedEventArtIds(EVENT_ART_IMAGES), live);
  assert.deepEqual(live, ["ck_evt_005", "ck_evt_009", "ck_evt_013", "ck_evt_027", "ck_evt_032", "ck_evt_033", "ck_evt_034", "ck_evt_038", "ck_evt_050", "ck_evt_052", "ck_evt_053"]);
  assert.deepEqual(EVENT_ART_DERIVATIVES.map(item => item.url), live.map(id => `assets/event-art/${id}.jpg`));
  const provenance = readFileSync("docs/provenance/assets.csv", "utf8");
  let received = 0; let built = 0;
  for (const item of EVENT_ART_DERIVATIVES) {
    assert.equal(KEYART_DERIVATIVE_BY_URL.get(item.url), item);
    assert.equal(item.format, "jpeg-reencoded");
    const source = readFileSync(item.source);
    const shipped = buildKeyartDerivative(item);
    // The same bytes every build (the cache only stores them): decode + encode again, without the cache, is identical.
    assert.equal(sha256(encodeJpeg(decodeJpeg(source), JPEG_QUALITY)), sha256(shipped), `${item.id} deterministic`);
    // Pinned: the provenance row names the runtime file's size and SHA (scripts/installEventArt.ts writes them).
    assert.ok(provenance.includes(`jpeg-reencoded: ${shipped.length} bytes, sha256 ${sha256(shipped)}`), `${item.id}: provenance pins the derivative`);
    const sof = shipped.indexOf(Buffer.from([0xff, 0xc0]));
    assert.deepEqual([shipped[0], shipped[1], shipped.readUInt16BE(sof + 7), shipped.readUInt16BE(sof + 5)], [0xff, 0xd8, 960, 540], `${item.id}: baseline 960 × 540`);
    assert.ok(shipped.length < source.length, `${item.id}: ${shipped.length} < ${source.length}`);
    received += source.length; built += shipped.length;
  }
  assert.ok(built < 0.8 * received && built < 1_500_000, `${built} of ${received} bytes`);
  // distBudget: their own measured category, on demand, out of the first load's total.
  const config = loadBudgetConfig();
  assert.equal(categorize("assets/event-art/ck_evt_005.jpg", config)?.category, "event_cards");
  const category = config.categories.find(entry => entry.id === "event_cards") as { budgetMB: number | null; onDemand?: boolean; name: string };
  assert.deepEqual([category.budgetMB, category.onDemand, category.name], [null, true, "사건 삽화(카드에서 불러옴)"]);
  const result = evaluateBudget([{ path: "assets/event-art/ck_evt_005.jpg", bytes: 1000 }, { path: "index.html", bytes: 10 }], config);
  assert.deepEqual([result.total.bytes, result.total.files, result.onDemand.bytes, result.onDemand.files], [10, 1, 1000, 1]);
});

test("the pictures load only when a card or chip shows them: nothing at start, nothing imported into the bundle", () => {
  // No preload names them, and no module imports a picture file (only the manifest's strings reach the bundle).
  for (const file of ["src/render/preloadGameArt.ts", "scripts/checks/startupArtList.ts"]) assert.ok(!/event-?art/i.test(readFileSync(file, "utf8")), file);
  for (const file of ["src/ui/eventArt.ts", "src/ui/storyArt.ts", "src/ui/hud/RegistryCard.tsx", "src/ui/eventArtManifest.generated.ts"]) {
    assert.ok(!/import[^;]*\.(jpe?g|png|webp)["']/.test(readFileSync(file, "utf8")), file);
  }
  // The url is set as the card's (or chip's) background only when it renders.
  assert.match(String(storyArtStyle("ck_evt_005", 64).backgroundImage), /^url\("\/?assets\/event-art\/ck_evt_005\.jpg"\)$/);
});

test("all 200 are in the manifest from their confirmed ledger rows; only the shipped are runtime assets with provenance", () => {
  const ids = Object.keys(EVENT_ART_IMAGES);
  assert.equal(ids.length, 200);
  const inbox = readFileSync("assets-inbox/INBOX_LEDGER.csv", "utf8").split("\r\n");
  for (const [id, image] of Object.entries(EVENT_ART_IMAGES)) {
    assert.equal(image.width, 960); assert.equal(image.height, 540);
    assert.ok(existsSync(image.source), image.source);
    const row = inbox.find(line => line.split(",")[1] === image.source.slice("assets-inbox/".length));
    assert.ok(row !== undefined, `${id}: no ledger row`);
    assert.equal(row.split(",")[2], sha256(readFileSync(image.source)), `${id}: the ledger's SHA`);
    assert.match(row, /,confirmed,,/, `${id}: confirmed, not replaced`);
  }
  const runtime = new Set(enumerateRuntimeAssets().map(asset => asset.runtimePath));
  const provenance = readFileSync("docs/provenance/assets.csv", "utf8");
  for (const id of ids) {
    const source = EVENT_ART_IMAGES[id as keyof typeof EVENT_ART_IMAGES].source;
    const shipped = shippedEventArtIds(EVENT_ART_IMAGES).includes(id);
    // ck_evt_012 is LM-R1's Wave 44 stall dispute (the same file): a runtime asset of its own manifest.
    if (id !== "ck_evt_012") assert.equal(runtime.has(source), shipped, `${id} runtime`);
    assert.equal(provenance.includes(`\nevent-art/${id},`), shipped, `${id} provenance row`);
    if (shipped) assert.ok(existsSync(`docs/provenance/prompts/${id}-event-art.txt`));
  }
});
