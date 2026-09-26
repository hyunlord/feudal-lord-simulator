import assert from "node:assert/strict";
import { test } from "node:test";

import { createConstructionSite } from "../src/economy/construction";
import { constructionKitFor, kitSiteProps, kitWorker } from "../src/render/constructionKits";
import { constructionSiteLabelAnchor } from "../src/render/constructionSiteLabelLayout";
import { WAVE11_ART } from "../src/render/wave11ArtManifest.generated";

test("INSTALL-11: each building family has its kit, every stage key is installed, kinds without a kit keep the common art", () => {
  const families = { house: "timber", farmstead: "timber", logging_camp: "timber", sawmill: "timber", mill: "timber",
    masonry: "stone", chapel: "stone", storehouse: "stone", granary: "stone", church: "public", keep: "public", stone_wall_segment: "defense" } as const;
  for (const [kind, family] of Object.entries(families)) {
    const kit = constructionKitFor(kind as keyof typeof families);
    assert.equal(kit?.family, family, kind);
    for (const stage of [0, 1, 2, 3]) assert.ok(kit!.key(stage) in WAVE11_ART, `${kind} stage ${stage}: ${kit!.key(stage)}`);
  }
  for (const kind of ["well", "market", "quarry", "wheat_farm", "palisade_segment"] as const) assert.equal(constructionKitFor(kind), null, kind);
});

test("INSTALL-11 gate 4: the plaque anchor does not move when the kit's stage painting changes", () => {
  for (const kind of ["house", "farmstead", "masonry", "storehouse", "church", "keep"] as const) {
    const site = createConstructionSite({ ordinal: 1, kind, tx: 20, ty: 20, startedTick: 0 });
    const anchors = [0, 0.3, 0.6, 0.9].map(work => constructionSiteLabelAnchor({ ...site, builderTicks: site.requiredBuilderTicks * work }));
    assert.ok(anchors.every(anchor => anchor.x === anchors[0]!.x && anchor.topY === anchors[0]!.topY), kind);
  }
});

test("INSTALL-11: site props by family and stage (crane from the frame on public sites), workers and tools by family", () => {
  const church = createConstructionSite({ ordinal: 1, kind: "church", tx: 20, ty: 20, startedTick: 0 });
  assert.ok(!kitSiteProps(church, 1).some(prop => prop.key === "treadwheel_crane"));
  assert.ok(kitSiteProps(church, 2).some(prop => prop.key === "treadwheel_crane") && kitSiteProps(church, 2).some(prop => prop.key === "centering_arch"));
  const house = createConstructionSite({ ordinal: 2, kind: "house", tx: 20, ty: 20, startedTick: 0 });
  assert.deepEqual(kitSiteProps(house, 1).map(prop => prop.key), ["timber_beam_stack", "kit_timber_raising_frame"]);
  assert.deepEqual(kitWorker("house", 1), { sheet: "wk_carpenter", tool: "work_adze" });
  assert.deepEqual(kitWorker("house", 2), { sheet: "wk_carpenter", tool: "work_saw" });
  assert.deepEqual(kitWorker("church", 2), { sheet: "wk_mason", tool: "work_trowel" });
  assert.equal(kitWorker("well", 1), null);
});

test("INSTALL-11: a demolished building plays its kit in reverse (roof to plot) over 1.2 s; a building replaced on its footprint does not", async () => {
  const { DEFAULT_GAME_STATE } = await import("../src/state/gameStore");
  const { activeDemolitions, demolitionStage, DEMOLITION_MS, observeDemolitions } = await import("../src/render/demolitionMoments");
  assert.deepEqual([0, 300, 600, 900, DEMOLITION_MS - 1].map(demolitionStage), [3, 2, 1, 0, 0]);
  const base = { ...DEFAULT_GAME_STATE, tick: 10 };
  const [first, second, ...rest] = base.buildings;
  observeDemolitions(base, 0);
  observeDemolitions({ ...base, tick: 11, buildings: [second!, ...rest] }, 100);
  assert.deepEqual(activeDemolitions(), [first!.id], "demolished: nothing stands on its footprint");
  observeDemolitions({ ...base, tick: 12, buildings: [{ ...second!, id: "rebuilt" }, ...rest] }, 200);
  assert.deepEqual(activeDemolitions(), [first!.id], "the second house was replaced on its footprint (a merge or rebuild): no sequence");
  observeDemolitions({ ...base, tick: 13, buildings: rest }, 100 + DEMOLITION_MS);
  assert.ok(!activeDemolitions().includes(first!.id), "over after 1.2 s");
});
