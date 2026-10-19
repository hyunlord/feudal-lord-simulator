// VIS-1: what changed in the engine's state season by season over the browser run (scripts/visibleChangeRun.mjs's
// states/*.json.gz): the town (people, houses by level, buildings, sites, the palisade, the era), money (coin, timber),
// relations (factions), rights and holdings (estates' pieces held, claims, suits), the family (the lord's house, births,
// deaths, marriages, succession), the steward, the town's requests. Each season: the facts, and the changes from the season
// before (a change = a value that moved, a thing that came or went). Reads only the saved states.
//   tsx scripts/visibleChangeFacts.ts <run out> > facts.json
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";

// Saved states read as plain JSON.
type Any = any;

const [out] = process.argv.slice(2);
if (out === undefined) throw new Error("usage: visibleChangeFacts.ts <run out>");
const dir = join(out, "states");
const names = readdirSync(dir).filter(name => name.endsWith(".json.gz")).map(name => name.replace(/\.json\.gz$/, ""))
  .sort((a, b) => (a.endsWith("-start") ? -1 : b.endsWith("-start") ? 1 : a.endsWith("-end") ? 1 : b.endsWith("-end") ? -1 : a.localeCompare(b)));

const count = <T>(items: readonly T[], key: (item: T) => string) => items.reduce<Record<string, number>>((acc, item) => { const k = key(item); acc[k] = (acc[k] ?? 0) + 1; return acc; }, {});

function facts(state: Any) {
  const people: Any[] = state.persons?.people ?? [];
  const alive = people.filter(p => p.alive !== false);
  const lordLineage = (state.persons?.lineages ?? []).find((l: Any) => l.kind === "lord")?.id ?? null;
  const lord = people.find(p => p.role === "lord" || p.occupation === "lord") ?? null;
  const gentry = people.filter(p => p.classBand === "gentry" || (lord !== null && (p.householdId === lord.householdId)));
  const homePieces = (state.estates?.estates ?? []).flatMap((e: Any) => (e.pieces ?? []).map((piece: Any) => ({ estate: e.id, ...piece })));
  return {
    tick: state.tick,
    era: state.era, proclaimed: state.eraProclaimedTick ?? null,
    population: state.population, idle: state.idleWorkers,
    houses: state.houses?.length ?? 0, houseLevels: count(state.houses ?? [], (h: Any) => `L${h.level}`),
    buildings: count((state.buildings ?? []).filter((b: Any) => b.kind !== "house"), (b: Any) => b.kind),
    sites: count(state.constructionSites ?? [], (s: Any) => s.kind), stalledSites: (state.constructionSites ?? []).filter((s: Any) => s.stall !== undefined && s.stall !== "none").length,
    palisade: state.palisade === null || state.palisade === undefined ? null : { segments: state.palisade.segments?.length ?? null,
      // LS1-16: the engine marks a finished segment `completed` (the check-up run read a field it never sets: 0 always).
      built: (state.palisade.segments ?? []).filter((s: Any) => s.completed === true).length,
      left: (state.constructionSites ?? []).filter((s: Any) => s.kind === "palisade_segment" || s.kind === "stone_wall_segment").length },
    coin: state.treasuryCoin, timber: state.treasuryTimber,
    relations: Object.fromEntries((state.factions?.factions ?? []).map((f: Any) => [`${f.kind}:${f.name}`, f.relation])),
    held: homePieces.filter((p: Any) => p.possessor === "lord").map((p: Any) => p.id).sort(),
    titled: homePieces.filter((p: Any) => p.titleHolder === "lord").map((p: Any) => p.id).sort(),
    estates: (state.estates?.estates ?? []).map((e: Any) => e.id).sort(),
    claims: Object.fromEntries((state.estates?.claims ?? []).map((c: Any) => [c.id, `${c.claimant}→${c.pieceId} ${c.status} ${c.strength}`])),
    suits: Object.fromEntries((state.estates?.suits ?? []).map((s: Any) => [s.id, `${s.plaintiff}→${s.defendant} ${s.pieceId} ${s.stage}${s.outcome ? ` ${s.outcome}` : ""}`])),
    rights: (state.politics?.rights ?? []).map((r: Any) => r.id ?? r.kind ?? JSON.stringify(r).slice(0, 60)),
    lord: lord === null ? null : `${lord.givenName} ${lord.surname} (${lord.birthYear})`, lordLineage,
    family: gentry.filter(p => p.alive !== false).map(p => `${p.givenName} ${p.surname} ${p.role ?? p.occupation} ${p.birthYear}${p.spouseId ? " wed" : ""}`).sort(),
    people: alive.length, dead: (state.persons?.past?.length ?? 0) + people.filter(p => p.alive === false).length,
    steward: (state.stewardship?.stewards ?? []).map((s: Any) => `${s.id ?? s.personId} ${s.estateId ?? ""} ${s.loyalty ?? ""}`),
    petitions: count(state.stewardship?.petitions ?? [], (p: Any) => `${p.status}${p.decidedBy ? `/${p.decidedBy}` : ""}`),
    requests: (state.agency?.requests ?? []).map((r: Any) => `${r.kind} ${r.status ?? ""}`),
    decisions: state.politics?.decisions?.length ?? 0,
  };
}

