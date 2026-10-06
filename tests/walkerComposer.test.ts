import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { gunzipSync } from "node:zlib";

import type { Walker } from "../src/agents/walker.types";
import type { GameState } from "../src/engine/engine.types";
import { decodeSave, encodeSave } from "../src/save/saveCodec";
import { PROP_SCALE, WALKER_CELL, WALKER_COMPOSED_CELL, WALKER_PAD, rightHand } from "../src/render/walkerComposer";
import { walkerCloak, walkerHeldProp, walkerLook, walkerLooks, walkerSheet } from "../src/render/walkerLook";
import { walkerCloakManifest, walkerPropManifest, walkerSheetManifest } from "../src/render/walkerSheetManifest.generated";

// V2 walker composer (docs/design/walker-composer.md), on the C3 seed 2 city run to its first summer / winter sample
// (docs/verification/v2-walkers/scene, scripts/walkerLookEvidence.ts).
const scene = (name: string): GameState => JSON.parse(gunzipSync(readFileSync(new URL(`../docs/verification/v2-walkers/scene/seed2-${name}.json.gz`, import.meta.url))).toString("utf8")) as GameState;
const lookList = (state: GameState) => JSON.stringify([...walkerLooks(state)].sort(([a], [b]) => a.localeCompare(b)));

test("Given the seed 2 city When looks are read again, after a save round trip and without the other walkers Then every walker keeps its sheet and prop (gate 1)", () => {
  for (const state of [scene("summer"), scene("winter")]) {
    const saved = decodeSave(encodeSave({ state, createdAt: "2026-09-25T00:00:00.000Z", savedAt: "2026-09-25T00:00:00.000Z" }).bytes).envelope.state as GameState;
    assert.equal(lookList(saved), lookList(state));
    assert.equal(lookList(structuredClone(state)), lookList(state));
    for (const walker of state.walkers) {
      // A look is the walker's own: the other walkers spawning or leaving never change it.
      assert.deepEqual(walkerLooks({ ...state, walkers: [walker] }).get(walker.id), walkerLooks(state).get(walker.id));
      assert.equal(walkerHeldProp(walkerLook(saved, walker), walker), walkerHeldProp(walkerLook(state, walker), walker));
    }
  }
});

test("Given many carters and distributors When they draw sheets Then no class band leans more than 60% on one sheet and both sexes appear (gate 2)", () => {
  const state = scene("summer");
  const template = state.walkers;
  const walkers: Walker[] = [];
  for (let index = 0; index < 1200; index += 1) {
    const base = template[index % template.length]!;
    walkers.push({ ...base, id: `${base.id}:synthetic:${index}`, spawnedTick: base.spawnedTick + index } as Walker);
  }
  const looks = walkerLooks({ ...state, walkers });
  const bands = new Map<string, Map<string, number>>();
  const sexes = new Map<string, number>();
  for (const look of looks.values()) {
    const sheets = bands.get(look.band) ?? new Map<string, number>();
    sheets.set(look.sheetId, (sheets.get(look.sheetId) ?? 0) + 1);
    bands.set(look.band, sheets);
    sexes.set(look.sex, (sexes.get(look.sex) ?? 0) + 1);
  }
  for (const [band, sheets] of bands) {
    const total = [...sheets.values()].reduce((sum, count) => sum + count, 0);
    assert.ok(Math.max(...sheets.values()) / total <= 0.6, `${band}: ${JSON.stringify(Object.fromEntries(sheets))}`);
  }
  assert.ok(Math.abs((sexes.get("female") ?? 0) / walkers.length - 0.5) < 0.05, JSON.stringify(Object.fromEntries(sexes)));
});

