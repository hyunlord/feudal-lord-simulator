import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { ArtBundle, ArtEntry } from "../src/render/art/artContract";
import { createArtAdapters } from "../src/render/art/artAdapters";
import { ArtRegistryError, createArtRegistry } from "../src/render/art/artRegistry";
import { validateArtSchema } from "../src/render/art/schemaValidation";
import { createUiPartArt } from "../src/ui/lord/uiPartArt";

// LM-R2 scaffold: the two UI-part kinds in renderer B's contract (`ui-frame` 9-slice, `ui-image` fixed size), validated
// like the other kinds, handed over by `ui-handoff`, and drawn by the lord screens only once loaded at a declared size.
const provenance = { inboxFile: "assets-inbox/wave35/example.png", sourceSha256: "a".repeat(64), runtimeSha256: "b".repeat(64) };
const frame: ArtEntry = { id: "frame", kind: "ui-frame", image: { url: "assets/lord/frame.png", width: 512, height: 384 }, provenance,
  slice: { top: 160, right: 128, bottom: 112, left: 128 }, scale: 0.5, contentInset: { top: 170, right: 140, bottom: 120, left: 140 }, centre: "fill", repeat: "stretch" };
const icon: ArtEntry = { id: "icon", kind: "ui-image", image: { url: "assets/lord/icon_32.png", width: 32, height: 32 }, provenance,
  cssWidths: [32], derivatives: [{ width: 64, assetId: "icon-64" }] };
const icon64: ArtEntry = { id: "icon-64", kind: "ui-image", image: { url: "assets/lord/icon_64.png", width: 64, height: 64 }, provenance,
  cssWidths: [64, 32], derivatives: [] };
const flag: ArtEntry = { id: "flag", kind: "ui-image", image: { url: "assets/lord/flag.png", width: 64, height: 96 }, provenance, cssWidths: [32], derivatives: [] };
const bundle = (entries: readonly ArtEntry[], rules: ArtBundle["rules"] = []): ArtBundle => ({ schemaVersion: 1, bundleId: "lord-test", entries, rules });
const schema: unknown = JSON.parse(readFileSync(new URL("../src/render/art/artContract.schema.json", import.meta.url), "utf8"));

test("LM-R2: the schema accepts a ui-frame and a ui-image with their own contract", () => {
  assert.deepEqual(validateArtSchema(bundle([frame, icon, icon64, flag]), schema), []);
});

for (const [name, value] of [
  ["a frame without slices", { ...frame, slice: undefined }],
  ["a negative slice", { ...frame, slice: { ...(frame as { slice: object }).slice, top: -1 } }],
  ["a zero scale", { ...frame, scale: 0 }],
  ["an unknown centre", { ...frame, centre: "half" }],
  ["world geometry on a frame", { ...frame, geometry: { pivot: { x: 0, y: 0 }, scale: 1, allowMirror: false } }],
  ["an image with no CSS width", { ...icon, cssWidths: [] }],
  ["a fractional CSS width", { ...icon, cssWidths: [31.5] }],
  ["a derivative without its width", { ...icon, derivatives: [{ assetId: "icon-64" }] }],
] as const) test(`LM-R2: the schema rejects ${name}`, () => {
  assert.ok(validateArtSchema(bundle([value as unknown as ArtEntry]), schema).length > 0);
});

