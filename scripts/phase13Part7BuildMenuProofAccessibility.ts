import { KO_UI } from "../src/content/locale.ko";
import { buildMenuGroups } from "../src/ui/buildMenuModel";

import type { CdpClient } from "./phase13Part7BuildMenuProofChrome.js";
import type { ProofScenario } from "./phase13Part7BuildMenuProofScenarios.js";

export type AccessibilityGroup = {
  readonly role: "group";
  readonly name: string;
};

export async function measureAccessibilityGroups(
  client: CdpClient,
  scenario: ProofScenario,
): Promise<readonly AccessibilityGroup[]> {
  const response = await client.send("Accessibility.getFullAXTree");
  const nodes = parseAxTreeResponse(response);
  return expectedAccessibilityGroupNames(scenario).map((expectedName) => {
    const group = nodes.find((node) => node.role === "group" && node.name === expectedName);
    if (group === undefined) throw new Error(`AX group missing accessible name: ${expectedName}`);
    return group;
  });
}

export function expectedAccessibilityGroupNames(scenario: ProofScenario): readonly string[] {
  return [
    KO_UI.placementSeals,
    ...buildMenuGroups(scenario.state).map((group) => `${group.label} 도구`),
    KO_UI.roadTool,
  ];
}

function parseAxTreeResponse(response: unknown): readonly AccessibilityGroup[] {
  if (!isRecord(response) || !isRecord(response.result) || !Array.isArray(response.result.nodes)) {
    throw new Error("Accessibility.getFullAXTree returned invalid nodes");
  }
  return response.result.nodes.flatMap(parseAxGroupNode);
}

function parseAxGroupNode(node: unknown): readonly AccessibilityGroup[] {
  if (!isRecord(node)) return [];
  const role = parseAxValue(node.role);
  const name = parseAxValue(node.name);
  if (role !== "group" || name === undefined || name.length === 0) return [];
  return [{ role, name }];
}

function parseAxValue(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (!isRecord(value)) return undefined;
  return typeof value.value === "string" ? value.value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
