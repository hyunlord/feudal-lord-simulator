import assert from "node:assert/strict";
import test from "node:test";
import { categorize, evaluateBudget, formatBudgetTable, globToRegExp, loadBudgetConfig, type BudgetConfig } from "../scripts/checks/distBudget.mjs";

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
