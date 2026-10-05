import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { categorize, decodedImageMemory, evaluateBudget, formatBudgetTable, globToRegExp, imageSize, loadBudgetConfig, type BudgetConfig } from "../scripts/checks/distBudget.mjs";

const config = loadBudgetConfig();
const MB = config.megabyte;

test("globs: ** spans folders, * stays in one segment, {a,b} alternates", () => {
  assert.ok(globToRegExp("assets/wave8/keyart/**").test("assets/wave8/keyart/keyart_title_bg.jpg"));
  assert.ok(globToRegExp("**/*.json").test("assets/world_asset_manifest.json"));
  assert.ok(globToRegExp("**/*.json").test("top.json"));
  assert.ok(!globToRegExp("assets/*.js").test("assets/sub/index.js"));
  assert.ok(globToRegExp("assets/wave23/{pad,royal}/**").test("assets/wave23/royal/arms_royal_england_1340_96.png"));
  assert.ok(!globToRegExp("assets/wave23/{pad,royal}/**").test("assets/wave23/weather/rain.png"));
  assert.ok(!globToRegExp("index.html").test("indexXhtml"));
});

test("the repository's rules sort real dist paths into the seven categories", () => {
  const expected: Record<string, string> = {
    "index.html": "code",
    "assets/index-CdarSZwi.js": "code",
    "assets/index-BHFreUTf.css": "code",
    "assets/world_asset_manifest.json": "code",
    "licenses/fonts/OFL-NotoSansKR.txt": "code",
    "audio/church_bell.mp3": "sound",
    "assets/portraits/256/P01.jpg": "portraits",
    "assets/portraits/96/P01.jpg": "portraits",
    "assets/ui-p0/advisor_steward_portrait_neutral.png": "portraits",
    "assets/ui-p0/portraits/advisor_steward_portrait_concern-96.png": "portraits",
    "assets/ui-p0/advisor_portrait_frame.png": "ui",
    "assets/wave8/keyart/loading_1348_plague.jpg": "keyart",
    "assets/wave16/chapters/chapter1_end.jpg": "illustrations",
    "assets/wave17/chapter2_end.jpg": "illustrations",
    "assets/wave17/event/raid.jpg": "illustrations",
    "assets/wave19/scenes_people/scene_bread_reserve.png": "illustrations",
    "assets/wave19/pages/frame_faction_page.png": "ui",
    "assets/wave14/heraldry/field_or.png": "ui",
    "assets/wave23/person_state/sick_48.png": "ui",
    "assets/noto-sans-kr-0-400-normal-CVyYOjaz.woff2": "ui",
    "assets/wave17/world/beacon_lit-v1.png": "world",
    "assets/wave23/weather/rain_sheet.png": "world",
    "assets/buildings/historical-gate/gate.png": "world",
    "assets/walkers-v2/walker.png": "world",
  };
  for (const [path, category] of Object.entries(expected)) assert.equal(categorize(path, config)?.category, category, path);
  assert.equal(categorize("assets/wave99/new/thing.png", config), null);
});

test("a fake file list under budget passes; unmatched files go to 기타 and are listed", () => {
  const result = evaluateBudget([
    { path: "assets/portraits/256/P01.jpg", bytes: 10 * MB },
    { path: "assets/wave16/events/event_fire.jpg", bytes: 5 * MB },
    { path: "assets/wave99/new/thing.png", bytes: 1234 },
    { path: "index.html", bytes: 600 },
  ], config);
  assert.equal(result.pass, true);
  assert.deepEqual(result.over, []);
  const portraits = result.categories.find(category => category.id === "portraits")!;
  assert.equal(portraits.bytes, 10 * MB);
  assert.equal(portraits.budgetBytes, 20 * MB);
  assert.equal(result.categories.find(category => category.id === "other")!.bytes, 1234);
  assert.deepEqual(result.unmatched.map(file => file.path), ["assets/wave99/new/thing.png"]);
  assert.equal(result.total.bytes, 15 * MB + 1834);
  assert.match(formatBudgetTable(result), /wave99\/new\/thing\.png/);
});

