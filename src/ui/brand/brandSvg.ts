import { createElement, type ReactNode } from "react";
import { BRAND_COLOURS } from "../../content/palette";
import { SEAL_ART, TONE_SLOTS, type BrandArtNode, type BrandTone } from "./brandArt.generated";

// LM-R3: the kit's shapes (brandArt.generated.ts) as React SVG elements. "$key" is a brand colour, "~slot" the tone's
// colour for that slot, ["seal", { art }] the shared wax-seal group. Ids get the instance's prefix (the kit repeats the
// same ids in every file), so two logos on one page do not collide.

/** A per-instance id prefix from React's useId (letters, digits, "-" and "_" only). */
export const brandIdPrefix = (reactId: string): string => `brand${reactId.replace(/[^\w-]/g, "")}`;

const colour = (value: string, tone: BrandTone): string => value.startsWith("$")
  ? BRAND_COLOURS[value.slice(1) as keyof typeof BRAND_COLOURS]
  : value.startsWith("~") ? BRAND_COLOURS[TONE_SLOTS[tone][value.slice(1)]!] : value;

function brandNode(node: BrandArtNode, tone: BrandTone, prefix: string, key: number): ReactNode {
  const [tag, attrs, children] = node;
  if (tag === "seal") return brandNode(SEAL_ART[attrs["art"] as keyof typeof SEAL_ART], tone, prefix, key);
  const props: Record<string, string | number> = { key };
  for (const [name, value] of Object.entries(attrs)) props[name] = name === "id" ? `${prefix}-${value}` : colour(value, tone);
  return createElement(tag, props, children === undefined ? undefined : brandNodes(children, tone, prefix));
}

export function brandNodes(nodes: readonly BrandArtNode[], tone: BrandTone, prefix: string): ReactNode[] {
  return nodes.map((node, index) => brandNode(node, tone, prefix, index));
}
