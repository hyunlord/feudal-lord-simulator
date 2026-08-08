import { execFileSync } from "node:child_process";

export const ROAD_MARKER = "🚧 길이 필요합니다";

const DEFAULT_CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const REQUIRED_SHOTS = ["fresh", "placement", "road", "walker", "goods", "final"];

export function parsePhase10BrowserProofArgs(args) {
  const values = parsePairs(args);
  const scenario = requiredChoice(values, "scenario", ["part6-playthrough", "frame-budget", "public-honest-read", "final-all"]);
  const provenance = revisionProvenance(valueOrNull(values, "revision"));
  const evidenceRoot = valueOrNull(values, "evidence-root");
  const speed = valueOrNull(values, "speed") === null && scenario === "final-all" ? 1 : readInteger(required(values, "speed"), "speed");
  const config = {
    scenario,
    url: valueOrNull(values, "url") ?? valueOrNull(values, "public-url") ?? valueOrNull(values, "local-url"),
    speed,
    ticks: valueOrNull(values, "ticks") === null ? null : readInteger(required(values, "ticks"), "ticks"),
    durationMs: valueOrNull(values, "duration-ms") === null ? null : readInteger(required(values, "duration-ms"), "duration-ms"),
    watchMs: valueOrNull(values, "watch-ms") === null ? (scenario === "final-all" ? 120_000 : null) : readInteger(required(values, "watch-ms"), "watch-ms"),
    placeBuildings: valueOrNull(values, "place-buildings") === null ? (scenario === "final-all" ? 2 : 0) : readInteger(required(values, "place-buildings"), "place-buildings"),
    maxFrameMs: valueOrNull(values, "max-frame-ms") === null ? 12 : Number.parseFloat(required(values, "max-frame-ms")),
    out: valueOrNull(values, "out") ?? (scenario === "final-all" && evidenceRoot !== null ? `${evidenceRoot}/final-all.json` : null),
    screenshotDir: valueOrNull(values, "screenshot-dir") ?? (scenario === "final-all" && evidenceRoot !== null ? `${evidenceRoot}/screens` : null),
    localUrl: valueOrNull(values, "local-url"),
    publicUrl: valueOrNull(values, "public-url"),
    evidenceRoot,
    ...provenance,
    chromePath: valueOrNull(values, "chrome-path") ?? process.env.CHROME_PATH ?? DEFAULT_CHROME,
    chromePort: valueOrNull(values, "chrome-port") === null ? 9236 : readInteger(required(values, "chrome-port"), "chrome-port"),
  };
  if (scenario === "part6-playthrough" && (config.speed !== 1 || config.ticks !== 3000)) {
    throw new Error("part6-playthrough requires --speed 1 --ticks 3000");
  }
  if (["part6-playthrough", "frame-budget", "public-honest-read"].includes(scenario) && config.url === null) throw new Error(`--url is required for ${scenario}`);
  if (config.out === null) throw new Error("--out is required");
  if (config.screenshotDir === null) throw new Error("--screenshot-dir is required");
  if (scenario === "frame-budget" && (config.speed !== 5 || config.durationMs !== 30_000)) {
    throw new Error("frame-budget requires --speed 5 --duration-ms 30000");
  }
  if (scenario === "public-honest-read" && (config.speed !== 1 || config.watchMs === null || config.watchMs < 120_000 || config.placeBuildings < 2)) {
    throw new Error("public-honest-read requires --speed 1 --watch-ms >= 120000 --place-buildings >= 2");
  }
  if (scenario === "final-all" && (config.localUrl === null || config.publicUrl === null || config.evidenceRoot === null)) {
    throw new Error("final-all requires --local-url --public-url --evidence-root");
  }
  if (!Number.isFinite(config.maxFrameMs) || config.maxFrameMs <= 0) throw new Error("max-frame-ms must be positive");
  if (scenario === "part6-playthrough" || scenario === "frame-budget") {
    delete config.watchMs;
    delete config.placeBuildings;
    delete config.localUrl;
    delete config.publicUrl;
    delete config.evidenceRoot;
  }
  return config;
}

export function readCleanRevision(value) {
  const normalized = value.trim();
  if (!/^[0-9a-f]{40}$/i.test(normalized)) {
    throw new Error("Set --revision to a clean 40-hex revision.");
  }
  return normalized;
}

