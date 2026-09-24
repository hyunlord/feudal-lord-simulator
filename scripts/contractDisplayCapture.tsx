// Captures the player-visible output of the cause registry (UI-1) and PredictionLine[] (UI-2)
// for fixed saved states, so a contract/adapter change can be proven display-identical by SHA.
// Usage: npx tsx scripts/contractDisplayCapture.tsx <out-dir>
// Reads only repository fixtures; writes <out-dir>/capture-<state>.txt and <out-dir>/digest.json.
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { BUILDING_CONFIG, type BuildingKind } from "../src/content/buildingConfig";
import type { GameState } from "../src/engine/engine.types";
import { decodeSave } from "../src/save/saveCodec";
import { DEFAULT_GAME_STATE } from "../src/state/gameStore";
import { CauseLegend } from "../src/ui/CauseLegend";
import { EraConsole, buildEraConsoleModel } from "../src/ui/EraConsole";
import { firstBlocker, houseProgressModel, buildingCauseSnapshot } from "../src/ui/houseProgressModel";
import { houseDiagnosisModel } from "../src/ui/houseDiagnosisModel";
import { PredictionPanel } from "../src/ui/PredictionPanel";
import { buildingPlacementPrediction, roadPlacementPrediction } from "../src/ui/placementPrediction";
import { BuildingInspector } from "../src/render/BuildingInspector";
import { DiagnosticCard } from "../src/render/DiagnosticCard";
import { buildingInspectorModel } from "../src/render/buildingInspectorModel";
import { drawCauseMap } from "../src/render/causeMapOverlay";
import { cachedPlacementPreview } from "../src/render/placementPredictionRuntime";
import { initialOpenPalisadeDraft } from "../src/render/palisadeDraftInteraction";
import { suggestedConstructionRoad } from "../src/ui/constructionAccessModel";
import { A_TRIPLE_PRIME_ROAD_COPY } from "../src/ui/aTriplePrimeRoadCopy";

const outDir = process.argv[2];
if (outDir === undefined) throw new Error("usage: contractDisplayCapture.tsx <out-dir>");
mkdirSync(outDir, { recursive: true });

const fixtureStates: readonly [string, GameState][] = [
  ["default-new-game", DEFAULT_GAME_STATE],
  ...["new-game", "population-176", "palisade-construction", "timber-shortage"].map((name): [string, GameState] => [
    name, decodeSave(readFileSync(join("fixtures/saves/v4", `${name}.save.json`))).envelope.state as GameState,
  ]),
];

/** Records every canvas property write and method call in order; enough to compare canvas output. */
function recordingContext(log: string[]): CanvasRenderingContext2D {
  const fmt = (value: unknown): string => typeof value === "number" ? String(Math.round(value * 1e6) / 1e6)
    : typeof value === "string" ? JSON.stringify(value) : value === undefined ? "u" : typeof value === "object" ? "obj" : String(value);
  const target: Record<string, unknown> = {};
  return new Proxy(target, {
    get(_, key) {
      if (key === "canvas") return { width: 1280, height: 800 };
      if (key === "measureText") return (text: string) => ({ width: text.length * 7 });
      if (key === "getTransform") return () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 });
      if (typeof key === "string" && key in target) return target[key];
      return (...args: unknown[]) => { log.push(`${String(key)}(${args.map(fmt).join(",")})`); return undefined; };
    },
    set(_, key, value) { target[String(key)] = value; log.push(`${String(key)}=${fmt(value)}`); return true; },
  }) as unknown as CanvasRenderingContext2D;
}

function ui1(state: GameState): string {
  const parts: string[] = [renderToStaticMarkup(<CauseLegend />)];
  const snapshot = buildingCauseSnapshot(state);
  for (const building of [...state.buildings].sort((a, b) => a.id.localeCompare(b.id))) {
    parts.push(`# building ${building.id}`);
    parts.push(renderToStaticMarkup(<BuildingInspector state={state} hover={{ buildingId: building.id, x: 100, y: 100 }} />));
    const house = houseDiagnosisModel(state, building.id);
    const facility = house === null ? buildingInspectorModel(state, building.id) : null;
    const model = house !== null ? { kind: "house" as const, value: house } : facility !== null ? { kind: "building" as const, value: facility } : null;
    if (model !== null) parts.push(renderToStaticMarkup(<DiagnosticCard model={model} position={{ x: 0, y: 0 }}
      causeSummary={houseProgressModel(state, building.id)} />));
    const cause = snapshot.get(building.id);
    parts.push(`status=${cause?.status ?? "-"} summary=${cause?.summary ?? "-"} causeId=${cause?.blocker?.causeId ?? "-"} label=${cause?.blocker?.label ?? "-"}`);
  }
  for (const house of [...state.houses].sort((a, b) => a.buildingId.localeCompare(b.buildingId))) {
    const blocker = firstBlocker(house, state);
    parts.push(`firstBlocker ${house.buildingId} ${blocker?.causeId ?? "-"} ${blocker?.requirement ?? "-"} ${blocker?.reason ?? "-"} ${blocker?.label ?? "-"}`);
  }
  for (const problemOnly of [false, true]) {
    const log: string[] = [];
    drawCauseMap(recordingContext(log), state, 1, problemOnly);
    parts.push(`# causeMap problemOnly=${problemOnly}`, ...log);
  }
  return parts.join("\n");
}

