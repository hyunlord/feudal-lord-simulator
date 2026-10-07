// LM-R2: puts one bundle of lord-screen UI parts into renderer B's art catalog (src/render/art/catalog.json), replacing
// the bundle of the same bundleId, so an area's install script can rerun and two areas' bundles merge by rerunning
// (on a catalog.json merge conflict: take either side, then rerun the other area's install script).
// The whole catalog must still build a registry (schema + semantic checks), and this bundle's files must match their
// contract (source/runtime SHA, size, pixels: scripts/checkArtCatalog.ts) before anything is written.
// Usage: npx tsx scripts/lmr2ArtBundle.ts <bundle.json>
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createArtRegistry } from "../src/render/art/artRegistry";
import { checkCatalogFiles } from "./checkArtCatalog";

export const CATALOG = "src/render/art/catalog.json";
const UI_KINDS = new Set(["ui-frame", "ui-image", "portrait", "event-illustration", "regional-map"]);

type Bundle = { readonly bundleId: string; readonly entries: readonly { readonly id: string; readonly kind: string }[] };

/** The catalog text with `bundle` in place of its namesake (or appended). Throws on any validation failure. */
export function upsertCatalogBundle(root: string, catalogText: string, bundle: Bundle): string {
  // INSTALL-18: the HUD's pictures (Wave 18) go in the same screen kinds, in a bundle named hud-<batch>.
  if (!/^(lord|hud)-/.test(bundle.bundleId)) throw new Error(`Screen-part bundles are named lord-<area> or hud-<batch>: ${bundle.bundleId}`);
  const offKind = bundle.entries.filter(entry => !UI_KINDS.has(entry.kind));
  if (offKind.length > 0) throw new Error(`Not a screen kind: ${offKind.map(entry => `${entry.id} (${entry.kind})`).join(", ")}`);
  const catalog = JSON.parse(catalogText) as Bundle[];
  const at = catalog.findIndex(item => item.bundleId === bundle.bundleId);
  const next = at < 0 ? [...catalog, bundle] : catalog.map((item, index) => index === at ? bundle : item);
  createArtRegistry(next);
  const failed = checkCatalogFiles(root, [bundle]).filter(row => row.errors.length > 0);
  if (failed.length > 0) throw new Error(failed.map(row => `${row.id}: ${row.errors.join("; ")}`).join("\n"));
  return `${JSON.stringify(next, null, 2)}\n`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const file = process.argv[2];
  if (file === undefined) throw new Error("Usage: npx tsx scripts/lmr2ArtBundle.ts <bundle.json>");
  const bundle = JSON.parse(readFileSync(file, "utf8")) as Bundle;
  writeFileSync(CATALOG, upsertCatalogBundle(process.cwd(), readFileSync(CATALOG, "utf8"), bundle));
  console.log(`${CATALOG}: ${bundle.bundleId} (${bundle.entries.length} entries)`);
}
