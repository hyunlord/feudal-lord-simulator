/**
 * EVENT-ART: the registry's event card on the content canon v4 (lord mode only) and its picture by the v4 event id — the
 * card's words (V4_COPY), choices (`offerChoices`; the others shut with why), what a hold costs (ER-19), why it came and
 * the deadline from the engine; the answer through the reducer applying the engine's commands; the picture by id; the
 * shipped pictures exactly the entries the registry runs; nothing outside lord mode; never a home petition.
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
import { factionDisplayName } from "../src/content/factionCopy.ko";
import { LORD_SLICE_SCENARIO_ID } from "../src/content/lordSliceConfig";
import { HOLD_CLAIM_WEAKEN, HOLD_RELATION_DELTA } from "../src/content/registry/registryHoldConfig";
import { V4_COPY } from "../src/content/registry/v4Copy.generated";
import type { GameState } from "../src/engine/engine.types";
import { estatesOf } from "../src/engine/estates";
import { faction } from "../src/engine/factions";
import { initialRegistry, offerChoices, registryOf } from "../src/engine/registry";
import type { RegistryOccurrence } from "../src/engine/registry.types";
import { bindEntry, boundIdentities, registryV4Support, v4Entries, v4Entry } from "../src/engine/registryV4";
import { initialAgency } from "../src/engine/townAgency";
import { postLedgerEntries, treasuryBalance } from "../src/ledger/ledger";
import { decodeSave } from "../src/save/saveCodec";
import { gameReducer } from "../src/state/gameStore";
import { newGameState } from "../src/state/newGame";
import { eventArtFor } from "../src/ui/eventArt";
import { EVENT_ART_IMAGES } from "../src/ui/eventArtManifest.generated";
import { eventCardEntryIds, shippedEventArtIds } from "../src/ui/eventArtSelection";
import { decisionModal, storyBeats } from "../src/ui/eventStory";
import { calendarDays } from "../src/ui/gameTimeCopy.ko";
import { RegistryOfferModal } from "../src/ui/hud/RegistryCard";
import { courtLine } from "../src/ui/lordCardsModel";
import { lordBeats } from "../src/ui/lordStoryBeats";
import { REGISTRY_CARD_COPY } from "../src/ui/registryCardCopy.ko";
import { openRegistryCards, registryOfferView } from "../src/ui/registryCardModel";
import { lordOutcome } from "../src/ui/decisionCard/families/lordOutcome";
import { afterAnswer } from "../src/ui/decisionCard/remembers";
import { storyArtStyle } from "../src/ui/storyArt";

const SEASON = 1_000;
const load = (name: string): GameState => decodeSave(new Uint8Array(readFileSync(`fixtures/saves/v49/${name}.save.json`))).envelope.state as GameState;
function funded(state: GameState, amount: number): GameState {
  const posted = postLedgerEntries(state, [{ account: "cash", category: "rent", amount: amount - treasuryBalance(state), sourceRefs: [{ type: "actor", id: "test" }] }]);
  return { ...state, ledger: posted.ledger, treasuryCoin: posted.treasuryCoin };
}
/** A lord's town of chapter two (its factions, a market, the dues at their default) with 500 pennies. */
const town: GameState = funded({ ...load("chapter-two-town"), agency: initialAgency(), registry: initialRegistry() }, 500);
/** The lord's slice at its start (the lord's open fishery claim, 60 pennies, no factions yet). */
const lord = newGameState({ scenarioId: LORD_SLICE_SCENARIO_ID, seed: 1 })!;
const runs = registryV4Support().filter(entry => entry.runs).map(entry => entry.id);

/** The state with a v4 offer of `entryId` open on its first targets, as the registry writes one (offered now, a season to answer). */
function offered(state: GameState, entryId: string): { state: GameState; occurrence: RegistryOccurrence } {
  const bound = bindEntry(state, v4Entry(entryId)!);
  const occurrence: RegistryOccurrence = { id: `registry:${entryId}:test:${Math.floor(state.tick / SEASON)}`, entryId, boundId: "", offeredTick: state.tick,
    deadline: state.tick + SEASON, status: "offered", receipt: { draw: 123, chancePermille: 500, conditions: [] }, source: "v4",
    bound: bound === null ? {} : boundIdentities(bound), key: entryId, context: "" };
  const registry = registryOf(state);
  return { state: { ...state, registry: { ...registry, occurrences: [...registry.occurrences, occurrence] } }, occurrence };
}
const merchants = (state: GameState) => factionDisplayName("merchant_house_1", faction(state, "merchant_house_1")!.name);