function ui2(state: GameState): string {
  const parts: string[] = [];
  const kinds = BUILDING_CONFIG.map(definition => definition.kind as BuildingKind);
  for (let ty = 0; ty < state.height; ty += 4) for (let tx = 0; tx < state.width; tx += 4) {
    for (const kind of kinds) {
      const prediction = buildingPlacementPrediction(state, kind, { tx, ty });
      parts.push(`${kind}@${tx},${ty} ${renderToStaticMarkup(<PredictionPanel lines={prediction.lines} position={{ x: 10, y: 20 }} />)}`);
    }
  }
  for (let ty = 2; ty < state.height; ty += 8) for (let tx = 2; tx < state.width - 6; tx += 8) {
    const path = Array.from({ length: 6 }, (_, index) => ({ tx: tx + index, ty }));
    parts.push(`road@${tx},${ty} ${renderToStaticMarkup(<PredictionPanel lines={roadPlacementPrediction(state, path).lines} position={{ x: 10, y: 20 }} />)}`);
  }
  // Runtime path that appends the construction-connection line for a selected site.
  for (const site of [...state.constructionSites].sort((a, b) => a.id.localeCompare(b.id)).slice(0, 12)) {
    for (let dy = -2; dy <= 2; dy += 2) for (let dx = -3; dx <= 3; dx += 3) {
      const anchor = "tx" in site ? { tx: site.tx, ty: site.ty } : { tx: Math.round(site.path[0]?.x ?? 0), ty: Math.round(site.path[0]?.y ?? 0) };
      const start = { tx: anchor.tx + dx, ty: anchor.ty + dy };
      const end = { tx: anchor.tx + dx + 4, ty: anchor.ty + dy };
      const preview = cachedPlacementPreview(state, "road", end, start, site.id);
      if (preview.prediction !== undefined) parts.push(`site ${site.id} ${dx},${dy} ${renderToStaticMarkup(<PredictionPanel lines={preview.prediction.lines} position={{ x: 10, y: 20 }} />)}`);
    }
    // A straight run of the suggested connecting road exercises the appended connection line.
    const suggested = suggestedConstructionRoad(state, site);
    const first = suggested[0], last = suggested.at(-1);
    if (first !== undefined && last !== undefined && (first.tx === last.tx || first.ty === last.ty)) {
      const preview = cachedPlacementPreview(state, "road", last, first, site.id);
      if (preview.prediction !== undefined) parts.push(`site-connect ${site.id} ${renderToStaticMarkup(<PredictionPanel lines={preview.prediction.lines} position={{ x: 10, y: 20 }} />)}`);
    }
  }
  // The exact line object placementPredictionRuntime appends when a road connects a selected site.
  const base = roadPlacementPrediction(state, [{ tx: 10, ty: 10 }, { tx: 11, ty: 10 }, { tx: 12, ty: 10 }]);
  const appended = [...base.lines, { id: "construction-road-connection", tone: "positive", text: A_TRIPLE_PRIME_ROAD_COPY.connectsConstructionSite } as const];
  parts.push(`runtime-connection ${renderToStaticMarkup(<PredictionPanel lines={appended} position={{ x: 10, y: 20 }} />)}`);
  const noop = () => undefined;
  parts.push(`era ${renderToStaticMarkup(<EraConsole model={buildEraConsoleModel({ state, draft: null })} onBeginProposal={noop} onConfirmProposal={noop} onCancelProposal={noop} />)}`);
  const draft = { ...initialOpenPalisadeDraft(), path: [{ x: 40, y: 36 }, { x: 50, y: 36 }, { x: 50, y: 46 }] };
  parts.push(`era-draft ${renderToStaticMarkup(<EraConsole model={buildEraConsoleModel({ state, draft })} onBeginProposal={noop} onConfirmProposal={noop} onCancelProposal={noop} />)}`);
  return parts.join("\n");
}

const sha = (text: string) => createHash("sha256").update(text).digest("hex");
const digest: Record<string, { ui1: string; ui2: string; ui1Bytes: number; ui2Bytes: number }> = {};
for (const [name, state] of fixtureStates) {
  const one = ui1(state); const two = ui2(state);
  writeFileSync(join(outDir, `capture-${name}.txt`), `${one}\n=====UI-2=====\n${two}\n`);
  digest[name] = { ui1: sha(one), ui2: sha(two), ui1Bytes: Buffer.byteLength(one), ui2Bytes: Buffer.byteLength(two) };
}
const all = sha(JSON.stringify(digest));
writeFileSync(join(outDir, "digest.json"), `${JSON.stringify({ all, states: digest }, null, 2)}\n`);
console.log(JSON.stringify({ all, states: digest }, null, 2));
