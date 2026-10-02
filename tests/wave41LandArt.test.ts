/**
 * NAT-4 Wave 41 additions (scripts/installWave41.py): the forest edge strips (summer a / b from INBOX-2z, winter, and the
 * deep-woodland summer strip kept for later) and the width-1 fords — eight confirmed files installed byte for byte with
 * a provenance row each and installed_by NAT-4, loaded on first draw only; a
 * single-cell ford draws its w1 sheet (pivot (256, 128), 512 x 256), wider ones keep Wave 34's.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fordKey } from "../src/render/wave34Art";
import { WAVE41_FORDS, WAVE41_GROUND } from "../src/render/wave41LandManifest.generated";

const sha = (path: string) => createHash("sha256").update(readFileSync(path)).digest("hex");
const csvRows = (path: string) => readFileSync(path, "utf8").split(/\r?\n/);

test("eight confirmed Wave 41 additions installed byte for byte, with provenance and installed_by NAT-4", () => {
  const all = { ...WAVE41_GROUND, ...WAVE41_FORDS };
  assert.equal(Object.keys(all).length, 8);
  const ledger = csvRows("docs/provenance/assets.csv");
  const inbox = csvRows("assets-inbox/INBOX_LEDGER.csv");
  for (const [key, meta] of Object.entries(all)) {
    const runtime = `public/${meta.url}`;
    const file = meta.url.split("/").at(-1)!;
    // INBOX-2z's woodland_edge_a / _b came under landui/assets/forest without a -vN suffix.
    const source = file.startsWith("woodland_edge_") ? `assets-inbox/wave41/additions-20261002/landui/assets/forest/${file}`
      : `assets-inbox/wave41/additions-20261002/assets/${meta.folder}/${file.replace(".png", "-v1.png")}`;
    assert.equal(sha(runtime), sha(source), key);
    const row = ledger.find(line => line.includes(`,${runtime},`));
    assert.ok(row !== undefined && row.includes(sha(runtime)) && row.includes(",runtime"), `${key} provenance`);
    const entry = inbox.find(line => line.includes(source.replace("assets-inbox/", "")));
    assert.ok(entry !== undefined && entry.includes(",confirmed,") && entry.trimEnd().endsWith(",NAT-4"), `${key} inbox ledger`);
  }
  const startup = readFileSync("scripts/checks/startupArtList.ts", "utf8") + readFileSync("src/render/preloadGameArt.ts", "utf8");
  assert.equal(/wave41/i.test(startup), false, "not in the startup preload");
});

test("a single-cell ford draws the w1 sheet of its axis and season; two to four cells keep Wave 34's", () => {
  for (const axis of ["ne", "nw"] as const) for (const season of ["summer", "winter"] as const) {
    const key = fordKey(1, axis, season);
    assert.equal(key, `ford_w1_${axis}_${season}`);
    const meta = WAVE41_FORDS[key as keyof typeof WAVE41_FORDS];
    assert.deepEqual([meta.width, meta.height, meta.pivot.x, meta.pivot.y, meta.season], [512, 256, 256, 128, season]);
    assert.equal(fordKey(2, axis, season), `ford_w2_${axis}_${season}`);
    assert.equal(fordKey(4, axis, season), `ford_w4_${axis}_${season}`);
    assert.equal(fordKey(6, axis, season), `ford_w4_${axis}_${season}`);
  }
});
