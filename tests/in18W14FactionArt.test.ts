import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FACTION_KINDS } from "../src/content/factionConfig";
import { ART_REGISTRY } from "../src/render/art/wave42Registry";
import { FACTION_ART_PARTS, FACTION_KIND_ICON, FACTION_PANEL_FRAME, factionKindIcon } from "../src/ui/chronicle/factionArt";
import { FactionTab } from "../src/ui/chronicle/FactionTab";
import { createUiPartArt } from "../src/ui/lord/uiPartArt";
import { heraldryArms } from "../src/ui/heraldry/heraldry";

// INSTALL-18 (Wave 14 leftovers): the faction panel and the faction-kind icons through the art contract.

test("INSTALL-18: an icon only for the four kinds whose subject Astra drew; overlord, neighbour and commons keep their look", () => {
  assert.deepEqual(Object.keys(FACTION_KIND_ICON).sort(), ["church", "crown", "merchant_house", "town"]);
  for (const kind of Object.keys(FACTION_KIND_ICON)) assert.ok((FACTION_KINDS as readonly string[]).includes(kind), kind);
  for (const kind of ["overlord", "neighbour", "commons"] as const) assert.equal(FACTION_KIND_ICON[kind], undefined);
  assert.equal(ART_REGISTRY.entry("wave14.faction.lord_household"), null, "the lord's own house is no faction kind: not installed");
});

test("INSTALL-18: the catalog holds the parts at their measured sizes, the panel's slices from its records", () => {
  for (const id of Object.values(FACTION_KIND_ICON)) {
    const entry = ART_REGISTRY.entry(id!);
    assert.equal(entry?.kind, "ui-image", id);
    if (entry?.kind !== "ui-image") continue;
    assert.deepEqual([entry.image.width, entry.image.height, entry.cssWidths], [96, 96, [24, 32]], id);
  }
  const panel = ART_REGISTRY.entry(FACTION_PANEL_FRAME);
  assert.equal(panel?.kind, "ui-frame");
  if (panel?.kind !== "ui-frame") return;
  const records = JSON.parse(readFileSync("assets-inbox/wave14/candidates-v1/records/metadata-frames.json", "utf8")) as { id: string; nineSlice: { insetsTopRightBottomLeft: number[] } }[];
  const [top, right, bottom, left] = records.find(record => record.id === "frame_faction_panel")!.nineSlice.insetsTopRightBottomLeft;
  assert.deepEqual(panel.slice, { top, right, bottom, left });
  assert.deepEqual([panel.image.width, panel.image.height, panel.scale], [384, 256, 1], "drawn at its own size, never below native");
  assert.deepEqual(new Set(FACTION_ART_PARTS), new Set([FACTION_PANEL_FRAME, ...Object.values(FACTION_KIND_ICON)]));
});

test("INSTALL-18: no picture, no change — a kind without an icon, an unloaded or failed part give null", async () => {
  const none = createUiPartArt(ART_REGISTRY, { baseUrl: "/", createImage: null });
  await none.settled(FACTION_ART_PARTS);
  assert.equal(factionKindIcon(none, "crown", 24), null, "no image API");
  assert.equal(none.frame(FACTION_PANEL_FRAME), null);
  assert.equal(factionKindIcon(none, "overlord", 24), null);
});

const row = (id: "crown" | "overlord", kindId: "crown" | "overlord") => ({ id, name: id === "crown" ? "국왕과 왕실" : "에스트마치 백작", kind: id === "crown" ? "국왕과 왕실" : "상위 영주", kindId,
  emblem: { kind: "arms" as const, recipe: heraldryArms(1) }, emblemLabel: "문장", leader: null, relation: 0, relationX: 0.5, relationText: "무심 0",
  demands: 0, promises: 0, memory: 0, label: id, influence: null });

test("INSTALL-18: before the art loads the tab keeps its look — the list under a plain heading, no panel art, no icons", () => {
  const markup = renderToStaticMarkup(createElement(FactionTab, { rows: [row("crown", "crown"), row("overlord", "overlord")], world: [], onOpen: () => undefined }));
  assert.match(markup, /class="chronicle-factions-panel"/);
  assert.doesNotMatch(markup, /chronicle-factions-panel--art|chronicle-factions-kind-icon|border-image/);
  assert.match(markup, /<h3 id="chronicle-factions-heading" class="chronicle-factions-heading">주변 세력<\/h3>/);
  const empty = renderToStaticMarkup(createElement(FactionTab, { rows: [], world: [], onOpen: () => undefined }));
  assert.doesNotMatch(empty, /chronicle-factions-panel/, "no factions yet: no panel");
});

test("INSTALL-18: once loaded, the panel draws at its own size and an icon at its CSS width (2x from the 96 px file)", async () => {
  const sizes: Readonly<Record<string, readonly [number, number]>> = { "/assets/wave14/ui-frames/frame_faction_panel-v1.png": [384, 256],
    "/assets/wave14/ui-icons/icon_faction_crown-v1.png": [96, 96] };
  const createImage = () => {
    const element = { naturalWidth: 0, naturalHeight: 0, onload: null as null | (() => void), onerror: null as null | (() => void), decode: () => Promise.resolve(),
      set src(url: string) { const size = sizes[url]; queueMicrotask(() => { if (size === undefined) element.onerror?.(); else { [element.naturalWidth, element.naturalHeight] = size; element.onload?.(); } }); } };
    return element as unknown as HTMLImageElement;
  };
  const art = createUiPartArt(ART_REGISTRY, { baseUrl: "/", createImage });
  await art.settled(FACTION_ART_PARTS); await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(art.frame(FACTION_PANEL_FRAME)?.style.borderImage, 'url("/assets/wave14/ui-frames/frame_faction_panel-v1.png") 60 20 20 20 fill / 60px 20px 20px 20px / 0 stretch');
  assert.deepEqual(factionKindIcon(art, "crown", 24), { width: 24, height: 24, backgroundImage: 'url("/assets/wave14/ui-icons/icon_faction_crown-v1.png")',
    backgroundSize: "100% 100%", backgroundRepeat: "no-repeat" });
  assert.equal(factionKindIcon(art, "church", 24), null, "its file failed: the current look");
});
