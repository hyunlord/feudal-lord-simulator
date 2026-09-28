import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { isWallConstructionSite, type WallConstructionSite } from "../src/economy/construction";
import { palisadeConstructionSchedule } from "../src/economy/palisadeConstruction";
import type { GameState } from "../src/engine/engine.types";
import { wallSiteLabelAnchor, wallSiteLabelPlan, WALL_SEGMENT_LABEL_MIN_ZOOM } from "../src/render/wallSiteLabels";
import { decodeSave } from "../src/save/saveCodec";
import { currentConstructionSiteLabel } from "../src/ui/constructionAccessModel";
import { WALL_CARRY_COPY, WALL_SITE_LABEL_COPY } from "../src/ui/wallCarryCopy.ko";

// INSTALL-3b ①: one tag per wall works; every segment's own with the works selected or from zoom 1.35.
function segment(index: number, options: { wallId?: string; kind?: WallConstructionSite["kind"]; gateDistance?: number } = {}): WallConstructionSite {
  return {
    id: `${options.kind ?? "palisade_segment"}-${options.wallId ?? "wall-1"}-${index}`, kind: options.kind ?? "palisade_segment",
    wallId: options.wallId ?? "wall-1", segmentIndex: index, gateDistance: options.gateDistance ?? index, order: index,
    path: [{ x: index * 2, y: 0 }, { x: index * 2 + 2, y: 0 }], anchor: { tx: index * 2, ty: 0 },
    required: { timber: 4 }, delivered: {}, reserved: {}, builderTicks: 0, requiredBuilderTicks: 100, assignedBuilders: 0,
    stall: "awaiting_materials", startedTick: 0,
  } as WallConstructionSite;
}
const carried = (site: WallConstructionSite) => WALL_CARRY_COPY.carried(site.segmentIndex + 3);
const everywhere = { visible: () => true, centre: { x: 0, y: 0 }, selectedSiteId: null };

test("a wall works shows one tag, at its segment nearest the gate, naming the segment count and that segment's cause", () => {
  const sites = Array.from({ length: 12 }, (_, index) => segment(index, { gateDistance: (index + 5) % 12 }));
  const plan = wallSiteLabelPlan({ sites, labelOf: carried, zoom: 1, ...everywhere });
  assert.equal(plan.length, 1);
  const nearest = sites.find(site => site.gateDistance === 0)!;
  assert.equal(plan[0]!.siteId, nearest.id);
  assert.equal(plan[0]!.text, WALL_SITE_LABEL_COPY.works(12, carried(nearest)));
  assert.deepEqual(plan[0]!.anchor, wallSiteLabelAnchor(nearest));
});

test("every segment on screen shows its own tag from zoom 1.35 or with the works selected", () => {
  const sites = Array.from({ length: 12 }, (_, index) => segment(index));
  assert.equal(wallSiteLabelPlan({ sites, labelOf: carried, zoom: WALL_SEGMENT_LABEL_MIN_ZOOM, ...everywhere }).length, 12);
  assert.equal(wallSiteLabelPlan({ sites, labelOf: carried, zoom: 1.34, ...everywhere }).length, 1);
  const selected = wallSiteLabelPlan({ sites, labelOf: carried, zoom: 1, ...everywhere, selectedSiteId: sites[7]!.id });
  assert.deepEqual(selected.map(label => label.text), sites.map(carried));
  // Selecting one works leaves another folded.
  const other = Array.from({ length: 5 }, (_, index) => segment(index, { wallId: "wall-2" }));
  assert.equal(wallSiteLabelPlan({ sites: [...sites, ...other], labelOf: carried, zoom: 1, ...everywhere, selectedSiteId: sites[7]!.id }).length, 13);
});

test("each wall and material is its own works; the tag hangs on the nearest segment on screen", () => {
  const palisade = Array.from({ length: 6 }, (_, index) => segment(index));
  const stone = Array.from({ length: 6 }, (_, index) => segment(index, { kind: "stone_wall_segment" }));
  assert.equal(wallSiteLabelPlan({ sites: [...palisade, ...stone], labelOf: carried, zoom: 1, ...everywhere }).length, 2);
  // The two segments nearest the gate are off screen: the tag moves to the next one, the cause stays the gate's.
  const offScreen = new Set([palisade[0]!.id, palisade[1]!.id].map(id => JSON.stringify(wallSiteLabelAnchor(palisade.find(site => site.id === id)!))));
  const plan = wallSiteLabelPlan({ sites: palisade, labelOf: carried, zoom: 1, ...everywhere, visible: point => !offScreen.has(JSON.stringify(point)) });
  assert.equal(plan[0]!.siteId, palisade[2]!.id);
  assert.equal(plan[0]!.text, WALL_SITE_LABEL_COPY.works(6, carried(palisade[0]!)));
  // No segment on screen, or no segment with a tag: no tag.
  assert.equal(wallSiteLabelPlan({ sites: palisade, labelOf: carried, zoom: 1, ...everywhere, visible: () => false }).length, 0);
  assert.equal(wallSiteLabelPlan({ sites: palisade, labelOf: () => "", zoom: 1, ...everywhere }).length, 0);
});

test("the chapter 2 town under wall construction: dozens of segment tags fold to one per works", () => {
  const state = decodeSave(new Uint8Array(readFileSync("fixtures/saves/v24/palisade-construction.save.json"))).envelope.state as GameState;
  const sites = state.constructionSites.filter(isWallConstructionSite);
  const labelOf = (site: WallConstructionSite) => {
    const schedule = palisadeConstructionSchedule(site, state.constructionSites);
    return schedule.kind === "queued" ? WALL_SITE_LABEL_COPY.queued(schedule.position) : currentConstructionSiteLabel(state, site);
  };
  const before = sites.filter(site => labelOf(site) !== "").length;
  const works = new Set(sites.map(site => `${site.kind}:${site.wallId}`)).size;
  const after = wallSiteLabelPlan({ sites, labelOf, zoom: 1, ...everywhere }).length;
  assert.ok(before >= 20, `segment tags before: ${before}`);
  assert.ok(after <= works && after >= 1, `tags after: ${after} for ${works} works`);
});
