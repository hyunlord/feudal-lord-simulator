import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertAlphaContract,
  assertManifestContract,
  assertReportAlignment,
  assertScrollFrameTransparency,
  type AssetManifest,
} from "../scripts/uiAssetManifest";

const manifest = {
  assets: [
    {
      key: "seal_slot",
      width: 64,
      height: 64,
      alpha: "transparent",
      beforePath: "docs/asset-evidence/before/seal_slot.png",
      finalPath: "public/assets/ui/seal_slot.png",
      selectedIndex: 2,
      candidates: [
        {
          index: 1,
          seed: 52031470,
          path: "seal_slot/candidate_1_seed_52031470.png",
          width: 512,
          height: 512,
        },
        {
          index: 2,
          seed: 52031471,
          path: "seal_slot/candidate_2_seed_52031471.png",
          width: 512,
          height: 512,
        },
        {
          index: 3,
          seed: 52031472,
          path: "seal_slot/candidate_3_seed_52031472.png",
          width: 512,
          height: 512,
        },
      ],
    },
  ],
} satisfies AssetManifest;

const makeRgba = (width: number, height: number): Uint8Array => {
  const rgba = new Uint8Array(width * height * 4);
  for (let index = 3; index < rgba.length; index += 4) {
    rgba[index] = 255;
  }
  return rgba;
};

const clearAlphaRect = (
  rgba: Uint8Array,
  width: number,
  left: number,
  top: number,
  right: number,
  bottom: number,
): void => {
  for (let y = top; y < bottom; y += 1) {
    for (let x = left; x < right; x += 1) {
      rgba[(y * width + x) * 4 + 3] = 0;
    }
  }
};

