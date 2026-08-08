import {
  FOLIAGE_CANDIDATE_COUNT,
  FOLIAGE_SPECS,
  TREE_STUMP_KEYS,
  type FoliageCandidate,
  type FoliageSelection,
  type SelectionRubric,
} from "./worldAssetContracts";

type JsonRecord = Readonly<Record<string, unknown>>;
const PHASE10_SURFACE_CANDIDATE_COUNT = 6;

export class FoliageSelectionContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FoliageSelectionContractError";
  }
}

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const requireRecord = (value: unknown, label: string): JsonRecord => {
  if (!isRecord(value)) throw new FoliageSelectionContractError(`${label} must be an object`);
  return value;
};

const requireString = (record: JsonRecord, key: string, label: string): string => {
  const value = record[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new FoliageSelectionContractError(`${label} ${key} must be a nonempty string`);
  }
  return value;
};

const requireBoolean = (record: JsonRecord, key: string, label: string): boolean => {
  const value = record[key];
  if (typeof value !== "boolean") throw new FoliageSelectionContractError(`${label} ${key} must be boolean`);
  return value;
};

const requireTrue = (record: JsonRecord, key: string, label: string): true => {
  if (record[key] !== true) throw new FoliageSelectionContractError(`${label} ${key} must be true`);
  return true;
};

const requirePositiveInteger = (record: JsonRecord, key: string, label: string): number => {
  const value = record[key];
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new FoliageSelectionContractError(`${label} ${key} must be a positive integer`);
  }
  return value;
};

const requireNonnegativeNumber = (record: JsonRecord, key: string, label: string): number => {
  const value = record[key];
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new FoliageSelectionContractError(`${label} ${key} must be a nonnegative number`);
  }
  return value;
};

const requireScore = (record: JsonRecord, key: string, label: string): 0 | 1 | 2 => {
  const value = record[key];
  if (value !== 0 && value !== 1 && value !== 2) {
    throw new FoliageSelectionContractError(`${label} ${key} must be 0, 1, or 2`);
  }
  return value;
};

const requireSha256 = (record: JsonRecord, key: string, label: string): string => {
  const value = requireString(record, key, label);
  if (!/^[0-9a-f]{64}$/u.test(value)) {
    throw new FoliageSelectionContractError(`${label} ${key} must be a lowercase sha256`);
  }
  return value;
};

const isTreeStumpKey = (value: string): value is (typeof TREE_STUMP_KEYS)[number] =>
  TREE_STUMP_KEYS.some((candidate) => candidate === value);

const parseRubric = (value: unknown, label: string): SelectionRubric => {
  const record = requireRecord(value, label);
  const scores = {
    trunkGroundContact: requireScore(record, "trunkGroundContact", label),
    silhouette: requireScore(record, "silhouette", label),
    lightingVariation: requireScore(record, "lightingVariation", label),
    referenceStyle: requireScore(record, "referenceStyle", label),
  };
  const expectedTotal = scores.trunkGroundContact + scores.silhouette + scores.lightingVariation + scores.referenceStyle;
  const total = requireNonnegativeNumber(record, "total", label);
  if (total !== expectedTotal) throw new FoliageSelectionContractError(`${label} total must equal ${expectedTotal}`);
  return { ...scores, total };
};

const parseFoliageCandidate = (value: unknown, key: (typeof TREE_STUMP_KEYS)[number]): FoliageCandidate => {
  const record = requireRecord(value, `${key} candidate`);
  const candidate = requirePositiveInteger(record, "candidate", key);
  return {
    candidate,
    seed: requirePositiveInteger(record, "seed", `${key} candidate ${candidate}`),
    path: requireString(record, "path", `${key} candidate ${candidate}`),
    sha256: requireSha256(record, "sha256", `${key} candidate ${candidate}`),
    width: requirePositiveInteger(record, "width", `${key} candidate ${candidate}`),
    height: requirePositiveInteger(record, "height", `${key} candidate ${candidate}`),
    palette: requireTrue(record, "palette", `${key} candidate ${candidate}`),
    alpha: requireTrue(record, "alpha", `${key} candidate ${candidate}`),
    transparentBackground: requireTrue(record, "transparentBackground", `${key} candidate ${candidate}`),
    bakedGroundShadowAbsent: requireTrue(record, "bakedGroundShadowAbsent", `${key} candidate ${candidate}`),
    selected: requireBoolean(record, "selected", `${key} candidate ${candidate}`),
    hardRejected: requireBoolean(record, "hardRejected", `${key} candidate ${candidate}`),
    rubric: parseRubric(record["rubric"], `${key} candidate ${candidate} rubric`),
  };
};

const parseSelectionWithCandidateCount = (entry: unknown, candidateCount: number): FoliageSelection => {
  const record = requireRecord(entry, "foliage selection");
  const key = requireString(record, "key", "foliage selection");
  if (!isTreeStumpKey(key)) throw new FoliageSelectionContractError(`${key} is not a tree or stump selection key`);
  if (record["tieBreak"] !== "lowest-seed") throw new FoliageSelectionContractError(`${key} tieBreak must be lowest-seed`);
  const rawCandidates = record["candidates"];
  if (!Array.isArray(rawCandidates) || rawCandidates.length !== candidateCount) {
    throw new FoliageSelectionContractError(`${key} candidates must contain exactly ${candidateCount}`);
  }
  const candidates = rawCandidates.map((candidate) => parseFoliageCandidate(candidate, key));
  candidates.forEach((candidate, index) => {
    const expectedCandidate = index + 1;
    if (candidate.candidate !== expectedCandidate) {
      throw new FoliageSelectionContractError(`${key} candidate sequence must be 1 through ${candidateCount}`);
    }
    const spec = FOLIAGE_SPECS[key];
    if (candidate.width !== spec.width || candidate.height !== spec.height) {
      throw new FoliageSelectionContractError(`${key} candidate ${candidate.candidate} dimensions must be ${spec.width}x${spec.height}`);
    }
    const expectedPath = `raw/foliage/${key}_${String(candidate.candidate).padStart(2, "0")}.png`;
    if (candidate.path !== expectedPath) {
      throw new FoliageSelectionContractError(`${key} candidate ${candidate.candidate} path must be ${expectedPath}`);
    }
  });
  const selected = candidates.filter((candidate) => candidate.selected);
  if (selected.length !== 1) throw new FoliageSelectionContractError(`${key} must select exactly one candidate`);
  const selectedCandidate = requirePositiveInteger(record, "selectedCandidate", key);
  if (selected[0]?.candidate !== selectedCandidate) {
    throw new FoliageSelectionContractError(`${key} selectedCandidate must match selected flag`);
  }
  const bestScore = Math.max(...candidates.map((candidate) => candidate.rubric.total));
  const lowestSeedAmongBest = Math.min(
    ...candidates.filter((candidate) => candidate.rubric.total === bestScore).map((candidate) => candidate.seed),
  );
  if (selected[0]?.rubric.total !== bestScore || selected[0].seed !== lowestSeedAmongBest) {
    throw new FoliageSelectionContractError(`${key} selected candidate must use lowest seed among top score`);
  }
  return { key, selectedCandidate, candidates, tieBreak: "lowest-seed" };
};

export const parseFoliageSelectionContract = (entry: unknown): FoliageSelection =>
  parseSelectionWithCandidateCount(entry, FOLIAGE_CANDIDATE_COUNT);

export const parsePhase10SurfaceFoliageSelection = (entry: unknown): FoliageSelection =>
  parseSelectionWithCandidateCount(entry, PHASE10_SURFACE_CANDIDATE_COUNT);
