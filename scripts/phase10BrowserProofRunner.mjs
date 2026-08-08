import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import {
  closeChrome,
  createCdpClient,
  createTarget,
  launchChrome,
  waitForChrome,
} from "./phase8Task10CdpClient.mjs";
import {
  canvasHash,
  clickByAria,
  clickTile,
  dragTile,
  missingAssets,
  openProofPage,
  proofSnapshot,
  snapshot,
  waitAndSnapshot,
  waitForElapsedTicks,
  waitForLogsCarterAndSnapshot,
} from "./phase10BrowserProofCdp.mjs";
import {
  assertOmittedRoadFlow,
  assertPart6Playthrough,
  assertPlaythroughPreflight,
  summarizeFrameBudget,
} from "./phase10BrowserProofAssertions.mjs";

const TIMBER_CHAIN = {
  roads: [
    [{ tx: 41, ty: 39 }, { tx: 43, ty: 39 }],
    [{ tx: 43, ty: 40 }, { tx: 43, ty: 41 }],
    [{ tx: 44, ty: 41 }, { tx: 44, ty: 41 }],
  ],
  buildings: [
    { label: "벌목소", tile: { tx: 41, ty: 38 } },
    { label: "제재소", tile: { tx: 43, ty: 38 } },
    { label: "창고", tile: { tx: 40, ty: 40 } },
  ],
};
const NO_ROAD_BUILDINGS = TIMBER_CHAIN.buildings.slice(0, 2);

export async function runPhase10BrowserProof(config) {
  const chromeSession = await launchChrome({
    chromePath: config.chromePath,
    remoteDebuggingPort: config.chromePort,
    userDataPrefix: "phase10-proof-chrome-",
    extraArgs: ["--no-sandbox"],
  });
  try {
    await waitForChrome(config.chromePort, chromeSession.stderr);
    const target = await createTarget(config.chromePort);
    const client = await createCdpClient(target.webSocketDebuggerUrl);
    try {
      await client.send("Page.enable");
      await client.send("Runtime.enable");
      await client.send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
      const result = config.scenario === "part6-playthrough"
        ? await runPlaythrough(client, config)
        : await runFrameBudget(client, config);
      await mkdir(path.dirname(config.out), { recursive: true });
      await writeFile(config.out, `${JSON.stringify(result, null, 2)}\n`);
      return result;
    } finally {
      client.close();
    }
  } finally {
    await closeChrome(chromeSession);
  }
}

async function runPlaythrough(client, config) {
  await openProofPage(client, config.url);
  await mkdir(config.screenshotDir, { recursive: true });
  const screenshots = [];
  const fresh = await snapshot(client, config.screenshotDir, screenshots, "fresh");
  await placeTimberChain(client, config.screenshotDir, screenshots);
  const placement = await proofSnapshot(client);
  assertPlaythroughPreflight({
    initialRoadRevision: fresh.snapshot.roadRevision,
    roadRevision: placement.roadRevision,
    constructionSites: placement.constructionSites,
  });
  await clickByAria(client, "Normal speed");
  const movement = await waitForLogsCarterAndSnapshot(client, fresh.snapshot.tick, config.ticks, config.screenshotDir, screenshots, "walker");
  await waitAndSnapshot(client, fresh.snapshot.tick, 1_000, config.screenshotDir, screenshots, "goods");
  const final = await waitAndSnapshot(client, fresh.snapshot.tick, config.ticks, config.screenshotDir, screenshots, "final");
  await clickByAria(client, "Pause");
  const omitted = await runOmittedRoadFlow(client, config);
  const evidence = {
    schemaVersion: 1,
    scenario: config.scenario,
    revision: config.revision,
    revisionSource: config.revisionSource,
    revisionDirty: config.revisionDirty,
    speed: config.speed,
    ticks: final.snapshot.tick - fresh.snapshot.tick,
    loopObservedTicks: final.snapshot.tick - fresh.snapshot.tick,
    initialPopulation: fresh.snapshot.population,
    finalPopulation: final.snapshot.population,
    populationOutcome: populationOutcome(fresh.snapshot, final.snapshot),
    walkerStartHash: movement.startHash,
    walkerFinalHash: movement.endHash,
    logsCarter: movement.logsCarter,
    logsTransferred: resourceAtKinds(final.snapshot, "logs", ["sawmill", "storehouse"]),
    timberAccumulated: Math.max(0, resourceTotal(final.snapshot, "timber") - resourceTotal(fresh.snapshot, "timber")),
    renderHash: final.canvas.hash,
    blankCanvas: final.canvas.visiblePixels === 0,
    missingAssets: await missingAssets(client),
    screenshots,
    omittedRoad: omitted,
  };
  assertPart6Playthrough(evidence);
  assertOmittedRoadFlow(omitted);
  return evidence;
}

async function runFrameBudget(client, config) {
  await client.send("Page.addScriptToEvaluateOnNewDocument", { source: frameProbeSource() });
  await openProofPage(client, config.url);
  await clickByAria(client, speedLabel(config.speed));
  await delay(config.durationMs);
  const frameTimes = await client.evaluate("window.__PHASE10_FRAME_TIMES__ ?? []", false);
  const summary = summarizeFrameBudget(frameTimes, config.maxFrameMs);
  const canvas = await canvasHash(client);
  if (!summary.ok) throw new Error(`frame p95 exceeded ${config.maxFrameMs}ms: ${JSON.stringify(summary)}`);
  if (canvas.visiblePixels === 0) throw new Error("frame-budget canvas was blank");
  return { schemaVersion: 1, scenario: config.scenario, revision: config.revision, revisionSource: config.revisionSource, revisionDirty: config.revisionDirty, speed: config.speed, durationMs: config.durationMs, maxFrameMs: config.maxFrameMs, ...summary, canvas };
}

