/**
 * LM-E9b (spec docs/design/registry.md ER-14): the content canon v4's expression language (READ_MODEL.json `dsl`) —
 * field paths, literals, comparisons, all/any/not, exists, the allow-listed engine reads, READ_MODEL's derived values and
 * the operations. No reflection and no eval: a node, call, derived value or selector outside the lists is reported by
 * `expressionProblem` (the entry is blocked at load, ER-17) and evaluates as missing.
 *
 * Missing (`MISSING`) is not null: every comparison with a missing side is false (neq too); only `exists` looks at it.
 * A command argument may read `result.previousCommand` (R4: the previous command of the same choice, ER-16).
 */
import type { Building, BuildingKind } from "../content/buildingConfig";
import { V4_DERIVED } from "../content/registry/v4Entries.generated";
import { availableStock, storageCapacityBlock } from "../economy/storage";
import { buildingFootprintDistance } from "../geometry/buildingDistance";
import { treasuryBalance } from "../ledger/ledger";
import { allocateHouseServices } from "../population/serviceAllocation";
import { autoplayBuildAction } from "./autoplay";
import type { GameState } from "./engine.types";
import { estatesOf } from "./estates";
import { heirCandidates } from "./legacy";
import { rightHeld } from "./lordshipState";
import { completedMarkets } from "./marketSettlement";
import { marriageCandidates, marriageGrooms, marriageRefusal } from "./marriage";
import { debtInstalmentCap, diplomacyOf, jointurePiece } from "./negotiation";
import { famineStatus, stallFeePermille } from "./politics";
import { stateCalendar } from "./scenarioState";
import { attention, heldOffMapEstates, lordEstatePetitions, nextMichaelmas } from "./stewardship";
import { timberTradeMarket, timberTradePoint } from "./timberTrade";
import { waitingTimberNeed } from "./autoplayTimberDemand";
import { subsidyRefusal } from "./townAgency";

export const MISSING: unique symbol = Symbol("missing");
export type Value = unknown;

export interface Scope {
  readonly state: GameState;
  /** The entry's bound targets by name (`bound.<name>`). */
  readonly bound: Readonly<Record<string, unknown>>;
  /** Item names in scope (`item`, a filter's `as`, a derived value's `arg`). */
  readonly vars: Readonly<Record<string, unknown>>;
}

type Call = (...args: unknown[]) => unknown;
const num = (value: unknown) => (typeof value === "number" ? value : NaN);
/** ER-14: the engine reads an expression may call (READ_MODEL `engineCalls`), each with its arguments in order. */
export const ENGINE_CALLS: Readonly<Record<string, Call>> = {
  stateCalendar: state => stateCalendar(state as GameState),
  heldOffMapEstates: state => heldOffMapEstates(state as GameState),
  estatesOf: state => estatesOf(state as GameState),
  attention: state => attention(state as GameState),
  nextMichaelmas: tick => nextMichaelmas(num(tick)),
  lordEstatePetitions: state => lordEstatePetitions(state as GameState),
  subsidyRefusal: (state, kind, amount) => subsidyRefusal(state as GameState, kind as BuildingKind, num(amount)),
  treasuryBalance: state => treasuryBalance(state as GameState),
  waitingTimberNeed: state => waitingTimberNeed(state as GameState),
  availableStock: (building, resource) => availableStock(building as Building, resource as Parameters<typeof availableStock>[1]),
  storageCapacityBlock: (buildings, resource) => storageCapacityBlock(buildings as readonly Building[], resource as Parameters<typeof storageCapacityBlock>[1]),
  allocateHouseServices: state => allocateHouseServices(state as GameState),
  buildingFootprintDistance: (left, right) => buildingFootprintDistance(left as Building, right as Building),
  timberTradeMarket: state => timberTradeMarket(state as GameState),
  timberTradePoint: state => timberTradePoint(state as GameState),
  autoplayBuildAction: (state, kind) => autoplayBuildAction(state as GameState, kind as BuildingKind),
  marriageCandidates: (state, groomId) => marriageCandidates(state as GameState, groomId as string | undefined),
  jointurePiece: state => jointurePiece(state as GameState),
  completedMarkets: buildings => completedMarkets(buildings as readonly Building[]),
  rightHeld: (state, id) => rightHeld(state as GameState, id as Parameters<typeof rightHeld>[1]),
  stallFeePermille: state => stallFeePermille(state as GameState),
  famineStatus: state => famineStatus(state as GameState),
  marriageGrooms: state => marriageGrooms(state as GameState),
  marriageRefusal: (state, terms, groomId) => marriageRefusal(state as GameState, terms as Parameters<typeof marriageRefusal>[1], groomId as string | undefined),
  heirCandidates: state => heirCandidates(state as GameState),
  diplomacyOf: state => diplomacyOf(state as GameState),
  debtInstalmentCap: state => debtInstalmentCap(state as GameState),
};

