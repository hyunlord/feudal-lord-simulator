// NAT-1 audit ③ (user, 2026-09-30): a wall "with gaps" — its segments that are not finished, and why (site progress,
// builders, timber). Reads saves; no browser.   tsx scripts/nat1bWalls.ts <save.json[.gz]> ...
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { decodeSave } from "../src/save/saveCodec";

for (const path of process.argv.slice(2)) {
  const raw = readFileSync(path); const bytes = new Uint8Array(path.endsWith(".gz") ? gunzipSync(raw) : raw);
  // A probe over saved JSON of any version: the fields it prints are read loosely.
  const state = (decodeSave(bytes).envelope as unknown as { state: Record<string, any> }).state;
  const wall = state.palisade;
  if (wall === null || wall === undefined) { console.log(path, "no wall"); continue; }
  const sites = new Map<string, any>((state.constructionSites ?? []).map((site: any) => [site.id, site]));
  const open = wall.segments.filter((segment: any) => !segment.completed);
  console.log(path, `year tick ${state.tick}: segments ${wall.segments.length}, unfinished ${open.length}, material ${[...new Set(wall.segments.map((s: any) => s.material))].join("/")}`);
  for (const segment of open.slice(0, 12)) {
    const site = segment.constructionSiteId === null ? null : sites.get(segment.constructionSiteId);
    console.log(`  ${segment.id} tiles ${segment.tileCount} site ${segment.constructionSiteId ?? "none"}`, site === undefined || site === null ? "" :
      JSON.stringify({ progress: site.workProgress ?? site.progress, needed: site.workRequired ?? site.required, builders: site.assignedBuilders, delivered: site.delivered ?? site.materials, priority: site.priority }));
  }
}
