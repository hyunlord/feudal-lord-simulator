/**
 * LM-E9 (ER-10): content drafts v2's new events (docs/design/content-drafts-20261002/v2/events.json) as registry entries.
 * Only drafts whose conditions read unambiguously as the registry's read model, and whose choices are commands the
 * registry carries, are here; the rest are listed with their reason in docs/verification/lm-e9/AMBIGUOUS.md for the
 * content session (the user's decision 2026-10-03). The drafts' own framing ("가공 배경", "편집 전제" that a paper
 * exists) sets no condition. Frequencies: the drafts' registry example (chance 500, weight 2, gap 8 seasons, one a
 * year); `allowed: false` is once per target; a cooldown range in years takes its lower end. Words: registryCopy.ko.ts.
 */
import type { RegistryCondition, RegistryEntry } from "./registryTypes";

const FREQUENCY = { chancePermille: 500, weight: 2, minGapSeasons: 8, maxPerYear: 1 } as const;
const ONCE_PER_TARGET = { mode: "once_per_target", cooldownSeasons: 0, maxOccurrences: 1_000 } as const;
const cooldownYears = (years: number) => ({ mode: "cooldown" as const, cooldownSeasons: years * 4, maxOccurrences: 3 });
const treasuryAtLeast = (pennies: number): RegistryCondition => ({ field: "treasury", op: "gte", value: pennies });
const suitTakesEvidence: RegistryCondition = { field: "bound.suitStage", op: "in", value: ["filed", "evidence"] };
const lacks = (kind: string): RegistryCondition => ({ field: "bound.evidence", op: "lacks", value: kind });