test("LM-R2: the registry publishes valid parts and hands them to the screen (ui-handoff) with the deployed URL", () => {
  const registry = createArtRegistry([bundle([frame, icon, icon64, flag])]);
  assert.deepEqual(registry.entries("ui-frame").map(entry => entry.id), ["frame"]);
  assert.deepEqual(registry.entries("ui-image").map(entry => entry.id), ["icon", "icon-64", "flag"]);
  const adapters = createArtAdapters(registry, { createImage: null, baseUrl: "/game/" });
  for (const id of ["frame", "icon"]) {
    const placed = adapters.placement(id, { at: { x: 0, y: 0 } });
    assert.equal(placed?.type, "ui-handoff");
    assert.match(placed?.type === "ui-handoff" ? placed.entry.image.url : "", /^\/game\/assets\/lord\//);
  }
});

for (const [name, entries] of [
  ["slices that leave no centre", [{ ...frame, slice: { top: 200, right: 256, bottom: 184, left: 256 } }]],
  ["a content inset with no content area", [{ ...frame, contentInset: { top: 10, right: 300, bottom: 10, left: 212 } }]],
  ["a derivative of another width", [{ ...icon, derivatives: [{ width: 48, assetId: "icon-64" }] }, icon64]],
  ["a derivative of another shape", [{ ...icon, derivatives: [{ width: 64, assetId: "flag" }] }, flag]],
  ["a derivative of another kind", [{ ...icon, derivatives: [{ width: 512, assetId: "frame" }] }, frame]],
  ["a missing derivative", [icon]],
  ["two derivatives of one width", [{ ...icon, derivatives: [{ width: 64, assetId: "icon-64" }, { width: 64, assetId: "icon-64" }] }, icon64]],
] as const) test(`LM-R2: the registry rejects ${name} like any bad entry`, () => {
  assert.throws(() => createArtRegistry([bundle(entries as readonly ArtEntry[])]), ArtRegistryError);
});

test("LM-R2: a part rule selects by the screen's named state only", () => {
  const rule = (field: string) => ({ id: `r-${field}`, kind: "ui-image" as const, slot: "promise", priority: 0,
    conditions: [{ op: "eq" as const, field, value: "due" }], variants: [{ assetId: "icon", weight: 1 }], fallback: "none" as const });
  const registry = createArtRegistry([bundle([icon, icon64], [rule("state")])]);
  assert.equal(registry.select("ui-image", "promise", { state: "due" }, 0)?.id, "icon");
  assert.equal(registry.select("ui-image", "promise", { state: "kept" }, 0), null);
  assert.throws(() => createArtRegistry([bundle([icon, icon64], [rule("treasury")])]), ArtRegistryError);
});

/** A browser image stand-in: loads the URLs given sizes, fails the others. */
function fakeImages(sizes: Readonly<Record<string, readonly [number, number]>>) {
  return () => {
    const element = { naturalWidth: 0, naturalHeight: 0, onload: null as null | (() => void), onerror: null as null | (() => void),
      decode: () => Promise.resolve(),
      set src(url: string) {
        const size = sizes[url];
        queueMicrotask(() => { if (size === undefined) element.onerror?.(); else { [element.naturalWidth, element.naturalHeight] = size; element.onload?.(); } });
      } };
    return element as unknown as HTMLImageElement;
  };
}
const flush = () => new Promise(resolve => setTimeout(resolve, 0));

test("LM-R2: a loaded frame draws on the frame-box contract (border = safe inset, padding = gap, slices at its scale)", async () => {
  const art = createUiPartArt(createArtRegistry([bundle([frame])]), { createImage: fakeImages({ "/assets/lord/frame.png": [512, 384] }), baseUrl: "/" });
  assert.equal(art.frame("frame"), null, "kit look while loading");
  await art.settled(["frame"]); await flush();
  assert.deepEqual(art.frame("frame"), { dataFrame: "flat", style: { borderStyle: "solid", borderColor: "transparent", borderWidth: "85px 70px 60px 70px",
    padding: 8, borderImage: 'url("/assets/lord/frame.png") 160 128 112 128 fill / 80px 64px 56px 64px / 0 stretch' } });
});

test("LM-R2: an image is drawn only at a declared width, from the smallest file that covers 1x and 2x", async () => {
  const art = createUiPartArt(createArtRegistry([bundle([icon, icon64, flag])]), { baseUrl: "/",
    createImage: fakeImages({ "/assets/lord/icon_32.png": [32, 32], "/assets/lord/icon_64.png": [64, 64], "/assets/lord/flag.png": [64, 96] }) });
  await art.settled(["icon", "icon-64", "flag"]); await flush();
  assert.equal(art.image("icon", 32)?.backgroundImage, 'image-set(url("/assets/lord/icon_32.png") 1x, url("/assets/lord/icon_64.png") 2x)');
  assert.equal(art.image("icon-64", 32)?.backgroundImage, 'url("/assets/lord/icon_64.png")');
  assert.equal(art.image("icon", 48), null, "48 px is not declared");
  assert.deepEqual([art.image("flag", 32)?.width, art.image("flag", 32)?.height], [32, 48]);
});

test("LM-R2: a missing id, a failed load, a wrong decoded size or no image API keep the kit's look", async () => {
  const registry = createArtRegistry([bundle([frame, icon, icon64])]);
  const art = createUiPartArt(registry, { baseUrl: "/", createImage: fakeImages({ "/assets/lord/frame.png": [500, 384], "/assets/lord/icon_32.png": [32, 32] }) });
  await art.settled(["frame", "icon", "icon-64", "nope"]); await flush();
  assert.equal(art.frame("frame"), null, "decoded size differs");
  assert.equal(art.image("icon", 32), null, "its 2x copy failed");
  assert.equal(art.frame("nope"), null);
  assert.equal(art.frame("icon"), null, "an image is not a frame");
  const none = createUiPartArt(registry, { baseUrl: "/", createImage: null });
  await none.settled(["frame"]);
  assert.equal(none.frame("frame"), null);
});

test("LM-R2: an area's bundle goes into the catalog by bundleId (rerunnable), only after its files match the contract", async () => {
  const { mkdtempSync, mkdirSync, rmSync, writeFileSync: write } = await import("node:fs");
  const { createHash } = await import("node:crypto");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { writePng } = await import("../scripts/processBuildingSprite");
  const { upsertCatalogBundle } = await import("../scripts/lmr2ArtBundle");
  const root = mkdtempSync(join(tmpdir(), "lmr2-bundle-"));
  try {
    mkdirSync(join(root, "assets-inbox"), { recursive: true }); mkdirSync(join(root, "public/assets/lord"), { recursive: true });
    writePng(join(root, "assets-inbox/icon.png"), { dimensions: { width: 2, height: 2 }, rgba: new Uint8Array(16).fill(200) });
    const bytes = readFileSync(join(root, "assets-inbox/icon.png"));
    write(join(root, "public/assets/lord/icon.png"), bytes);
    const hash = createHash("sha256").update(bytes).digest("hex");
    const part: ArtEntry = { id: "lord-icon", kind: "ui-image", image: { url: "assets/lord/icon.png", width: 2, height: 2 },
      provenance: { inboxFile: "assets-inbox/icon.png", sourceSha256: hash, runtimeSha256: hash }, cssWidths: [2], derivatives: [] };
    const base = `${JSON.stringify([{ schemaVersion: 1, bundleId: "other", entries: [{ ...part, id: "other-icon" }], rules: [] }], null, 2)}\n`;
    const once = upsertCatalogBundle(root, base, { ...bundle([part]), bundleId: "lord-test" });
    assert.equal(upsertCatalogBundle(root, once, { ...bundle([part]), bundleId: "lord-test" }), once, "rerun replaces, not appends");
    assert.deepEqual((JSON.parse(once) as ArtBundle[]).map(item => item.bundleId), ["other", "lord-test"]);
    assert.throws(() => upsertCatalogBundle(root, base, { ...bundle([part]), bundleId: "wave99" }), /lord-/);
    assert.throws(() => upsertCatalogBundle(root, base, { ...bundle([{ ...part, provenance: { ...part.provenance, runtimeSha256: "c".repeat(64) } }]), bundleId: "lord-test" }), /Runtime SHA/);
    assert.throws(() => upsertCatalogBundle(root, base, { ...bundle([{ ...part, id: "other-icon" }]), bundleId: "lord-test" }), ArtRegistryError, "duplicate id across bundles");
  } finally { rmSync(root, { recursive: true, force: true }); }
});