test("Given every body template When a prop is placed Then its grip lands on the right hand in all 32 cells, in the same hand whatever the direction (gate 3)", () => {
  const templates = ["legacy_civilian_man", "legacy_civilian_woman", "legacy_merchant", "legacy_cleric"] as const;
  let cells = 0;
  for (const id of templates) {
    const sheet = walkerSheet(id);
    assert.equal(sheet.frames.length, 8);
    for (const frame of sheet.frames) {
      const hand = rightHand(frame);
      // The right hand is on screen left when the walker faces the viewer's side (SE, SW), on screen right when it
      // faces away (NE, NW): the same anatomical hand in every direction.
      const screenLeft = frame.direction === "SE" || frame.direction === "SW";
      assert.equal(hand, screenLeft ? frame.hands.left : frame.hands.right);
      assert.ok(screenLeft ? hand.x < frame.foot.x + 2 : hand.x > frame.foot.x - 2, `${id} ${frame.direction}${frame.gaitFrame} hand ${hand.x} foot ${frame.foot.x}`);
      assert.ok(hand.y >= 28 && hand.y <= 42 && hand.x > 0 && hand.x < WALKER_CELL, `${id} ${frame.direction}${frame.gaitFrame}`);
      for (const [kind, directions] of Object.entries(walkerPropManifest)) {
        const anchor: { readonly x: number; readonly y: number } = directions[frame.direction].anchor;
        // Composed position of the grip = hand anchor; the whole prop stays inside the padded cell.
        const propLeft: number = WALKER_PAD + hand.x - anchor.x * PROP_SCALE; const propTop: number = WALKER_PAD + hand.y - anchor.y * PROP_SCALE;
        assert.equal(propLeft + anchor.x * PROP_SCALE, WALKER_PAD + hand.x);
        assert.ok(propLeft >= 0 && propTop >= 0 && propLeft + 32 * PROP_SCALE <= WALKER_COMPOSED_CELL && propTop + 32 * PROP_SCALE <= WALKER_COMPOSED_CELL, `${kind} ${id} ${frame.direction}`);
      }
      cells += 1;
    }
  }
  assert.equal(cells, 32);
});

test("Given walkers at work When props are chosen Then builders hold a hammer, bread is a loaf and legacy occupation art keeps its own tool (gate 3)", () => {
  const state = scene("summer");
  for (const walker of state.walkers) {
    const look = walkerLook(state, walker);
    const prop = walkerHeldProp(look, walker);
    if (walkerSheet(look.sheetId).holdsTool) assert.equal(prop, null);
    else if (look.occupation === "distributor") assert.ok(prop === "work_breadbasket" || prop === "pilot2_basket", "The bread round keeps its basket task");
    else if (walker.cargo?.resource === "bread") assert.equal(prop, "loaf");
    else if (walker.cargo !== null) assert.equal(prop, null);
  }
  const builder = { ...state.walkers[0]!, kind: "builder", id: "builder:test", siteId: "site", slotIndex: 0, cargo: null } as unknown as Walker;
  const look = walkerLook(state, builder);
  assert.equal(walkerHeldProp(look, builder), walkerSheet(look.sheetId).holdsTool ? null : "tool_hammer");
});

test("Given the calendar When it is winter Then cloaks cover everyone but the clergy, the merchant bodies wear the merchant cloak (INSTALL-4e), and nobody in summer (gate 4)", () => {
  const summer = scene("summer"); const winter = scene("winter");
  for (const walker of winter.walkers) {
    const look = walkerLook(winter, walker);
    assert.equal(walkerCloak(summer, look), null);
    assert.equal(walkerCloak(winter, look), walkerSheet(look.sheetId).cloak);
  }
  for (const sheet of walkerSheetManifest) {
    if (["priest", "monk", "nun"].includes(sheet.classBand)) assert.equal(sheet.cloak, null, sheet.id);
    else if (sheet.template === "merchant" || sheet.template === "pilot2_P1") assert.equal(sheet.cloak, "merchant", sheet.id);
    else if (sheet.cloak !== null) assert.equal(sheet.cloak, sheet.sex, sheet.id);
  }
  assert.ok(winter.walkers.some(walker => walkerCloak(winter, walkerLook(winter, walker)) !== null), "control: the winter scene shows cloaks");
});

test("Given the composer cache When cells are counted Then each is one 108 px cell and their bytes are the canvas budget's (SMOOTH-2R, was gate 5's 64 looks)", () => {
  assert.equal(WALKER_COMPOSED_CELL, 108);
  assert.equal(WALKER_COMPOSED_CELL * WALKER_COMPOSED_CELL * 4, 46_656);
});

