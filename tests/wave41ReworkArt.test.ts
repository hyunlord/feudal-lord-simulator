/**
 * NAT-5 Wave 41 art-audit reworks (scripts/installWave41Rework.py): 27 confirmed redraws over the pictures they answer
 * (ART_AUDIT.md findings) — 26 runtime PNGs replaced byte for byte under their old names and the title keyart's
 * build-time source moved to its rework — each with its provenance row and installed_by NAT-5. A rework keeps its
 * original's canvas (so every manifest's size, pivot, anchor and display scale stand); `rock` (the NAT-5 ground
 * installer's) and `seal_slot` (LM-R1's, scripts/installWave41SealSlot.py) are left to other work.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { KEYART_DERIVATIVES } from "../scripts/keyartDerivatives";

const sha = (path: string) => createHash("sha256").update(readFileSync(path)).digest("hex");
const lines = (path: string) => readFileSync(path, "utf8").split(/\r?\n/);
const BATCH = "assets-inbox/wave41/candidates-20261002";
const unquote = (line: string) => line.split(",").map(cell => cell.replace(/^"|"$/g, ""));
const rows = lines(`${BATCH}/records/assets.csv`).slice(1).filter(line => line !== "").map(unquote)
  .map(([assetId, findings, candidate, width, height, sourcePath, sourceSha]) => ({ assetId: assetId!, findings: findings!, candidate: `${BATCH}/${candidate}`,
    width: Number(width), height: Number(height), sourcePath: sourcePath!, sourceSha: sourceSha! }));
const NOT_INSTALLED = new Set(["rock", "seal_slot"]);

/** A PNG's width and height from its IHDR. */
const pngSize = (path: string) => { const bytes = readFileSync(path); return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)]; };

test("26 runtime pictures are their Wave 41 rework, at the original's canvas, with provenance and installed_by NAT-5", () => {
  const ledger = lines("docs/provenance/assets.csv");
  const inbox = lines("assets-inbox/INBOX_LEDGER.csv");
  const replaced = rows.filter(row => !NOT_INSTALLED.has(row.assetId) && row.sourcePath.startsWith("public/"));
  assert.equal(replaced.length, 26);
  for (const row of replaced) {
    assert.equal(sha(row.sourcePath), sha(row.candidate), row.assetId);
    assert.deepEqual(pngSize(row.sourcePath), [row.width, row.height], `${row.assetId}: the original's canvas`);
    const provenance = ledger.find(line => line.includes(`,${row.sourcePath},`));
    assert.ok(provenance !== undefined && provenance.includes(`,${row.candidate},${sha(row.candidate)},`) && provenance.includes(",ART_BIBLE_v2,"), `${row.assetId} provenance`);
    const entry = inbox.find(line => line.startsWith(`wave41,${row.candidate.replace("assets-inbox/", "")},`));
    assert.ok(entry !== undefined && entry.includes(",confirmed,") && entry.endsWith(",NAT-5"), `${row.assetId} inbox ledger`);
  }
});

test("the title keyart's derivative is made from its rework; the Wave 8 original is superseded", () => {
  const item = KEYART_DERIVATIVES.find(entry => entry.id === "keyart_title_bg")!;
  assert.equal(item.source, `${BATCH}/assets/17-keyart_title_bg-wave41-v1.png`);
  assert.deepEqual(pngSize(item.source), [1920, 1080]);
  const inbox = lines("assets-inbox/INBOX_LEDGER.csv");
  const entry = inbox.find(line => line.startsWith("wave41,wave41/candidates-20261002/assets/17-keyart_title_bg-wave41-v1.png,"));
  assert.ok(entry !== undefined && entry.includes(`,${sha(item.source)},confirmed,`) && entry.endsWith(",NAT-5"));
  assert.ok(inbox.some(line => line.startsWith("wave8,wave8/candidates-20260925/assets/keyart/keyart_title_bg.png,") && line.includes(",superseded,wave41/")));
  assert.ok(lines("docs/provenance/assets.csv").some(line => line.startsWith(`keyart_title_bg,v1,${item.source},${sha(item.source)},`)));
});

test("seal_slot is its Wave 41 rework too, installed by LM-R1 (UI-02; scripts/installWave41SealSlot.py), not by NAT-5", () => {
  const row = rows.find(entry => entry.assetId === "seal_slot")!;
  const entry = lines("assets-inbox/INBOX_LEDGER.csv").find(line => line.startsWith(`wave41,${row.candidate.replace("assets-inbox/", "")},`))!;
  assert.equal(entry.endsWith(",NAT-5"), false);
  assert.equal(sha(row.sourcePath), sha(row.candidate));
  assert.deepEqual(pngSize(row.sourcePath), [row.width, row.height]);
  assert.ok(lines("docs/provenance/assets.csv").some(line => line.startsWith(`seal_slot,v1,${row.sourcePath},${sha(row.candidate)},${row.candidate},`)));
});