describe("verifyUiAssets", () => {
  it("rejects machine-specific absolute candidate paths", () => {
    // Given: a manifest whose candidate evidence discloses a workstation path.
    const sealAsset = manifest.assets[0];
    assert.ok(sealAsset);
    const firstCandidate = sealAsset.candidates[0];
    assert.ok(firstCandidate);
    const absoluteManifest = {
      assets: [
        {
          ...sealAsset,
          candidates: [
            { ...firstCandidate, path: `/private/workstation/${firstCandidate.path}` },
            ...sealAsset.candidates.slice(1),
          ],
        },
      ],
    } satisfies AssetManifest;

    // When / Then: release manifests keep paths relative to the supplied root.
    assert.throws(
      () => assertManifestContract(absoluteManifest, sealAsset.key, []),
      /candidate path must be relative/,
    );
  });

  it("rejects alpha byte mismatch between before and final images", () => {
    // Given: matching-size RGBA buffers with different alpha bytes.
    const before = new Uint8Array([58, 46, 31, 255, 58, 46, 31, 17]);
    const after = new Uint8Array([58, 46, 31, 255, 58, 46, 31, 18]);

    // When / Then: alpha preservation is enforced, not only reported.
    assert.throws(() => assertAlphaContract("seal_slot", "transparent", before, after), /alpha byte changed/);
  });

  it("rejects an unexpectedly opaque transparent asset", () => {
    // Given: a declared transparent asset with fully opaque final alpha.
    const before = new Uint8Array([58, 46, 31, 255, 58, 46, 31, 255]);
    const after = new Uint8Array([58, 46, 31, 255, 58, 46, 31, 255]);

    // When / Then: the declared alpha contract is enforced.
    assert.throws(() => assertAlphaContract("seal_slot", "transparent", before, after), /expected transparency/);
  });

  it("accepts a scroll frame with a clear centre and fully transparent outside perimeter", () => {
    const width = 100;
    const height = 100;
    const rgba = makeRgba(width, height);
    clearAlphaRect(rgba, width, 25, 25, 75, 75);
    clearAlphaRect(rgba, width, 0, 0, 100, 4);
    clearAlphaRect(rgba, width, 0, 96, 100, 100);
    clearAlphaRect(rgba, width, 0, 0, 4, 100);
    clearAlphaRect(rgba, width, 96, 0, 100, 100);

    assert.doesNotThrow(() => assertScrollFrameTransparency(rgba, width, height));
  });

  it("rejects a scroll frame whose centre is not at least seventy percent transparent", () => {
    const width = 100;
    const height = 100;
    const rgba = makeRgba(width, height);
    clearAlphaRect(rgba, width, 25, 25, 55, 75);
    clearAlphaRect(rgba, width, 0, 0, 100, 4);
    clearAlphaRect(rgba, width, 0, 96, 100, 100);
    clearAlphaRect(rgba, width, 0, 0, 4, 100);
    clearAlphaRect(rgba, width, 96, 0, 100, 100);

    assert.throws(
      () => assertScrollFrameTransparency(rgba, width, height),
      /interior transparency/,
    );
  });

  it("rejects any opaque pixel in a scroll frame outside perimeter band", () => {
    const width = 100;
    const height = 100;
    const rgba = makeRgba(width, height);
    clearAlphaRect(rgba, width, 25, 25, 75, 75);
    clearAlphaRect(rgba, width, 0, 0, 100, 4);
    clearAlphaRect(rgba, width, 0, 96, 100, 100);
    clearAlphaRect(rgba, width, 0, 0, 4, 100);
    clearAlphaRect(rgba, width, 96, 0, 100, 100);
    rgba[(2 * width + 50) * 4 + 3] = 1;

    assert.throws(
      () => assertScrollFrameTransparency(rgba, width, height),
      /outside perimeter/,
    );
  });

  it("rounds the four-percent outside perimeter up at release dimensions", () => {
    const width = 512;
    const height = 512;
    const rgba = makeRgba(width, height);
    clearAlphaRect(rgba, width, 128, 128, 384, 384);
    clearAlphaRect(rgba, width, 0, 0, width, 21);
    clearAlphaRect(rgba, width, 0, height - 21, width, height);
    clearAlphaRect(rgba, width, 0, 0, 21, height);
    clearAlphaRect(rgba, width, width - 21, 0, width, height);
    rgba[(20 * width + 256) * 4 + 3] = 1;

    assert.throws(
      () => assertScrollFrameTransparency(rgba, width, height),
      /outside perimeter/,
    );
  });

  it("rejects stale candidate seeds in the active file set", () => {
    // Given: the active candidate files include stale seed names.
    const activeCandidates = [
      "candidate_1_seed_52030431.png",
      "candidate_2_seed_52030432.png",
      "candidate_3_seed_52030433.png",
    ];

    // When / Then: exact manifest seed/path alignment is required.
    assert.throws(() => assertManifestContract(manifest, "seal_slot", activeCandidates), /active candidates/);
  });

  it("rejects a missing selected candidate entry", () => {
    // Given: the selected index points at no manifest candidate.
    const sealAsset = manifest.assets[0];
    assert.ok(sealAsset);
    const invalid = {
      assets: [{ ...sealAsset, selectedIndex: 4 }],
    } satisfies AssetManifest;

    // When / Then: selected candidate existence is mandatory.
    assert.throws(() => assertManifestContract(invalid, "seal_slot", []), /selected candidate/);
  });

  it("rejects a wrong or missing manifest asset entry", () => {
    // Given: the expected asset key is absent.
    const invalid = { assets: [] } satisfies AssetManifest;

    // When / Then: verifier cannot pass on prose-only assumptions.
    assert.throws(() => assertManifestContract(invalid, "seal_slot", []), /manifest entry/);
  });

  it("rejects a candidate seed field that does not match its path basename", () => {
    // Given: the manifest seed is stale but the candidate path was left unchanged.
    const sealAsset = manifest.assets[0];
    assert.ok(sealAsset);
    const firstCandidate = sealAsset.candidates[0];
    assert.ok(firstCandidate);
    const invalid = {
      assets: [
        {
          ...sealAsset,
          candidates: [{ ...firstCandidate, seed: 999999 }, ...sealAsset.candidates.slice(1)],
        },
      ],
    } satisfies AssetManifest;

    // When / Then: each candidate seed is reconciled against its own filename.
    assert.throws(() => assertManifestContract(invalid, "seal_slot", []), /basename/);
  });

  it("rejects a stale seal table row even when another row masks the selected index", () => {
    // Given: the seal row has stale selected/index/dimension/path/alpha fields.
    const sealAsset = manifest.assets[0];
    assert.ok(sealAsset);
    const candidateEvidence = sealAsset.candidates
      .map((candidate) => `- Candidate \`${candidate.path}\``)
      .join("\n");
    const reportText = `
| Asset | Candidates | Selected | Before | Final | Dimensions | Alpha | Scan result |
| --- | --- | --- | --- | --- | --- | --- | --- |
| \`wood_console\` | 1 seed \`1\` | 2 | \`other-before.png\` | \`other-final.png\` | 64x64 | present, preserved | ok |
| \`seal_slot\` | 1 seed \`52031470\`, 2 seed \`52031471\`, 3 seed \`52031472\` | 3 | \`stale-before.png\` | \`stale-final.png\` | 128x128 | all-opaque, preserved | ok |
${candidateEvidence}
`;

    // When / Then: the exact seal table row is compared to the manifest.
    assert.throws(() => assertReportAlignment(sealAsset, reportText), /report row/);
  });
});