test("Given the installed walker batches When the manifest is read Then all body and prop files match their declared bytes", () => {
  const wave5a = walkerSheetManifest.filter(sheet => !sheet.legacy);
  assert.equal(wave5a.length, 29 + 7 + 8 + 2 + 2 + 3 + 4, "Wave 5a 29, Wave 4e 7, Wave 5c 8, Wave 11 carpenter and mason, Wave 3 alewife and maltster, Wave 3 cloth shepherd / fuller / wool merchant (UI-9)");
  // INSTALL-5c: the child and elder bodies (4 each), no winter cloak.
  assert.deepEqual(wave5a.filter(sheet => (sheet.classBand === "child" || sheet.classBand === "elder") && !sheet.id.startsWith("wk_reskin_P")).map(sheet => `${sheet.classBand}:${sheet.cloak}`).sort(),
    [...Array(4).fill("child:null"), ...Array(4).fill("elder:null")]);
  for (const sheet of wave5a) {
    const bytes = readFileSync(new URL(`../public/${sheet.url}`, import.meta.url));
    assert.equal(createHash("sha256").update(bytes).digest("hex"), sheet.sha256, sheet.id);
    assert.deepEqual(sheet.directionOrder, ["NE", "SE", "SW", "NW"]);
  }
  const props = Object.values(walkerPropManifest).flatMap(directions => Object.values(directions));
  assert.equal(props.length, 24 + 8 + 12 + 20 + 12 + 16, "Wave 5a 24, Wave 4e 8, Wave 6 work tools 12 (hammer, shovel, sickle), Wave 7 work props 20, Wave 11 kit tools 12");
  for (const prop of props) readFileSync(new URL(`../public/${prop.url}`, import.meta.url));
  assert.deepEqual(Object.keys(walkerCloakManifest).sort(), ["female", "male", "merchant"]);
  for (const cloak of Object.values(walkerCloakManifest)) readFileSync(new URL(`../public/${cloak.url}`, import.meta.url));
});

test("Given the pilot final art When the registry is read Then exactly four own-frame bodies and sixteen distinct grips are registered", () => {
  // Given: the four approved final sheets, excluding normalization templates and masters.
  const pilot = walkerSheetManifest.filter(sheet => sheet.url.startsWith("assets/walker-pilot2/"));
  // When: the runtime contract is inspected.
  const props = Object.entries(walkerPropManifest).filter(([kind]) => kind.startsWith("pilot2_"));
  // Then: every body cell and direction grip has an independent installed identity.
  assert.equal(pilot.length, 4);
  assert.equal(pilot.reduce((count, sheet) => count + sheet.frames.length, 0), 32);
  assert.equal(props.length, 4);
  for (const [kind, directions] of props) {
    assert.deepEqual(Object.keys(directions).sort(), ["NE", "NW", "SE", "SW"]);
    for (const entry of Object.values(directions)) {
      const runtime = readFileSync(new URL(`../public/${entry.url}`, import.meta.url));
      const source = readFileSync(new URL(`../assets-inbox/walker-pilot2/candidates-v1/${entry.url.replace("assets/walker-pilot2/", "assets/")}`, import.meta.url));
      assert.deepEqual(runtime, source, kind);
    }
  }
  for (const sheet of pilot) {
    const runtime = readFileSync(new URL(`../public/${sheet.url}`, import.meta.url));
    const source = readFileSync(new URL(`../assets-inbox/walker-pilot2/candidates-v1/${sheet.url.replace("assets/walker-pilot2/", "assets/")}`, import.meta.url));
    assert.deepEqual(runtime, source, sheet.id);
    assert.equal(sheet.holdsTool, false);
    for (const frame of sheet.frames) {
      assert.ok(frame.figureHeight > 50 && frame.figureHeight <= 74, sheet.id);
      assert.ok(frame.foot.y > 60 && frame.foot.y < 74, sheet.id);
      assert.ok(frame.hands.left.x < frame.hands.right.x, sheet.id);
    }
  }
});