export const DRAFT_EVENT_ENTRIES: readonly RegistryEntry[] = [
  { id: "ck_evt_005", kind: "event", source: "content drafts v2", years: { fromYear: 1304, toYear: 1318 },
    conditions: { all: [{ field: "market.exists", op: "eq", value: true }, { field: "market.duesPermille", op: "eq", value: 1000 }] },
    frequency: FREQUENCY, recurrence: cooldownYears(7), sender: "merchant_house_1", bind: "none",
    choices: [{ id: "a", effects: [{ command: "set_market_dues", permille: 750 }] }, { id: "b", effects: [{ command: "set_market_dues", permille: 1250 }] },
      { id: "c", effects: [{ command: "none" }] }],
    precedent: false, artId: null },
  { id: "ck_evt_009", kind: "event", source: "content drafts v2", years: { fromYear: 1324, toYear: 1347 },
    conditions: { all: [suitTakesEvidence, lacks("charter"), lacks("deed"), lacks("court_roll"), treasuryAtLeast(40)] },
    frequency: FREQUENCY, recurrence: ONCE_PER_TARGET, sender: "bishop", bind: "open_suit",
    choices: [{ id: "a", effects: [{ command: "add_suit_evidence", evidence: "charter" }] }, { id: "b", effects: [{ command: "add_suit_evidence", evidence: "deed" }] },
      { id: "c", effects: [{ command: "add_suit_evidence", evidence: "court_roll" }] }],
    precedent: false, artId: null },
  { id: "ck_evt_013", kind: "event", source: "content drafts v2", years: { fromYear: 1321, toYear: 1347 },
    conditions: { all: [{ field: "bound.revealedKept", op: "gte", value: 1 }, { field: "bound.stewardConnected", op: "eq", value: true }, { field: "bound.stewardLoyalty", op: "lte", value: 90 }] },
    frequency: FREQUENCY, recurrence: cooldownYears(7), exclusiveGroup: "steward_audit", sender: "commons", bind: "pending_audit",
    choices: [{ id: "a", effects: [{ command: "answer_audit", choice: "punish" }] }, { id: "b", effects: [{ command: "answer_audit", choice: "tolerate" }] },
      { id: "c", effects: [{ command: "answer_audit", choice: "replace" }] }],
    precedent: false, artId: null },
  { id: "ck_evt_027", kind: "event", source: "content drafts v2", years: { fromYear: 1356, toYear: 1358 },
    conditions: { field: "agency.policy", op: "in", value: ["stability", "revenue"] },
    frequency: FREQUENCY, recurrence: ONCE_PER_TARGET, sender: "crown", bind: "none",
    choices: [{ id: "defence", effects: [{ command: "set_estate_policy", policy: "defence" }] }, { id: "growth", effects: [{ command: "set_estate_policy", policy: "growth" }] },
      { id: "supply", effects: [{ command: "order_timber", amount: 8 }], requires: { all: [{ field: "market.exists", op: "eq", value: true }, { field: "timber.order", op: "eq", value: 0 }] } }],
    precedent: false, artId: null },
  { id: "ck_evt_032", kind: "event", source: "content drafts v2", years: { fromYear: 1367, toYear: 1369 },
    conditions: { all: [suitTakesEvidence, lacks("charter"), lacks("court_roll")] },
    frequency: FREQUENCY, recurrence: ONCE_PER_TARGET, sender: "lord", bind: "open_suit",
    choices: [{ id: "charter", effects: [{ command: "add_suit_evidence", evidence: "charter" }], requires: treasuryAtLeast(40) },
      { id: "roll", effects: [{ command: "add_suit_evidence", evidence: "court_roll" }], requires: treasuryAtLeast(20) },
      { id: "both", effects: [{ command: "add_suit_evidence", evidence: "charter" }, { command: "add_suit_evidence", evidence: "court_roll" }], requires: treasuryAtLeast(60) }],
    precedent: false, artId: null },
  { id: "ck_evt_033", kind: "event", source: "content drafts v2", years: { fromYear: 1371, toYear: 1373 },
    conditions: { all: [suitTakesEvidence, lacks("deed"), lacks("witnesses")] },
    frequency: FREQUENCY, recurrence: ONCE_PER_TARGET, sender: "bishop", bind: "open_suit",
    choices: [{ id: "deed", effects: [{ command: "add_suit_evidence", evidence: "deed" }], requires: treasuryAtLeast(30) },
      { id: "witnesses", effects: [{ command: "add_suit_evidence", evidence: "witnesses" }], requires: treasuryAtLeast(24) },
      { id: "both", effects: [{ command: "add_suit_evidence", evidence: "deed" }, { command: "add_suit_evidence", evidence: "witnesses" }], requires: treasuryAtLeast(54) }],
    precedent: false, artId: null },
  { id: "ck_evt_034", kind: "event", source: "content drafts v2", years: { fromYear: 1372, toYear: 1374 },
    conditions: { all: [{ field: "estates.delegated", op: "gte", value: 1 }, { field: "steward.lordDecided", op: "gte", value: 1 }] },
    frequency: FREQUENCY, recurrence: ONCE_PER_TARGET, sender: "commons", bind: "none",
    choices: [{ id: "precedent", effects: [{ command: "set_exception_rules", recurring: false }] }, { id: "hear", effects: [{ command: "set_exception_rules", recurring: true }] },
      { id: "rights_only", effects: [{ command: "set_exception_rules", amountAtLeast: null }], requires: { field: "steward.rules.amountAtLeast", op: "gte", value: 0 } }],
    precedent: false, artId: null },
  { id: "ck_evt_038", kind: "event", source: "content drafts v2", years: { fromYear: 1378, toYear: 1381 },
    conditions: { field: "bound.suitStage", op: "eq", value: "enforcing" },
    frequency: FREQUENCY, recurrence: ONCE_PER_TARGET, sender: "lord", bind: "open_suit",
    choices: [{ id: "enforce", effects: [{ command: "enforce_possession" }], requires: treasuryAtLeast(80) }, { id: "defer", effects: [{ command: "none" }] }],
    precedent: false, artId: null },
  { id: "ck_evt_050", kind: "event", source: "content drafts v2", years: { fromYear: 1409, toYear: 1414 },
    frequency: FREQUENCY, recurrence: cooldownYears(6), sender: "commons", bind: "none",
    choices: [{ id: "stability", effects: [{ command: "set_estate_policy", policy: "stability" }] }, { id: "growth", effects: [{ command: "set_estate_policy", policy: "growth" }] },
      { id: "revenue", effects: [{ command: "set_estate_policy", policy: "revenue" }] }],
    precedent: false, artId: null },
  { id: "ck_evt_052", kind: "event", source: "content drafts v2", years: { fromYear: 1415, toYear: 1420 },
    conditions: { all: [{ field: "bound.revealedKept", op: "gte", value: 1 }, { field: "bound.stewardConnected", op: "eq", value: true }, { field: "bound.stewardLoyalty", op: "lte", value: 99 }] },
    frequency: FREQUENCY, recurrence: cooldownYears(6), exclusiveGroup: "steward_audit", sender: "commons", bind: "pending_audit",
    choices: [{ id: "punish", effects: [{ command: "answer_audit", choice: "punish" }] }, { id: "replace", effects: [{ command: "answer_audit", choice: "replace" }] },
      { id: "tolerate", effects: [{ command: "answer_audit", choice: "tolerate" }] }],
    precedent: false, artId: null },
  { id: "ck_evt_053", kind: "event", source: "content drafts v2", years: { fromYear: 1418, toYear: 1423 },
    conditions: { all: [suitTakesEvidence, lacks("deed"), lacks("court_roll")] },
    frequency: FREQUENCY, recurrence: cooldownYears(6), sender: "lord", bind: "open_suit",
    choices: [{ id: "deed", effects: [{ command: "add_suit_evidence", evidence: "deed" }], requires: treasuryAtLeast(30) },
      { id: "roll", effects: [{ command: "add_suit_evidence", evidence: "court_roll" }], requires: treasuryAtLeast(20) },
      { id: "both", effects: [{ command: "add_suit_evidence", evidence: "deed" }, { command: "add_suit_evidence", evidence: "court_roll" }], requires: treasuryAtLeast(50) }],
    precedent: false, artId: null },
];
