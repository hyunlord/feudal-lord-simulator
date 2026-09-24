import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { REPO_ROOT } from "./provenanceLedgerAssets";

/** Lists every file under public/, as repo-root-relative "public/..." paths, sorted. */
export function listAllPublicFiles(): string[] {
  const root = path.join(REPO_ROOT, "public");
  const out: string[] = [];
  function walk(dir: string): void {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else out.push(path.relative(REPO_ROOT, full).split(path.sep).join("/"));
    }
  }
  walk(root);
  return out.sort();
}