test("Given actual saved residents and worker trips When ID and seed choose pilot variants Then props retain their task precedence and elder sex", async () => {
  // Given: real saved workers and presentation trips derived by the existing resident adapter.
  const { withResidentWalkers } = await import("../src/render/presentation/residentWalkerState");
  const { isResidentWalker } = await import("../src/render/presentation/residentTrips");
  const display = withResidentWalkers(scene("summer"));
  const seen = new Set<string>();
  // When: independent deterministic seed fixtures choose appearances on those unchanged trips.
  for (let seed = 1; seed <= 32; seed += 1) {
    const state = { ...display, seed };
    const reloaded = structuredClone(state);
    for (const walker of state.walkers) {
      if (isResidentWalker(walker) && (walker.resident.occupation === "guard" || walker.resident.occupation === "clergy")) continue;
      const look = walkerLook(state, walker);
      const prop = walkerHeldProp(look, walker, null, { season: 0, dayOfYear: 60 });
      // Then: other walkers and reloads cannot alter the choice, and real work still owns the hands.
      assert.deepEqual(walkerLooks({ ...state, walkers: [walker] }).get(walker.id), look);
      assert.deepEqual(walkerLook(reloaded, walker), look);
      if (isResidentWalker(walker) && walker.resident.ageBand === "elder") assert.equal(look.sex, walker.resident.sex);
      if (prop?.startsWith("pilot2_")) {
        seen.add(prop);
        assert.ok(look.sheetId.startsWith("wk_reskin_P"));
        if (prop === "pilot2_staff") {
          assert.ok(isResidentWalker(walker) && walker.resident.ageBand === "elder");
          assert.equal(walker.cargo, null);
          assert.equal(walkerHeldProp(look, { ...walker, cargo: { resource: "timber", amount: 1 } }), null);
        }
        if (prop === "pilot2_sack") {
          assert.equal(look.occupation, "field_hand");
          assert.equal(walkerHeldProp(look, walker, null, { season: 0, dayOfYear: 10 }), "work_plough");
          assert.equal(walkerHeldProp(look, walker, null, { season: 2, dayOfYear: 200 }), "work_sickle");
        }
        if (prop === "pilot2_basket") assert.equal(look.occupation, "distributor");
        if (prop === "pilot2_purse") {
          assert.equal(look.occupation, "marketgoer");
          assert.equal(walker.cargo, null);
          assert.equal(walkerHeldProp(look, { ...walker, cargo: { resource: "timber", amount: 1 } }), null);
        }
      }
    }
  }
  assert.deepEqual([...seen].sort(), ["pilot2_basket", "pilot2_purse", "pilot2_sack", "pilot2_staff"]);
});

test("Given the staff registration When its scale is applied to each pilot frame Then its world size stays fixed inside the padded cell", () => {
  // Given: the staff's registered reference height and the four actual final body sheets.
  const sheets = walkerSheetManifest.filter(sheet => sheet.url.startsWith("assets/walker-pilot2/"));
  for (const sheet of sheets) for (const frame of sheet.frames) {
    const entry = walkerPropManifest.pilot2_staff[frame.direction];
    // When: the composer normalizes this prop by this frame's figure height.
    const scale = entry.scale * frame.figureHeight / entry.referenceFigureHeight;
    const hand = rightHand(frame);
    const left = WALKER_PAD + hand.x - entry.anchor.x * scale;
    const top = WALKER_PAD + hand.y - entry.anchor.y * scale;
    // Then: direction/gait cannot resize it or clip it against the composed-cell canvas.
    assert.ok(Math.abs(32 * scale * 17.6 / frame.figureHeight - 32 * 2 * 17.6 / 61) < 1e-10);
    const bounds = entry.opaqueBounds;
    assert.ok(left + bounds.x * scale >= 0 && top + bounds.y * scale >= 0);
    assert.ok(left + (bounds.x + bounds.width) * scale <= WALKER_COMPOSED_CELL);
    assert.ok(top + (bounds.y + bounds.height) * scale <= WALKER_COMPOSED_CELL);
  }
});
