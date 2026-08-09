import { setTimeout as delay } from "node:timers/promises";

import { proofSnapshot } from "./phase10BrowserProofCdp.mjs";

import {
  clickCanvasFraction,
  clickSelector,
  dedicatedGuidance,
  dragCanvasFractions,
  observableState,
} from "./phase12PublishedProofBrowser.mjs";

const TARGETS = [
  { x: 0.50, y: 0.48 },
  { x: 0.44, y: 0.48 },
  { x: 0.56, y: 0.48 },
  { x: 0.50, y: 0.40 },
  { x: 0.50, y: 0.56 },
  { x: 0.38, y: 0.42 },
  { x: 0.62, y: 0.42 },
  { x: 0.38, y: 0.56 },
  { x: 0.62, y: 0.56 },
  { x: 0.32, y: 0.48 },
  { x: 0.68, y: 0.48 },
];

export async function followDedicatedGuidance(client, input) {
  const guidance = await dedicatedGuidance(client);
  const snapshot = await proofSnapshot(client);
  const selected = selectGuidedTool(guidance, snapshot);
  const target = TARGETS[input.attempt % TARGETS.length];
  if (target === undefined) throw new Error("guided target sequence is empty");
  const atMs = Math.round(input.atMs);
  if (selected === null) {
    return {
      action: null,
      guess: {
        atMs,
        prompt: guidance.prompt,
        decision: "waited because dedicated guidance exposed no affordable highlighted tool",
        reason: `sampled ${guidance.source} without inventing a tool`,
      },
    };
  }

  if (snapshot.constructionSites.some((site) => site.kind === selected.tool)) {
    return {
      action: null,
      guess: {
        atMs,
        prompt: guidance.prompt,
        decision: `waited for in-progress ${selected.label} construction`,
        reason: "did not duplicate the current guided building while its site was active",
      },
    };
  }

  const before = await observableState(client);
  await clickSelector(client, `.build-seal[data-highlighted="${selected.tool}"]`);
  const gesture = selected.tool === "road" ? "road-drag" : "building-click";
  if (gesture === "road-drag") {
    await dragCanvasFractions(client, target, { x: Math.min(0.78, target.x + 0.035), y: target.y });
  } else {
    await clickCanvasFraction(client, target.x, target.y);
  }
  await delay(300);
  const after = await observableState(client);
  const outcome = stateDeltaOutcome(gesture, before, after);
  const guess = {
    atMs,
    prompt: guidance.prompt,
    decision: `${gesture} at visible canvas fraction ${target.x.toFixed(3)},${target.y.toFixed(3)}`,
    reason: `${guidance.source} named ${selected.label} but exposed no exact tile coordinate`,
  };
  if (outcome === null) return { action: null, guess };
  return {
    action: {
      atMs,
      label: selected.label,
      source: guidance.source,
      gesture,
      before,
      after,
      reason: "followed the current dedicated guidance and highlighted affordable tool",
      outcome,
    },
    guess,
  };
}

function selectGuidedTool(guidance, snapshot) {
  const valid = guidance.tools.filter((entry) => entry.tool !== null && entry.label !== null);
  if (guidance.prompt.includes("인구")) return valid.find((entry) => entry.tool === "house") ?? valid[0] ?? null;
  return valid.find((entry) => entry.tool === "road" || !snapshot.buildings.some((building) => building.kind === entry.tool))
    ?? valid[0]
    ?? null;
}

function stateDeltaOutcome(gesture, before, after) {
  if (gesture === "road-drag") {
    return after.roadRevision > before.roadRevision
      ? `roadRevision ${before.roadRevision} -> ${after.roadRevision}`
      : null;
  }
  if (after.constructionSites > before.constructionSites) {
    return `constructionSites ${before.constructionSites} -> ${after.constructionSites}`;
  }
  if (after.buildings > before.buildings) {
    return `buildings ${before.buildings} -> ${after.buildings}`;
  }
  return null;
}
