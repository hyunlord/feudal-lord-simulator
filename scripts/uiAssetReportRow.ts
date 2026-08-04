import type { AssetContract } from "./uiAssetManifest";

type SelectionRow = {
  readonly assetKey: string;
  readonly candidates: string;
  readonly selected: string;
  readonly beforePath: string;
  readonly finalPath: string;
  readonly dimensions: string;
  readonly alpha: string;
};

type FieldCheck = {
  readonly assetKey: string;
  readonly field: string;
  readonly actual: string;
  readonly expected: string;
};

const stripCode = (value: string): string => {
  const trimmed = value.trim();
  if (trimmed.startsWith("`") && trimmed.endsWith("`")) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
};

const parseSelectionRow = (line: string): SelectionRow | undefined => {
  const cells = line
    .trim()
    .split("|")
    .slice(1, -1)
    .map((cell) => cell.trim());
  if (cells.length !== 8) {
    return undefined;
  }
  const [asset, candidates, selected, before, final, dimensions, alpha] = cells;
  if (
    asset === undefined ||
    candidates === undefined ||
    selected === undefined ||
    before === undefined ||
    final === undefined ||
    dimensions === undefined ||
    alpha === undefined
  ) {
    return undefined;
  }
  if (asset === "Asset" || asset.startsWith("---")) {
    return undefined;
  }
  return {
    assetKey: stripCode(asset),
    candidates,
    selected,
    beforePath: stripCode(before),
    finalPath: stripCode(final),
    dimensions,
    alpha,
  };
};

const selectionRows = (reportText: string): readonly SelectionRow[] =>
  reportText
    .split(/\r?\n/)
    .map(parseSelectionRow)
    .filter((row): row is SelectionRow => row !== undefined);

const candidateEvidence = (reportText: string): ReadonlySet<string> => {
  const entries = new Set<string>();
  for (const line of reportText.split(/\r?\n/)) {
    const match = /^- Candidate `(?<path>[^`]+)`$/.exec(line.trim());
    if (match?.groups !== undefined) {
      const candidatePath = match.groups["path"];
      if (candidatePath !== undefined) {
        entries.add(candidatePath);
      }
    }
  }
  return entries;
};

const expectedCandidateText = (asset: AssetContract): string =>
  asset.candidates.map((candidate) => `${candidate.index} seed \`${candidate.seed}\``).join(", ");

const expectedAlphaText = (asset: AssetContract): string => {
  if (asset.alpha === "transparent") {
    return "present, preserved";
  }
  return "all-opaque, preserved";
};

const assertField = (check: FieldCheck): void => {
  if (check.actual !== check.expected) {
    throw new Error(`${check.assetKey} report row ${check.field} was ${check.actual}, expected ${check.expected}`);
  }
};

export const assertReportAlignment = (asset: AssetContract, reportText: string): void => {
  const rows = selectionRows(reportText).filter((row) => row.assetKey === asset.key);
  if (rows.length !== 1) {
    throw new Error(`${asset.key} report row count was ${rows.length}, expected 1`);
  }
  const row = rows[0];
  if (row === undefined) {
    throw new Error(`${asset.key} report row is missing`);
  }
  assertField({ assetKey: asset.key, field: "candidates", actual: row.candidates, expected: expectedCandidateText(asset) });
  assertField({ assetKey: asset.key, field: "selected", actual: row.selected, expected: String(asset.selectedIndex) });
  assertField({ assetKey: asset.key, field: "before path", actual: row.beforePath, expected: asset.beforePath });
  assertField({ assetKey: asset.key, field: "final path", actual: row.finalPath, expected: asset.finalPath });
  assertField({ assetKey: asset.key, field: "dimensions", actual: row.dimensions, expected: `${asset.width}x${asset.height}` });
  assertField({ assetKey: asset.key, field: "alpha", actual: row.alpha, expected: expectedAlphaText(asset) });
  const evidence = candidateEvidence(reportText);
  for (const candidate of asset.candidates) {
    if (!evidence.has(candidate.path)) {
      throw new Error(`${asset.key} report candidate ${candidate.index} evidence is missing`);
    }
  }
};