test("the card's words, choices, hold, why and deadline are the engine's (ck_evt_005: the market dues, its merchants' hold)", () => {
  const { state, occurrence } = offered(town, "ck_evt_005");
  const view = registryOfferView(state)!;
  const copy = V4_COPY.ck_evt_005!;
  assert.deepEqual([view.occurrenceId, view.entryId, view.art, view.title, view.body], [occurrence.id, "ck_evt_005", "ck_evt_005", copy.title, copy.body]);
  assert.equal(view.court, courtLine(state));
  assert.equal(view.from, REGISTRY_CARD_COPY.from(copy.sender, merchants(state)), "the sender, and the town's own merchant house by name");
  assert.deepEqual(view.choices.map(choice => [choice.id, choice.label, choice.enabled]), ["a", "b", "c"].map(id => [id, copy.choices[id]!.label, true]));
  assert.deepEqual(view.choices.filter(choice => choice.enabled).map(choice => choice.id), offerChoices(state, occurrence));
  assert.deepEqual(view.choices.map(choice => choice.line), ["a", "b", "c"].map(id => copy.choices[id]!.tradeoff));
  // ER-19: the hold says what it costs — the sender faction's relation, by name.
  const hold = view.choices.find(choice => choice.hold)!;
  assert.equal(hold.id, "c");
  assert.equal(hold.cost, REGISTRY_CARD_COPY.holdRelation(merchants(state)));
  assert.match(hold.cost!, new RegExp(`관계가 ${-HOLD_RELATION_DELTA} 나빠집니다$`));
  assert.ok(view.choices.filter(choice => !choice.hold).every(choice => choice.cost === null));
  assert.deepEqual(view.why, [REGISTRY_CARD_COPY.conditionsHeld, REGISTRY_CARD_COPY.drawn(500)]);
  const end = Math.floor((occurrence.deadline % 4000) / SEASON);
  assert.equal(view.waits, REGISTRY_CARD_COPY.waits(calendarDays(SEASON), Math.floor(occurrence.deadline / 4000) + 1300, ["봄", "여름", "가을", "겨울"][end]!));
  assert.equal(view.lapse, REGISTRY_CARD_COPY.lapse);
});

test("why it came names the bound targets in words; a hold costing nothing now is not shown; a shut answer says why", () => {
  // The lord's fishery claim: bound by name, its hold weakens the claim; the claim with a charter too is more than the treasury holds.
  const fishery = registryOfferView(offered(lord, "ck_evt_010").state)!;
  assert.deepEqual(fishery.why, [REGISTRY_CARD_COPY.conditionsHeld, REGISTRY_CARD_COPY.bound("걸린 청구", "어업권"), REGISTRY_CARD_COPY.drawn(500)]);
  assert.deepEqual(fishery.choices.map(choice => [choice.id, choice.enabled, choice.hold]), [["a", true, false], ["b", true, true], ["c", false, false]]);
  assert.equal(fishery.choices[1]!.cost, REGISTRY_CARD_COPY.holdClaim);
  assert.match(REGISTRY_CARD_COPY.holdClaim, new RegExp(`힘이 ${HOLD_CLAIM_WEAKEN} 줄어듭니다`));
  assert.equal(fishery.choices[2]!.line, REGISTRY_CARD_COPY.shut({ kind: "refused" }));
  assert.equal(fishery.choices[0]!.treasury, -60, "filing costs the treasury 60d now (the engine's own command on a copy)");
  // A marriage offer: the groom, the bride, her house and the jointure by name; a one-shot entry says so.
  const marriage = registryOfferView(offered(lord, "ck_evt_128").state)!;
  assert.ok(marriage.why.includes(REGISTRY_CARD_COPY.oncePerCampaign));
  assert.ok(marriage.why.includes(REGISTRY_CARD_COPY.bound("상대 가문", "드 코르벨")), marriage.why.join(" / "));
  // No faction to cost: the merchants' hold is hidden (the user's decision: no cost, no hold).
  const { factions: _factions, ...withoutFactions } = town;
  const noFactions = registryOfferView(offered(withoutFactions, "ck_evt_005").state)!;
  assert.deepEqual(noFactions.choices.map(choice => choice.id), ["a", "b"]);
  // Shut by the choice's own condition: already so; not enough in the treasury (in money).
  assert.equal(registryOfferView(offered(town, "ck_evt_108").state)!.choices.find(choice => choice.id === "c")!.line, REGISTRY_CARD_COPY.shut({ kind: "already" }));
  assert.match(registryOfferView(offered(lord, "ck_evt_102").state)!.choices.find(choice => choice.id === "a")!.line, /^지금은 고를 수 없습니다: 금고에 .+ 이상 있어야 합니다$/);
  // The targets gone (the dues moved off the window): nothing to carry out, each answer says so.
  const { state: open } = offered(town, "ck_evt_005");
  const gone = registryOfferView({ ...open, agency: { ...open.agency!, duesPermille: 750 } })!;
  assert.deepEqual(gone.choices.map(choice => [choice.id, choice.line]), [["a", REGISTRY_CARD_COPY.shut({ kind: "gone" })], ["b", REGISTRY_CARD_COPY.shut({ kind: "gone" })]]);
});

