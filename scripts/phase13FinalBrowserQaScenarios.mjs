import { setTimeout as delay } from "node:timers/promises";

import { capturePhase13FrameProfile } from "./phase13FinalBrowserQaFrame.mjs";
import {
  PHASE13_CONSTRUCTION_SHOTS,
  PHASE13_RESPONSIVE_VIEWPORTS,
} from "./phase13FinalBrowserQaConstants.mjs";
import {
  captureQaScreenshot,
  centerProofTile,
  clickByAria,
  clickTile,
  dragCanvas,
  loadedScriptAndStyleHashes,
  openPublicProofPage,
  pressEscape,
  proofSnapshot,
  responsiveMetrics,
  selectedConstructionProgress,
  setViewport,
  zoomCanvasIn,
} from "./phase13FinalBrowserQaBrowser.mjs";

const OPENING_VIEWPORT = { width: 1280, height: 720, mobile: false };
const HOUSE_TILE = { tx: 45, ty: 40 };

export async function runPhase13BrowserScenarios(client, config) {
  const screenshots = [];
  const opening = await captureOpening(client, config, screenshots);
  const loadedResources = await loadedScriptAndStyleHashes(client);
  const responsive = await captureResponsive(client, config, screenshots);
  const representative = await captureRepresentativeScenes(client, config, screenshots);
  const walker = await captureWalkerScene(client, config, screenshots);
  const constructionResult = await captureConstructionScenes(client, config, screenshots);
  const frameProfile = await captureFrameProfile(client, config, screenshots);
  return {
    loadedResources,
    screenshots,
    pageInteractions: [
      opening.interaction,
      ...responsive.map((entry) => entry.interaction),
      representative.interaction,
      walker.interaction,
      constructionResult.interaction,
      frameProfile.interaction,
    ],
    opening,
    responsive: [opening.responsive, ...responsive],
    representative,
    walker,
    construction: constructionResult.captures,
    frameProfile,
  };
}

async function captureOpening(client, config, screenshots) {
  await setViewport(client, OPENING_VIEWPORT);
  const interaction = await openPublicProofPage(client, config.publicUrl);
  const metrics = await responsiveMetrics(client);
  const capture = await captureQaScreenshot({ client, dir: config.screenshotDir, screenshots, id: "opening-1280x720" });
  return { ...capture, interaction, metrics, responsive: { id: "opening-1280x720", ...OPENING_VIEWPORT, ...metrics } };
}

async function captureResponsive(client, config, screenshots) {
  const results = [];
  for (const viewport of PHASE13_RESPONSIVE_VIEWPORTS) {
    await setViewport(client, viewport);
    const interaction = await openPublicProofPage(client, config.publicUrl);
    const metrics = await responsiveMetrics(client);
    const capture = await captureQaScreenshot({ client, dir: config.screenshotDir, screenshots, id: viewport.id });
    results.push({ id: viewport.id, width: viewport.width, height: viewport.height, mobile: viewport.mobile, interaction, ...metrics, canvas: capture.canvas });
  }
  return results;
}

async function captureRepresentativeScenes(client, config, screenshots) {
  await setViewport(client, OPENING_VIEWPORT);
  const interaction = await openPublicProofPage(client, config.publicUrl);
  await zoomCanvasIn(client);
  const terrain = await captureQaScreenshot({ client, dir: config.screenshotDir, screenshots, id: "terrain-close-up-high-zoom" });
  await dragCanvas(client, { x: 0.7, y: 0.6 }, { x: 0.35, y: 0.4 });
  const forest = await captureQaScreenshot({ client, dir: config.screenshotDir, screenshots, id: "forest-scene" });
  return { interaction, terrain, forest };
}

async function captureWalkerScene(client, config, screenshots) {
  await setViewport(client, OPENING_VIEWPORT);
  const interaction = await openPublicProofPage(client, config.publicUrl);
  await clickByAria(client, "자동 발전");
  await clickByAria(client, "5배속");
  const movement = await waitForWalkerMovement(client);
  await clickByAria(client, "일시 정지");
  const focus = await centerProofTile(client, { tx: Math.round(movement.end.x), ty: Math.round(movement.end.y) });
  await zoomCanvasIn(client);
  const capture = await captureQaScreenshot({ client, dir: config.screenshotDir, screenshots, id: "procedural-walker-close-up" });
  return { interaction, ...movement, focus, capture };
}