/** ER-14: the selector roots (`selectors.<name>`): each an engine read of the state (a kind for the build action). */
const SELECTORS = new Set(["stateCalendar", "estatesOf", "attention", "autoplayBuildAction"]);
const OPERATIONS = new Set(["add", "subtract", "multiply", "divide", "floor", "max", "min", "coalesce", "count", "sum", "project", "mapGet", "first", "findBy"]);
const COMPARISONS = new Set(["eq", "neq", "gt", "gte", "lt", "lte", "in", "contains", "contains_all", "none_in", "not_contains", "has_year_inclusive"]);

interface DerivedSpec { readonly parameters: readonly string[]; readonly expression: unknown }
const DERIVED = V4_DERIVED as Readonly<Record<string, DerivedSpec>>;

// --- per-state memo of the costly reads -------------------------------------------------------------------------------
// The selectors and engine calls read only the state they are given; one season's draw evaluates many entries on the
// same state object, so their results are kept per state object (a WeakMap: a new state is a new key; nothing outlives it).
const memo = new WeakMap<GameState, Map<string, unknown>>();
function remembered(state: GameState, key: string, read: () => unknown): unknown {
  let cache = memo.get(state);
  if (cache === undefined) { cache = new Map(); memo.set(state, cache); }
  if (!cache.has(key)) cache.set(key, read());
  return cache.get(key);
}

function step(value: unknown, segment: string): unknown {
  if (value === MISSING || value === null || value === undefined) return MISSING;
  if (value instanceof Map) return value.has(segment) ? value.get(segment) : MISSING;
  if (typeof value === "object" && Object.prototype.hasOwnProperty.call(value, segment)) {
    const next = (value as Record<string, unknown>)[segment];
    return next === undefined ? MISSING : next;
  }
  if (Array.isArray(value) && segment === "length") return value.length;
  return MISSING;
}