test("every live entry's card is in words: no raw key in why it came or in a shut answer's reason", () => {
  for (const base of [town, lord]) for (const id of runs) {
    if (bindEntry(base, v4Entry(id)!) === null) continue;
    const view = registryOfferView(offered(base, id).state)!;
    for (const line of [...view.why, ...view.choices.map(choice => choice.line), view.from]) {
      assert.ok(!/[A-Za-z_]{3,}|undefined|null/.test(line), `${id}: ${line}`);
    }
    assert.ok(view.choices.every(choice => choice.label !== "" && choice.line !== ""), id);
  }
});

test("the answer goes through answer_registry_offer and applies the engine's commands; a hold its cost; the card then goes", () => {
  const { state, occurrence } = offered(town, "ck_evt_005");
  const lower = gameReducer(state, { type: "answer_registry_offer", occurrenceId: occurrence.id, choiceId: "a" });
  assert.equal(lower.agency?.duesPermille, 750);
  assert.equal(registryOf(lower).occurrences.find(item => item.id === occurrence.id)?.status, "answered");
  assert.equal(registryOfferView(lower), null);
  assert.ok(!lordBeats(lower).some(beat => beat.kind === "registry_event"));
  // The merchants' hold: the occurrence keeps its cost, the history moves the relation.
  const held = gameReducer(state, { type: "answer_registry_offer", occurrenceId: occurrence.id, choiceId: "c" });
  assert.deepEqual(registryOf(held).occurrences.find(item => item.id === occurrence.id)?.hold, { faction: "merchant_house_1", delta: HOLD_RELATION_DELTA });
  assert.equal(held.agency?.duesPermille, state.agency?.duesPermille);
  // The fishery claim held: it weakens by the hold's cost; filed: the treasury moves as the card said.
  const fishery = offered(lord, "ck_evt_010");
  const before = estatesOf(fishery.state).claims.find(claim => claim.id === fishery.occurrence.bound!.claim)!.strength;
  const waited = gameReducer(fishery.state, { type: "answer_registry_offer", occurrenceId: fishery.occurrence.id, choiceId: "b" });
  assert.equal(estatesOf(waited).claims.find(claim => claim.id === fishery.occurrence.bound!.claim)!.strength, before - HOLD_CLAIM_WEAKEN);
  const shown = registryOfferView(fishery.state)!.choices.find(choice => choice.id === "a")!;
  const filed = gameReducer(fishery.state, { type: "answer_registry_offer", occurrenceId: fishery.occurrence.id, choiceId: "a" });
  assert.equal(treasuryBalance(filed) - treasuryBalance(fishery.state), shown.treasury);
  assert.ok(estatesOf(filed).suits.some(suit => suit.claimId === fishery.occurrence.bound!.claim));
  // A shut choice changes nothing (the card stays); past its deadline the offer is not open: no card.
  assert.equal(gameReducer(fishery.state, { type: "answer_registry_offer", occurrenceId: fishery.occurrence.id, choiceId: "c" }), fishery.state);
  assert.equal(registryOfferView({ ...state, tick: occurrence.deadline + 1 }), null);
});