export function assertPart6Playthrough(input) {
  const missingShots = REQUIRED_SHOTS.filter((shot) => !input.screenshots.includes(shot));
  if (input.tick < 3000) throw new Error(`playthrough tick ${input.tick} < 3000`);
  if (input.loopObservedTicks < 3000) throw new Error("live 1x loop did not reach 3000 ticks");
  if (input.walkerStartHash === input.walkerFinalHash) throw new Error("walker positions did not change");
  const carterPhase = input.logsCarter?.phase;
  if (input.logsCarter?.kind !== "carter" || !["outbound", "returning"].includes(carterPhase)
    || input.logsCarter.cargo?.resource !== "logs" || input.logsCarter.cargo.amount <= 0) {
    throw new Error("logs-carrying carter was not observed");
  }
  if (input.logsTransferred <= 0) throw new Error("logs were not transferred");
  if (input.timberAccumulated <= 0) throw new Error("timber did not accumulate");
  if (input.finalPopulation === input.initialPopulation && !validPopulationStasis(input.populationOutcome, input.initialPopulation)) {
    throw new Error("structured population stasis observations are required");
  }
  if (missingShots.length > 0) throw new Error(`missing screenshots: ${missingShots.join(",")}`);
  if (input.blankCanvas) throw new Error("canvas was blank");
  if (input.missingAssets.length > 0) throw new Error(`missing assets: ${input.missingAssets.join(",")}`);
  return { ok: true, renderHash: input.renderHash };
}

export function assertPlaythroughPreflight(input) {
  const roadDelta = input.roadRevision - input.initialRoadRevision;
  if (roadDelta !== 3) throw new Error(`road revision delta ${roadDelta} !== 3`);
  const expected = ["logging_camp", "sawmill", "storehouse"];
  const actual = input.constructionSites.map((site) => site.kind).sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`construction site kinds ${actual.join(",")} !== ${expected.join(",")}`);
  }
  return { ok: true };
}

export function assertOmittedRoadFlow(input) {
  if (input.tick < 600) throw new Error(`omitted-road tick ${input.tick} < 600`);
  if (!input.placedKinds.includes("logging_camp") || !input.placedKinds.includes("sawmill")) {
    throw new Error("omitted-road buildings did not persist");
  }
  if (input.placementState !== "construction_sites_persisted") throw new Error("omitted-road placement was not retained as construction sites");
  if (input.roadsEverPlaced) throw new Error("fresh no-road flow placed a road");
  if (input.initialRoadRevision !== 0 || input.finalRoadRevision !== 0) throw new Error("fresh no-road road revision must remain zero");
  if (!input.screenshots.includes("omitted-road-idle")) throw new Error("missing omitted-road-idle screenshot");
  if (input.markerProof?.marker !== ROAD_MARKER) throw new Error(`missing exact road marker: ${input.markerProof?.marker ?? ""}`);
  if (input.carterCount !== 0) throw new Error(`omitted-road carter count ${input.carterCount} !== 0`);
  const goodsMoved = input.goodsMoved === true || input.goodsDelta > 0;
  const productionChanged = input.productionChanged === true || input.productionDelta > 0;
  if (goodsMoved || productionChanged) throw new Error("omitted-road economy moved");
  return { ok: true, marker: input.markerProof.marker };
}

function revisionProvenance(explicitRevision) {
  if (explicitRevision !== null) {
    return { revision: readCleanRevision(explicitRevision), revisionSource: "explicit", revisionDirty: null };
  }
  const head = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const dirty = execFileSync("git", ["status", "--porcelain", "--untracked-files=normal"], { encoding: "utf8" }).trim() !== "";
  return { revision: `${readCleanRevision(head)}${dirty ? "+dirty" : ""}`, revisionSource: "git-head", revisionDirty: dirty };
}

function validPopulationStasis(outcome, population) {
  if (outcome?.kind !== "stable" || outcome.reason !== "house_residents_unchanged") return false;
  if (!Array.isArray(outcome.initialResidents) || !Array.isArray(outcome.finalResidents)) return false;
  if (JSON.stringify(outcome.initialResidents) !== JSON.stringify(outcome.finalResidents)) return false;
  return outcome.initialResidents.reduce((total, house) => total + house.residents, 0) === population;
}

export function summarizeFrameBudget(frameTimes, maxFrameMs) {
  if (frameTimes.length === 0) throw new Error("frame budget requires measured frames");
  const sorted = [...frameTimes].sort((left, right) => left - right);
  const averageMs = frameTimes.reduce((total, value) => total + value, 0) / frameTimes.length;
  const p95Index = Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1);
  const p95Ms = sorted[p95Index];
  const worstMs = sorted[sorted.length - 1];
  const overBudgetFrames = frameTimes.filter((value) => value > maxFrameMs).length;
  return { ok: p95Ms < maxFrameMs, averageMs, p95Ms, worstMs, measuredFrames: frameTimes.length, overBudgetFrames };
}

function parsePairs(args) {
  const values = new Map();
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index];
    const value = args[index + 1];
    if (!key?.startsWith("--") || value === undefined) throw new Error(`Invalid argument near ${key ?? "<end>"}`);
    values.set(key.slice(2), value);
  }
  return values;
}

function required(values, key) {
  const value = values.get(key);
  if (value === undefined || value.trim() === "") throw new Error(`Missing --${key}`);
  return value;
}

function valueOrNull(values, key) {
  return values.get(key) ?? null;
}

function requiredChoice(values, key, choices) {
  const value = required(values, key);
  if (!choices.includes(value)) throw new Error(`--${key} must be one of ${choices.join(", ")}`);
  return value;
}

function readInteger(value, label) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed.toString() !== value) throw new Error(`--${label} must be an integer`);
  return parsed;
}