async function captureConstructionScenes(client, config, screenshots) {
  await setViewport(client, OPENING_VIEWPORT);
  const interaction = await openPublicProofPage(client, config.publicUrl);
  const before = await proofSnapshot(client);
  await clickByAria(client, "오두막");
  await clickTile(client, HOUSE_TILE);
  const site = newlyAddedHouseSite(before, await proofSnapshot(client));
  await pressEscape(client);
  await clickTile(client, HOUSE_TILE);
  await clickByAria(client, "1배속");
  const captures = [];
  for (const shot of PHASE13_CONSTRUCTION_SHOTS) {
    const progress = await waitForConstructionProgress(client, shot.target, site.id);
    const capture = await captureQaScreenshot({ client, dir: config.screenshotDir, screenshots, id: shot.id });
    captures.push({ id: shot.id, siteId: site.id, siteKind: "house", building: "house", label: "오두막", ...progress, canvas: capture.canvas });
  }
  await clickByAria(client, "일시 정지");
  return { interaction, captures };
}

async function captureFrameProfile(client, config, screenshots) {
  const interactionBox = {};
  const frameProfile = await capturePhase13FrameProfile({
    client,
    durationMs: config.frameDurationMs,
    prepare: async () => {
      await setViewport(client, OPENING_VIEWPORT);
      interactionBox.interaction = await openPublicProofPage(client, config.publicUrl);
      await clickByAria(client, "1배속");
    },
  });
  await captureQaScreenshot({ client, dir: config.screenshotDir, screenshots, id: "frame-profile-1x-end" });
  await clickByAria(client, "일시 정지");
  return { ...frameProfile, interaction: interactionBox.interaction };
}

async function waitForWalkerMovement(client) {
  let start = null;
  for (let attempt = 0; attempt < 360; attempt += 1) {
    const walker = (await proofSnapshot(client)).walkers[0] ?? null;
    if (walker !== null && start === null) start = walker;
    if (walker !== null && start !== null && walker.id === start.id && (walker.x !== start.x || walker.y !== start.y)) {
      return { kind: walker.kind, start: walkerPoint(start), end: walkerPoint(walker), moved: true };
    }
    await delay(250);
  }
  throw new Error("autoplay 5x did not produce a moving proof snapshot walker");
}

async function waitForConstructionProgress(client, target, siteId) {
  for (let attempt = 0; attempt < 420; attempt += 1) {
    const snapshot = await proofSnapshot(client);
    const site = snapshot.constructionSites.find((entry) => entry.id === siteId) ?? null;
    const progress = await selectedConstructionProgress(client);
    if (target >= 1 && site === null) return completedHouse(snapshot);
    if (site?.kind === "house" && progress?.name === "오두막" && Number.isFinite(progress.progress) && progress.progress >= lowerBound(target) && progress.progress <= upperBound(target)) return progress;
    await delay(250);
  }
  throw new Error(`house construction did not reach measured progress ${target}`);
}

function newlyAddedHouseSite(before, placed) {
  const previousIds = new Set(before.constructionSites.map((site) => site.id));
  const added = placed.constructionSites.filter((site) => !previousIds.has(site.id) && site.kind === "house");
  if (added.length !== 1) throw new Error("construction QA must add exactly one house site");
  return added[0];
}

function completedHouse(snapshot) {
  const house = snapshot.buildings.find((building) => building.kind === "house" && building.tx === HOUSE_TILE.tx && building.ty === HOUSE_TILE.ty);
  if (house === undefined) throw new Error("completed construction did not produce house at HOUSE_TILE");
  return { progress: 1, progressText: "complete", completed: true, houseTile: HOUSE_TILE, completedBuildingId: house.id };
}

function walkerPoint(walker) {
  return { id: walker.id, x: walker.x, y: walker.y };
}

function lowerBound(target) {
  if (target <= 0.25) return 0;
  return target - 0.08;
}

function upperBound(target) {
  if (target <= 0.25) return 0.25;
  if (target >= 1) return 1;
  return target + 0.08;
}