test("lord mode only, and a home petition never gets this card", () => {
  for (const scenarioId of ["core:sandbox", "core:campaign_market_town"]) {
    const plain = newGameState({ scenarioId })!;
    const occurrence = offered(town, "ck_evt_005").occurrence;
    const state: GameState = { ...plain, registry: { ...registryOf(plain), occurrences: [occurrence] } };
    assert.equal(state.agency, undefined, scenarioId);
    assert.deepEqual(openRegistryCards(state), []);
    assert.equal(registryOfferView(state), null);
    assert.ok(!storyBeats(state).some(beat => beat.kind === "registry_event"), scenarioId);
  }
  const registry = registryOf(lord);
  const home: RegistryOccurrence = { id: "registry:home:heriot::0", entryId: "home:heriot", boundId: "", offeredTick: 0, deadline: SEASON, status: "offered",
    receipt: { draw: 0, chancePermille: 1000, conditions: [] } };
  for (const occurrence of [home, { ...home, source: "v4" as const }]) {
    const state: GameState = { ...lord, registry: { ...registry, occurrences: [occurrence] } };
    assert.deepEqual(openRegistryCards(state), []);
    assert.ok(!lordBeats(state).some(beat => beat.kind === "registry_event"));
  }
});

test("the offer comes as a story beat whose [결정하기] opens the card, with the picture on its chip", () => {
  const { state, occurrence } = offered(town, "ck_evt_005");
  const beat = lordBeats(state).find(item => item.kind === "registry_event")!;
  assert.equal(beat.id, `registry:${occurrence.id}`);
  assert.equal(beat.decision, "registry_offer");
  assert.equal(decisionModal("registry_offer"), "registry_offer");
  assert.equal(beat.illustration, "ck_evt_005");
  assert.equal(beat.title, V4_COPY.ck_evt_005!.title);
  assert.match(String(storyArtStyle("ck_evt_005", 64).backgroundImage), /assets\/event-art\/ck_evt_005\.jpg/);
});