/** What moved from one season to the next, as readable lines. */
function changes(before: ReturnType<typeof facts>, after: ReturnType<typeof facts>): string[] {
  const lines: string[] = [];
  const num = (key: string, a: number, b: number) => { if (a !== b) lines.push(`${key} ${a} → ${b} (${b - a > 0 ? "+" : ""}${b - a})`); };
  const map = (key: string, a: Record<string, unknown>, b: Record<string, unknown>) => {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) lines.push(`${key} ${k}: ${a[k] ?? "—"} → ${b[k] ?? "—"}`);
  };
  const list = (key: string, a: readonly string[], b: readonly string[]) => {
    const gone = a.filter(x => !b.includes(x)); const came = b.filter(x => !a.includes(x));
    for (const x of came) lines.push(`${key} + ${x}`); for (const x of gone) lines.push(`${key} − ${x}`);
  };
  if (before.era !== after.era) lines.push(`era ${before.era} → ${after.era}`);
  if (before.proclaimed !== after.proclaimed) lines.push(`proclaimed at ${after.proclaimed}`);
  num("population", before.population, after.population); num("houses", before.houses, after.houses);
  map("house level", before.houseLevels, after.houseLevels); map("building", before.buildings, after.buildings); map("site", before.sites, after.sites);
  num("stalled sites", before.stalledSites, after.stalledSites);
  if (JSON.stringify(before.palisade) !== JSON.stringify(after.palisade)) lines.push(`palisade ${JSON.stringify(before.palisade)} → ${JSON.stringify(after.palisade)}`);
  num("coin", before.coin, after.coin); num("timber", before.timber, after.timber);
  map("relation", before.relations, after.relations);
  list("held", before.held, after.held); list("title", before.titled, after.titled); list("estate", before.estates, after.estates);
  map("claim", before.claims, after.claims); map("suit", before.suits, after.suits); list("right", before.rights, after.rights);
  if (before.lord !== after.lord) lines.push(`lord ${before.lord} → ${after.lord}`);
  list("family", before.family, after.family); num("dead", before.dead, after.dead);
  list("steward", before.steward, after.steward); map("petitions", before.petitions, after.petitions); list("request", before.requests, after.requests);
  num("decisions", before.decisions, after.decisions);
  return lines;
}

const seasons = names.map(name => ({ name, facts: facts(JSON.parse(gunzipSync(readFileSync(join(dir, `${name}.json.gz`))).toString("utf8"))) }));
const report = seasons.map((season, index) => ({ ...season, changes: index === 0 ? [] : changes(seasons[index - 1]!.facts, season.facts) }));
process.stdout.write(JSON.stringify(report, null, 1));
