// UI-AUDIT-1: the geometry audit's scene helpers (scripts/uiGeometryAudit.mjs): the extreme-number state and the map
// points a registry step clicks. Pure, so tests/uiGeometryMeasure.test.ts checks the edited state still passes the save
// codec's ledger rule (the cash balance equals the treasury).

type Inventory = Record<string, number>;
type SceneState = {
  schemaVersion?: number;
  treasuryCoin: number; treasuryTimber: number; population: number;
  ledger?: { entries: { account: string; amount: number }[]; rollups: { account: string; byCategory: Record<string, number> }[] };
  buildings: { kind: string; tx: number; ty: number; inventory: Inventory }[];
  constructionSites: { kind: string; tx: number; ty: number }[];
  walkers: { position?: { tx: number; ty: number } }[];
  persons?: { people: { givenName: string; surname?: string }[]; past?: { givenName: string; surname?: string }[] };
};

export const EXTREME = { cash: 9_999_999, population: 1_234, stock: 99_999 } as const;
/** Names no name list carries (personDisplayName writes them as they are); the Korean stays in this script, outside src. */
export const LONG_NAMES = { given: "바르톨로메오막시밀리안", surname: "드몽고메리펨브로크애슐리" } as const;

/**
 * The same town with its numbers at their widest: cash 9,999,999d (the ledger's last cash entry, or a cash roll-up,
 * takes the difference so the balance stays the treasury), population 1,234, every held stock 99,999, every person
 * (living and past) named with long names.
 */
export function extremeNumbers<T extends SceneState>(input: T): T {
  if (typeof input.schemaVersion === "number") throw new Error("a save envelope (its checksum) cannot be edited");
  const state = structuredClone(input);
  if (state.ledger !== undefined) {
    const sum = state.ledger.entries.filter(entry => entry.account === "cash").reduce((total, entry) => total + entry.amount, 0)
      + state.ledger.rollups.filter(rollup => rollup.account === "cash").reduce((total, rollup) => total + Object.values(rollup.byCategory).reduce((a, b) => a + b, 0), 0);
    const last = [...state.ledger.entries].reverse().find(entry => entry.account === "cash");
    const rollup = state.ledger.rollups.find(item => item.account === "cash" && Object.keys(item.byCategory).length > 0);
    if (last !== undefined) last.amount += EXTREME.cash - sum;
    else if (rollup !== undefined) { const key = Object.keys(rollup.byCategory)[0]!; rollup.byCategory[key]! += EXTREME.cash - sum; }
    else throw new Error("the ledger has no cash entry to carry the treasury");
  }
  state.treasuryCoin = EXTREME.cash;
  state.treasuryTimber = EXTREME.stock;
  state.population = EXTREME.population;
  for (const building of state.buildings) for (const resource of Object.keys(building.inventory)) if ((building.inventory[resource] ?? 0) > 0) building.inventory[resource] = EXTREME.stock;
  for (const person of [...(state.persons?.people ?? []), ...(state.persons?.past ?? [])]) {
    person.givenName = LONG_NAMES.given;
    if (person.surname !== undefined) person.surname = LONG_NAMES.surname;
  }
  return state;
}

/** The camera's tile: the first keep (when asked) or house. */
export function sceneTile(state: Pick<SceneState, "buildings">, kind: "house" | "keep" | undefined): [number, number] {
  const building = (kind === "keep" ? state.buildings.find(item => item.kind === "keep") : undefined) ?? state.buildings.find(item => item.kind === "house") ?? state.buildings[0];
  return building === undefined ? [45, 41] : [building.tx, building.ty];
}

/** A registry map target's tile: the first building of the listed kinds (in list order), the first site, the first walker. */
export function mapTile(state: Pick<SceneState, "buildings" | "constructionSites" | "walkers">,
  target: { readonly building?: readonly string[]; readonly site?: true; readonly walker?: true; readonly offset?: readonly [number, number] }) {
  let tile: { tx: number; ty: number } | null = null;
  for (const kind of target.building ?? []) { const found = state.buildings.find(item => item.kind === kind); if (found) { tile = { tx: found.tx, ty: found.ty }; break; } }
  if (target.site) { const site = state.constructionSites.find(item => item.kind !== "palisade_segment" && item.kind !== "stone_wall_segment"); if (site) tile = { tx: site.tx, ty: site.ty }; }
  if (target.walker) { const walker = state.walkers.find(item => item.position !== undefined); if (walker?.position) tile = { tx: walker.position.tx, ty: walker.position.ty }; }
  if (tile === null) throw new Error(`the scene has no ${JSON.stringify(target)}`);
  const [dx, dy] = target.offset ?? [0, 0];
  return { tx: tile.tx + dx, ty: tile.ty + dy };
}