test("the card renders the picture whole, equal answers all secondary, a hold with its cost, a shut one disabled; no picture without one", () => {
  const fishery = registryOfferView(offered(lord, "ck_evt_010").state)!;
  const html = renderToStaticMarkup(createElement(RegistryOfferModal, { view: fishery, onAnswer: () => undefined, onLater: () => undefined }));
  assert.match(html, /data-registry-offer="ck_evt_010"/);
  // DEC-CARD: the heavy card's head holds the picture (contain), beside the canon's words.
  assert.match(html, /class="decision-card-art"[^>]*background-image:url\(&quot;[^"]*ck_evt_010[^>]*background-size:contain/);
  assert.equal((html.match(/class="decision-card-choose ui-btn ui-btn--secondary/g) ?? []).length, 3);
  assert.ok(!html.includes("ui-btn--primary"), "one primary per screen at most; equal answers are secondary (LR1-D2)");
  assert.match(html, /data-choice="c" data-refused="true"/);
  assert.match(html, /data-choose="c" disabled=""/);
  // The hold's cost as the engine's run shows it: the claim weakened (ER-19), in the hold's own block.
  const hold = fishery.card.choices.find(choice => choice.id === "b")!;
  assert.ok(hold.now.some(line => /청구가 힘 \d+에서 \d+(으)?로 약해집니다/.test(line)), hold.now.join(" / "));
  assert.ok(fishery.card.choices.find(choice => choice.id === "a")!.now.includes("금고에서 5s이 나갑니다."), "the 60d filing fee");
  assert.match(html, new RegExp(REGISTRY_CARD_COPY.whyHeading));
  const bare = { ...fishery, card: { ...fishery.card, illustration: null } };
  assert.ok(!renderToStaticMarkup(createElement(RegistryOfferModal, { view: bare, onAnswer: () => undefined, onLater: () => undefined })).includes("decision-card-art"));
});

test("DEC-CARD: the offer's card says what is happening, what is at stake, until when, and each answer's now / later / who remembers — the engine's own", () => {
  for (const [base, id] of [[town, "ck_evt_005"], [lord, "ck_evt_010"]] as const) {
    const { state, occurrence } = offered(base, id);
    const view = registryOfferView(state)!;
    const card = view.card;
    assert.equal(card.subjectId, occurrence.id);
    assert.equal(card.situation, V4_COPY[id]!.body);
    assert.ok(card.stake.length > 0 && card.deadline !== null && card.illustration === view.art, id);
    assert.deepEqual(card.choices.map(choice => choice.id), view.choices.map(choice => choice.id));
    for (const choice of card.choices) {
      const shown = view.choices.find(entry => entry.id === choice.id)!;
      if (!shown.enabled) { assert.equal(choice.refusal, shown.line, `${id} ${choice.id}: shut with why`); continue; }
      const after = afterAnswer(state, { type: "answer_registry_offer", occurrenceId: occurrence.id, choiceId: choice.id });
      assert.ok(after !== null, `${id} ${choice.id}: the engine takes it`);
      const outcome = lordOutcome(state, after);
      assert.equal(choice.now[0], shown.line, "the canon's tradeoff first");
      assert.deepEqual(choice.now.slice(1), outcome.now, `${id} ${choice.id}: the run's own lines`);
      assert.deepEqual(choice.remembers, outcome.remembers);
      assert.ok(choice.remembers.every(entry => entry.who !== "" && entry.delta !== 0));
    }
  }
  // ck_evt_005's hold costs the merchants' relation: the run's faction record says so in "who remembers".
  const dues = registryOfferView(offered(town, "ck_evt_005").state)!;
  const holdId = dues.choices.find(choice => choice.hold)!.id;
  assert.deepEqual(dues.card.choices.find(choice => choice.id === holdId)!.remembers.map(entry => [entry.who, entry.delta]), [[merchants(town), HOLD_RELATION_DELTA]]);
  const html = renderToStaticMarkup(createElement(RegistryOfferModal, { view: dues, onAnswer: () => undefined, onLater: () => undefined }));
  for (const part of ["무슨 일인가", "걸린 것", "지금", "나중에", "기억하는 이"]) assert.ok(html.includes(part), part);
  assert.doesNotMatch(html, /ui-btn--primary/);
  assert.doesNotMatch(html, /\stitle="/);
});

test("the picture by the v4 id; none for an id the build does not ship", () => {
  assert.equal(eventArtFor("ck_evt_005"), "ck_evt_005");
  assert.equal(eventArtFor("ck_evt_180"), "ck_evt_180");
  assert.equal(eventArtFor("test:none"), null);
  assert.equal(eventArtFor("ck_evt_001"), null, "a variant of an existing occurrence's words: never an offer, its picture not shipped");
  // RECOVER-1 (engine, render file updated as an exception — render takes it over): v4.1 fixed 011's derived name, so it runs.
  assert.equal(eventArtFor("ck_evt_011"), "ck_evt_011", "v4.1 unblocked it: the registry runs it and its picture ships");
  assert.ok(v4Entries().every(entry => !("artId" in entry)), "no v4 entry carries an artId: the picture is its id's");
});

test("the shipped pictures follow the registry alone: every v4 entry it runs, no variant, no blocked entry, no home petition", () => {
  assert.deepEqual(eventCardEntryIds(), runs);
  const live = runs.filter(id => Object.hasOwn(EVENT_ART_IMAGES, id)).sort();
  assert.deepEqual(shippedEventArtIds(EVENT_ART_IMAGES), live);
  assert.equal(live.length, 71);
  assert.ok(v4Entries().filter(entry => entry.contentClass !== "new_event_draft").every(entry => !live.includes(entry.id)));
  // An entry the registry turns on later ships its picture by the same rule; an id without a picture is left out.
  assert.deepEqual(shippedEventArtIds(EVENT_ART_IMAGES, ["ck_evt_150", "ck_evt_011", "home:heriot", "ck_evt_150"]), ["ck_evt_011", "ck_evt_150"]);
});

test("the build ships exactly those pictures, each re-encoded smaller and under the per-picture cap, deterministic, all in their own on-demand category", () => {
  const shipped = shippedEventArtIds(EVENT_ART_IMAGES);
  assert.deepEqual(EVENT_ART_DERIVATIVES.map(item => item.url), shipped.map(id => `assets/event-art/${id}.jpg`));
  const provenance = readFileSync("docs/provenance/assets.csv", "utf8");
  // A cap per picture, not a total: the set grows with every event the engine turns on (EVA-AUTO principle; engine B's
  // 108 events ship 93 pictures). Each is a 960 × 540 baseline JPEG; the largest of all 200 is 172,986 bytes at q70.
  const PER_PICTURE_BYTES = 256 * 1024;
  for (const [index, item] of EVENT_ART_DERIVATIVES.entries()) {
    assert.equal(KEYART_DERIVATIVE_BY_URL.get(item.url), item);
    assert.equal(item.format, "jpeg-reencoded");
    const source = readFileSync(item.source);
    const bytes = buildKeyartDerivative(item);
    // The same bytes every build (the cache only stores them): decode + encode again, without the cache, is identical (three of them).
    if (index % 30 === 0) assert.equal(sha256(encodeJpeg(decodeJpeg(source), JPEG_QUALITY)), sha256(bytes), `${item.id} deterministic`);
    // Pinned: the provenance row names the runtime file's size and SHA (scripts/installEventArt.ts writes them).
    assert.ok(provenance.includes(`jpeg-reencoded: ${bytes.length} bytes, sha256 ${sha256(bytes)}`), `${item.id}: provenance pins the derivative`);
    const sof = bytes.indexOf(Buffer.from([0xff, 0xc0]));
    assert.deepEqual([bytes[0], bytes[1], bytes.readUInt16BE(sof + 7), bytes.readUInt16BE(sof + 5)], [0xff, 0xd8, 960, 540], `${item.id}: baseline 960 × 540`);
    assert.ok(bytes.length < source.length, `${item.id}: ${bytes.length} < ${source.length}`);
    assert.ok(bytes.length <= PER_PICTURE_BYTES, `${item.id}: ${bytes.length} bytes over the ${PER_PICTURE_BYTES} per-picture cap`);
  }
  // distBudget: their own measured category, on demand, out of the first load's total — every shipped picture.
  const config = loadBudgetConfig();
  const onDemand = new Set(config.categories.filter(entry => (entry as { onDemand?: boolean }).onDemand === true).map(entry => entry.id));
  for (const item of EVENT_ART_DERIVATIVES) {
    assert.equal(categorize(item.url, config)?.category, "event_cards", item.url);
    assert.ok(onDemand.has(categorize(item.url, config)!.category), `${item.url}: not in the first load`);
  }
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

test("all 200 are in the manifest from their confirmed ledger rows; only the shipped are runtime assets with provenance; installed_by only on those", () => {
  const ids = Object.keys(EVENT_ART_IMAGES);
  assert.equal(ids.length, 200);
  const inbox = readFileSync("assets-inbox/INBOX_LEDGER.csv", "utf8").split("\r\n");
  const shipped = shippedEventArtIds(EVENT_ART_IMAGES);
  const runtime = new Set(enumerateRuntimeAssets().map(asset => asset.runtimePath));
  const provenance = readFileSync("docs/provenance/assets.csv", "utf8");
  for (const [id, image] of Object.entries(EVENT_ART_IMAGES)) {
    assert.equal(image.width, 960); assert.equal(image.height, 540);
    assert.ok(existsSync(image.source), image.source);
    const row = inbox.find(line => line.split(",")[1] === image.source.slice("assets-inbox/".length));
    assert.ok(row !== undefined, `${id}: no ledger row`);
    assert.equal(row.split(",")[2], sha256(readFileSync(image.source)), `${id}: the ledger's SHA`);
    assert.match(row, /,confirmed,,/, `${id}: confirmed, not replaced`);
    // EVENT-ART's mark only on a shipped picture (set after its capture through the card); ck_evt_012 is LM-R1's Wave 44 file.
    if (row.endsWith(",EVENT-ART")) assert.ok(shipped.includes(id), `${id}: marked installed but not shipped`);
    if (id !== "ck_evt_012") assert.equal(runtime.has(image.source), shipped.includes(id), `${id} runtime`);
    assert.equal(provenance.includes(`\nevent-art/${id},`), shipped.includes(id), `${id} provenance row`);
    assert.equal(existsSync(`docs/provenance/prompts/${id}-event-art.txt`), shipped.includes(id), `${id} prompt file`);
  }
});