test("a budgeted category over its budget fails, at the byte", () => {
  const exact = evaluateBudget([{ path: "assets/portraits/256/P01.jpg", bytes: 20 * MB }], config);
  assert.equal(exact.pass, true);
  const over = evaluateBudget([{ path: "assets/portraits/256/P01.jpg", bytes: 20 * MB + 1 }], config);
  assert.equal(over.pass, false);
  assert.deepEqual(over.over, ["portraits"]);
  assert.match(formatBudgetTable(over), /OVER/);
  const illustrations = evaluateBudget([{ path: "assets/wave17/decision/a.jpg", bytes: 26 * MB }], config);
  assert.deepEqual(illustrations.over, ["illustrations"]);
});

test("the total over 150 MB fails even when every category is under", () => {
  const result = evaluateBudget([
    { path: "assets/walkers-v2/a.png", bytes: 100 * MB },
    { path: "assets/ui-p0/b.png", bytes: 50 * MB + 1 },
  ], config);
  assert.equal(result.pass, false);
  assert.deepEqual(result.over, ["total"]);
});

test("an unbudgeted category never fails by itself; a rule naming an unknown category throws", () => {
  const small: BudgetConfig = { ...config, totalBudgetMB: null };
  assert.equal(evaluateBudget([{ path: "assets/walkers-v2/a.png", bytes: 500 * MB }], small).pass, true);
  const broken: BudgetConfig = { ...config, rules: [{ category: "nope", label: "typo", patterns: ["**"] }] };
  assert.throws(() => evaluateBudget([{ path: "x.png", bytes: 1 }], broken), /unknown category "nope"/);
});

// BUDGET-1b: the startup image memory reads each file's size from its header (width × height × 4 decoded).
const png = (width: number, height: number) => {
  const bytes = Buffer.alloc(33);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(bytes, 0);
  bytes.writeUInt32BE(13, 8); bytes.write("IHDR", 12, "latin1"); bytes.writeUInt32BE(width, 16); bytes.writeUInt32BE(height, 20);
  return bytes;
};
// SOI, an APP0 segment, a DHT (C4: no frame size), then SOF2 (progressive) with height 96 and width 256.
const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, 0xff, 0xc4, 0x00, 0x03, 0x00,
  0xff, 0xc2, 0x00, 0x0b, 0x08, 0x00, 0x60, 0x01, 0x00, 0x01, 0x01, 0x11, 0x00, 0xff, 0xd9]);

test("image sizes from PNG and JPEG headers; anything else is null", () => {
  assert.deepEqual(imageSize(png(1254, 627)), { width: 1254, height: 627 });
  assert.deepEqual(imageSize(jpeg), { width: 256, height: 96 });
  assert.equal(imageSize(Buffer.from("GIF89a....")), null);
});

test("decoded memory sums w × h × 4 by category and lists files it cannot read", () => {
  const dir = mkdtempSync(join(tmpdir(), "fls-image-memory-"));
  try {
    writeFileSync(join(dir, "a.png"), png(100, 50));
    writeFileSync(join(dir, "b.jpg"), jpeg);
    const memory = decodedImageMemory(["a.png", "b.jpg", "gone.png"], dir, {
      ...config, rules: [{ category: "world", label: "a", patterns: ["a.png"] }, { category: "ui", label: "b", patterns: ["b.jpg"] }] });
    assert.equal(memory.images, 2);
    assert.equal(memory.bytes, 100 * 50 * 4 + 256 * 96 * 4);
    assert.deepEqual(memory.byCategory, [{ category: "ui", images: 1, bytes: 256 * 96 * 4 }, { category: "world", images: 1, bytes: 100 * 50 * 4 }]);
    assert.deepEqual(memory.missing, ["gone.png"]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("EVENT-ART: an on-demand category (the event pictures, loaded when their card opens) is measured but out of the first load's total", () => {
  assert.equal(categorize("assets/event-art/ck_evt_005.jpg", config)?.category, "event_cards");
  const result = evaluateBudget([{ path: "assets/event-art/ck_evt_005.jpg", bytes: 200 * MB }, { path: "assets/wave16/events/event_fire.jpg", bytes: 5 * MB }], config);
  const cards = result.categories.find(category => category.id === "event_cards")!;
  assert.deepEqual([cards.bytes, cards.budgetBytes, cards.pass], [200 * MB, null, true]);
  assert.deepEqual([result.total.bytes, result.total.files, result.onDemand.bytes, result.onDemand.files], [5 * MB, 1, 200 * MB, 1]);
  assert.equal(result.pass, true, "200 MB on demand does not fail the 150 MB first load");
  assert.match(formatBudgetTable(result), /전체 = first load; on demand, not in it: 1 files 200\.00 MB/);
});