/** A dotted path from a root: state, bound.<name>, selectors.<name>, or an item name in scope. */
export function readPath(path: string, scope: Scope): unknown {
  const [root, ...rest] = path.split(".");
  let value: unknown;
  if (root === "state") value = scope.state;
  else if (root === "bound") {
    const [name, ...more] = rest;
    if (name === undefined) return MISSING;
    value = Object.prototype.hasOwnProperty.call(scope.bound, name) ? scope.bound[name] : MISSING;
    rest.splice(0, rest.length, ...more);
  } else if (root === "selectors") {
    const [name, ...more] = rest;
    if (name === undefined || !SELECTORS.has(name)) return MISSING;
    if (name === "autoplayBuildAction") {
      const [kind, ...after] = more;
      if (kind === undefined) return MISSING;
      value = remembered(scope.state, `selector:${name}:${kind}`, () => autoplayBuildAction(scope.state, kind as BuildingKind));
      rest.splice(0, rest.length, ...after);
    } else {
      value = remembered(scope.state, `selector:${name}`, () => ENGINE_CALLS[name]!(scope.state));
      rest.splice(0, rest.length, ...more);
    }
  } else if (root !== undefined && Object.prototype.hasOwnProperty.call(scope.vars, root)) value = scope.vars[root];
  else return MISSING;
  for (const segment of rest) value = step(value, segment);
  return value;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const same = (left: unknown, right: unknown) => left === right || (typeof left === "object" && typeof right === "object" && JSON.stringify(left) === JSON.stringify(right));
const list = (value: unknown): readonly unknown[] | null => (Array.isArray(value) ? value : null);

function compare(op: string, left: unknown, right: unknown): boolean {
  if (left === MISSING || right === MISSING) return false;
  switch (op) {
    case "eq": return same(left, right);
    case "neq": return !same(left, right);
    case "gt": return typeof left === "number" && typeof right === "number" && left > right;
    case "gte": return typeof left === "number" && typeof right === "number" && left >= right;
    case "lt": return typeof left === "number" && typeof right === "number" && left < right;
    case "lte": return typeof left === "number" && typeof right === "number" && left <= right;
    case "in": return list(right)?.some(item => same(item, left)) === true;
    case "contains": return list(left)?.some(item => same(item, right)) === true || (typeof left === "string" && typeof right === "string" && left.includes(right));
    case "not_contains": { const items = list(left); return items !== null && !items.some(item => same(item, right)); }
    case "contains_all": { const items = list(left); const wanted = list(right); return items !== null && wanted !== null && wanted.every(want => items.some(item => same(item, want))); }
    case "none_in": { const wanted = list(right); if (wanted === null) return false; const items = list(left) ?? [left]; return !items.some(item => wanted.some(want => same(item, want))); }
    case "has_year_inclusive": {
      const year = isRecord(left) ? left.year : left;
      const range = list(right);
      return typeof year === "number" && range !== null && typeof range[0] === "number" && typeof range[1] === "number" && year >= range[0] && year <= range[1];
    }
  }
  return false;
}

function collection(spec: unknown, scope: Scope): readonly unknown[] | typeof MISSING {
  const value = evaluate(spec, scope);
  return Array.isArray(value) ? value : MISSING;
}

function withVar(scope: Scope, name: string, value: unknown): Scope {
  return { ...scope, vars: { ...scope.vars, [name]: value } };
}

/** ER-14: an expression's value (MISSING when a path or a read has none). */
export function evaluate(expression: unknown, scope: Scope): Value {
  if (!isRecord(expression)) return MISSING;
  if ("literal" in expression) return expression.literal;
  if ("field" in expression && typeof expression.field === "string") return readPath(expression.field, scope);
  if ("binding" in expression && typeof expression.binding === "string") {
    const value = readPath(expression.binding, scope);
    return value === MISSING && "default" in expression ? expression.default : value;
  }
  if ("compare" in expression && isRecord(expression.compare)) {
    const { left, op, right } = expression.compare;
    return typeof op === "string" && compare(op, evaluate(left, scope), evaluate(right, scope));
  }
  if ("all" in expression && Array.isArray(expression.all)) return expression.all.every(item => evaluate(item, scope) === true);
  if ("any" in expression && Array.isArray(expression.any)) return expression.any.some(item => evaluate(item, scope) === true);
  if ("not" in expression) return evaluate(expression.not, scope) !== true;
  if ("exists" in expression) { const value = evaluate(expression.exists, scope); return value !== MISSING && value !== undefined; }
  if ("call" in expression && typeof expression.call === "string") {
    const read = ENGINE_CALLS[expression.call];
    const args = (Array.isArray(expression.args) ? expression.args : []).map(arg => evaluate(arg, scope));
    if (read === undefined || args.some(arg => arg === MISSING)) return MISSING;
    // A call on the state alone is memoised per state object (the same read within one season's draw).
    const onState = args.length === 1 && args[0] === scope.state;
    const result = onState ? remembered(scope.state, `call:${expression.call}`, () => read(...args)) : read(...args);
    return result === undefined ? MISSING : result;
  }
  if ("derived" in expression && typeof expression.derived === "string") {
    const spec = DERIVED[expression.derived];
    if (spec === undefined) return MISSING;
    const args = (Array.isArray(expression.args) ? expression.args : []).map(arg => evaluate(arg, scope));
    const arg = Object.fromEntries(spec.parameters.map((name, index) => [name, args[index] ?? MISSING]));
    return evaluate(spec.expression, withVar(scope, "arg", arg));
  }
  if ("filter" in expression && isRecord(expression.filter)) {
    const { from, as, where } = expression.filter;
    const items = collection(from, scope);
    if (items === MISSING || typeof as !== "string") return MISSING;
    return items.filter(item => evaluate(where, withVar(scope, as, item)) === true);
  }
  if ("map" in expression && isRecord(expression.map)) {
    const { from, as, value } = expression.map;
    const items = collection(from, scope);
    if (items === MISSING || typeof as !== "string") return MISSING;
    return items.map(item => evaluate(value, withVar(scope, as, item))).filter(item => item !== MISSING);
  }
  if ("every" in expression && isRecord(expression.every)) {
    const { from, as, where } = expression.every;
    const items = collection(from, scope);
    if (items === MISSING || typeof as !== "string") return false;
    return items.every(item => evaluate(where, withVar(scope, as, item)) === true);
  }
  if ("operation" in expression && typeof expression.operation === "string") return operate(expression.operation, Array.isArray(expression.args) ? expression.args : [], scope);
  return MISSING;
}

function numbers(values: readonly unknown[]): number[] | null {
  const out: number[] = [];
  for (const value of values) {
    if (Array.isArray(value)) { const inner = numbers(value); if (inner === null) return null; out.push(...inner); continue; }
    if (typeof value !== "number") return null;
    out.push(value);
  }
  return out;
}

function operate(operation: string, argSpecs: readonly unknown[], scope: Scope): Value {
  const args = argSpecs.map(arg => evaluate(arg, scope));
  if (operation === "coalesce") return args.find(arg => arg !== MISSING && arg !== null) ?? MISSING;
  if (args.some(arg => arg === MISSING)) return MISSING;
  switch (operation) {
    case "count": { const items = list(args[0]); return items === null ? MISSING : items.length; }
    case "sum": { const values = numbers(args); return values === null ? MISSING : values.reduce((total, value) => total + value, 0); }
    case "max": case "min": {
      const values = numbers(args);
      if (values === null || values.length === 0) return MISSING;
      return operation === "max" ? Math.max(...values) : Math.min(...values);
    }
    case "add": case "subtract": case "multiply": case "divide": {
      const [left, right] = args;
      if (typeof left !== "number" || typeof right !== "number") return MISSING;
      if (operation === "add") return left + right;
      if (operation === "subtract") return left - right;
      if (operation === "multiply") return left * right;
      return right === 0 ? MISSING : left / right;
    }
    case "floor": return typeof args[0] === "number" ? Math.floor(args[0]) : MISSING;
    case "project": {
      const [object, path] = args;
      if (typeof path !== "string") return MISSING;
      let value: unknown = object;
      for (const segment of path.split(".")) value = step(value, segment);
      return value;
    }
    case "mapGet": {
      const [map, key] = args;
      if (map instanceof Map) return map.has(key) ? map.get(key) : null;
      if (isRecord(map) && typeof key === "string") return Object.prototype.hasOwnProperty.call(map, key) ? map[key] : null;
      return MISSING;
    }
    case "first": { const items = list(args[0]); return items === null ? MISSING : items[0] ?? null; }
    case "findBy": {
      const [items, field, value] = args;
      const found = list(items);
      if (found === null || typeof field !== "string") return MISSING;
      return found.find(item => isRecord(item) && same(item[field], value)) ?? null;
    }
  }
  return MISSING;
}

/** ER-14, ER-17: why an expression cannot run here — an unknown node, operation, comparison, call, derived value or selector (null when it can). */
export function expressionProblem(expression: unknown): string | null {
  if (Array.isArray(expression)) { for (const item of expression) { const problem = expressionProblem(item); if (problem !== null) return problem; } return null; }
  if (!isRecord(expression)) return null;
  if ("call" in expression && typeof expression.call === "string" && ENGINE_CALLS[expression.call] === undefined) return `call ${expression.call}`;
  if ("derived" in expression && typeof expression.derived === "string" && DERIVED[expression.derived] === undefined) return `derived ${expression.derived}`;
  if ("operation" in expression && typeof expression.operation === "string" && !OPERATIONS.has(expression.operation)) return `operation ${expression.operation}`;
  if ("compare" in expression && isRecord(expression.compare) && typeof expression.compare.op === "string" && !COMPARISONS.has(expression.compare.op)) return `compare ${expression.compare.op}`;
  if ("field" in expression && typeof expression.field === "string" && expression.field.startsWith("selectors.")) {
    const name = expression.field.split(".")[1];
    if (name === undefined || !SELECTORS.has(name)) return `selector ${expression.field}`;
  }
  for (const value of Object.values(expression)) { const problem = expressionProblem(value); if (problem !== null) return problem; }
  return null;
}

/** ER-14: whether a condition holds (a non-true value is false). */
export const holds = (condition: unknown, scope: Scope): boolean => condition === undefined || evaluate(condition, scope) === true;
