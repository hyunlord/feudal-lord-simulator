import { setTimeout as delay } from "node:timers/promises";

import type { CdpClient } from "./phase13Part7BuildMenuProofChrome.js";
import { measureAccessibilityGroups } from "./phase13Part7BuildMenuProofAccessibility.js";
import { htmlDataUrl, pageHtml } from "./phase13Part7BuildMenuProofPage.js";
import { browserMeasurementExpression } from "./phase13Part7BuildMenuProofProbe.js";
import { selectedScenarios, VIEWPORTS } from "./phase13Part7BuildMenuProofScenarios.js";
import type { ProofScenario } from "./phase13Part7BuildMenuProofScenarios.js";
import type { BrowserProof, BrowserViewportMeasurement } from "./phase13Part7BuildMenuProofTypes.js";

export async function measureScenarios(client: CdpClient): Promise<BrowserProof> {
  const scenarioProofs: BrowserProof[] = [];
  for (const scenario of selectedScenarios()) {
    await client.send("Page.navigate", {
      url: htmlDataUrl(await pageHtml({ state: scenario.state, scenarioName: scenario.name })),
    });
    await waitForLoad(client);
    scenarioProofs.push(await measureViewports(client, scenario));
  }

  const failures = scenarioProofs.flatMap((proof) => proof.failures);
  return {
    verdict: failures.length === 0 ? "PASS" : "FAIL",
    failures,
    measurements: scenarioProofs.map((proof) => proof.measurements),
  };
}

async function measureViewports(
  client: CdpClient,
  scenario: ProofScenario,
): Promise<BrowserProof> {
  const viewportProofs: BrowserProof[] = [];
  for (const viewport of VIEWPORTS) {
    await client.send("Emulation.setDeviceMetricsOverride", {
      width: viewport.width,
      height: viewport.height,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await frames(10);
    const evaluatedProof = await client.evaluate(browserMeasurementExpression(viewport, scenario), true);
    const accessibilityGroups = await measureAccessibilityGroups(client, scenario);
    viewportProofs.push(withAccessibilityGroups(parseBrowserProof(evaluatedProof), accessibilityGroups));
  }

  const failures = viewportProofs.flatMap((proof) => proof.failures);
  return {
    verdict: failures.length === 0 ? "PASS" : "FAIL",
    failures,
    measurements: viewportProofs.map((proof) => proof.measurements),
  };
}

async function waitForLoad(client: CdpClient): Promise<void> {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const readyState = await client.evaluate("document.readyState", false);
    if (readyState === "complete") return;
    await delay(50);
  }
  throw new Error("Chrome target did not finish loading proof page");
}

async function frames(count: number): Promise<void> {
  await delay(Math.max(50, count * 16));
}

function parseBrowserProof(value: unknown): BrowserProof {
  if (!isRecord(value)) throw new Error("browser proof did not return an object");
  if (value.verdict !== "PASS" && value.verdict !== "FAIL") {
    throw new Error("browser proof returned an invalid verdict");
  }
  if (!Array.isArray(value.failures) || !value.failures.every((failure) => typeof failure === "string")) {
    throw new Error("browser proof returned invalid failures");
  }
  return {
    verdict: value.verdict,
    failures: value.failures,
    measurements: value.measurements,
  };
}

function withAccessibilityGroups(
  proof: BrowserProof,
  accessibilityGroups: BrowserViewportMeasurement["accessibilityGroups"],
): BrowserProof {
  if (!isRecord(proof.measurements)) {
    throw new Error("browser proof returned invalid measurements");
  }
  return {
    ...proof,
    measurements: {
      ...proof.measurements,
      accessibilityGroups,
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