async function placeTimberChain(client, dir, screenshots) {
  await clickByAria(client, "길");
  for (const [start, end] of TIMBER_CHAIN.roads) await dragTile(client, start, end);
  await snapshot(client, dir, screenshots, "road");
  for (const building of TIMBER_CHAIN.buildings) {
    await clickByAria(client, building.label);
    await clickTile(client, building.tile);
  }
  await snapshot(client, dir, screenshots, "placement");
}

async function runOmittedRoadFlow(client, config) {
  await openProofPage(client, config.url);
  const dir = path.join(config.screenshotDir, "omitted-road");
  const screenshots = [];
  await mkdir(dir, { recursive: true });
  const fresh = await snapshot(client, dir, screenshots, "omitted-road-fresh");
  await placeBuildings(client, NO_ROAD_BUILDINGS);
  await snapshot(client, dir, screenshots, "omitted-road-placement");
  const before = await proofSnapshot(client);
  await clickByAria(client, "Normal speed");
  await waitForElapsedTicks(client, before.tick, 600);
  await clickByAria(client, "Pause");
  const idle = await snapshot(client, dir, screenshots, "omitted-road-idle");
  const after = idle.snapshot;
  const markerProof = await runDisconnectedMarkerProof(client, config, dir);
  const goodsDelta = Math.abs(resourceTotal(after, "logs") - resourceTotal(before, "logs"))
    + Math.abs(resourceTotal(after, "timber") - resourceTotal(before, "timber"));
  return {
    tick: after.tick - before.tick,
    placedKinds: after.constructionSites.map((site) => site.kind),
    placementState: "construction_sites_persisted",
    roadsEverPlaced: after.roadRevision !== fresh.snapshot.roadRevision,
    initialRoadRevision: fresh.snapshot.roadRevision,
    finalRoadRevision: after.roadRevision,
    markerProof,
    carterCount: after.walkers.filter((walker) => walker.kind === "carter").length,
    goodsDelta,
    productionDelta: productionProgressDelta(after, before),
    screenshots,
  };
}

async function runDisconnectedMarkerProof(client, config, parentDir) {
  await openProofPage(client, config.url);
  const dir = path.join(parentDir, "marker-proof");
  const screenshots = [];
  await mkdir(dir, { recursive: true });
  await placeTimberChain(client, dir, screenshots);
  const fresh = await proofSnapshot(client);
  await clickByAria(client, "Normal speed");
  await waitForElapsedTicks(client, fresh.tick, 1_000);
  await clickByAria(client, "Pause");
  await clickByAria(client, "길");
  await clickTile(client, { tx: 41, ty: 39 });
  await clickByAria(client, "Normal speed");
  await waitForElapsedTicks(client, fresh.tick, 1_100);
  await clickByAria(client, "Pause");
  const marker = await snapshot(client, dir, screenshots, "disconnected-road-marker");
  const after = marker.snapshot;
  const camp = after.buildings.find((building) => building.kind === "logging_camp");
  return { method: "completed_then_disconnected", marker: camp?.problemCause ?? "", screenshots };
}

async function placeBuildings(client, buildings) {
  for (const building of buildings) {
    await clickByAria(client, building.label);
    await clickTile(client, building.tile);
  }
}

function resourceTotal(snapshot, resource) {
  return snapshot.buildings.reduce((total, building) => total + (building.inventory[resource] ?? 0), 0);
}

function productionProgressDelta(after, before) {
  const beforeById = new Map(before.buildings.map((building) => [building.id, building.productionProgress ?? 0]));
  return after.buildings.reduce(
    (total, building) => total + Math.abs((building.productionProgress ?? 0) - (beforeById.get(building.id) ?? 0)),
    0,
  );
}

function resourceAtKinds(snapshot, resource, kinds) {
  return snapshot.buildings.reduce((total, building) => kinds.includes(building.kind) ? total + (building.inventory[resource] ?? 0) : total, 0);
}

function populationOutcome(initial, final) {
  if (initial.population !== final.population) return { kind: "changed", delta: final.population - initial.population };
  const residents = (snapshot) => snapshot.houses.map((house) => ({ buildingId: house.buildingId, residents: house.residents }));
  return { kind: "stable", reason: "house_residents_unchanged", initialResidents: residents(initial), finalResidents: residents(final) };
}

function speedLabel(speed) {
  if (speed === 1) return "Normal speed";
  if (speed === 5) return "Fivefold speed";
  throw new Error(`unsupported browser speed ${speed}`);
}

function frameProbeSource() {
  return `(() => {
    const frameTimes = [];
    const pendingFrames = new Map();
    const original = window.requestAnimationFrame.bind(window);
    window.__PHASE10_FRAME_TIMES__ = frameTimes;
    window.requestAnimationFrame = (callback) => original((time) => {
      const startedAt = performance.now();
      callback(time);
      const duration = performance.now() - startedAt;
      pendingFrames.set(time, (pendingFrames.get(time) ?? 0) + duration);
      setTimeout(() => {
        const frameDuration = pendingFrames.get(time);
        if (frameDuration === undefined) return;
        frameTimes.push(frameDuration);
        pendingFrames.delete(time);
      }, 0);
    });
  })();`;
}
