import type { GameState } from "../../engine/engine.types";
import { persons } from "../../engine/personsApi";
import type { NamedLineageKind, Person } from "../../engine/persons.types";
import { SURNAMES_KO } from "../../content/personNames.ko";
import { drawnPortraitId } from "../portraitArt";
import { FAMILY_TREE_COPY } from "./familyTreeCopy.ko";

// UI-7 the biography's family tree (가계도; data PERSON-1a LN-11 `persons.parents`·`children`·`lineage`·`lineageSet`).
// Pure: the screen draws what this returns, in tree pixels (the view scales them).
//  - The tree is one lineage: the person's own, or — for someone married in whose own lineage is only themself — their
//    spouse's (the tree they belong to in the town's eyes).
//  - A unit is a lineage member with the spouses who married in. Those spouses stand beside their member, joined by the
//    marriage link only: they never hang from the parents' branch line (the Wave 25 check picture drew them so, wrongly).
//  - The children's branch comes down from the marriage link (or the member alone), runs along a bar and drops to each
//    child that is a member; a child's own spouse takes no drop.
//  - A member with no parent in the lineage whose role is `child` in a member head's household (a child the save
//    recorded before parents were kept) is that head's child, not a founder of its own.
//  - A unit with children folds (its descendants hidden, a count under it). The player's choice holds; without one, a
//    tree wider than the view folds units off the selected person's line, deepest and widest first, until it fits.

export const TREE = {
  nodeWidth: 112, nodeHeight: 136, spouseGap: 48, siblingGap: 20, rowGap: 64, labelColumn: 104, top: 88, margin: 16,
  /** Branch line thickness (the Wave 25 lines are 8 px, drawn at 6) and the joint pieces (16 px, drawn at 12). */
  line: 6, joint: 12, toggle: 44,
} as const;

export type TreeNodeView = Readonly<{
  personId: string; x: number; y: number; generation: number; outside: boolean; dead: boolean; selected: boolean;
  name: string; years: string; portraitId: string; label: string;
}>;
/** A branch line: horizontal from (x, y) `length` to the right, or vertical `length` down (the line's centre). */
export type TreeLine = Readonly<{ axis: "h" | "v"; x: number; y: number; length: number }>;
/** A joint on the bar, by the ports it joins (Wave 25: corners TL/TR/BL/BR, the T and the T turned up). */
export type TreeJointKind = "corner_tl" | "corner_tr" | "corner_bl" | "corner_br" | "junction_t" | "junction_t_up";
export type TreeJoint = Readonly<{ kind: TreeJointKind; x: number; y: number }>;
export type TreeToggle = Readonly<{ unitId: string; x: number; y: number; open: boolean; hidden: number; label: string }>;
export type FamilyTreeView = Readonly<{
  lineageId: string; banner: string; emblemPersonId: string; width: number; height: number;
  generations: readonly Readonly<{ label: string; y: number }>[];
  nodes: readonly TreeNodeView[]; lines: readonly TreeLine[]; joints: readonly TreeJoint[];
  marriages: readonly Readonly<{ x: number; y: number }>[]; toggles: readonly TreeToggle[];
  /** Units folded to fit (no choice of the player's). */
  autoFolded: readonly string[];
}>;

type Unit = { readonly member: Person; readonly spouses: readonly Person[]; readonly children: readonly Unit[]; readonly generation: number };

function everyone(state: GameState): readonly Person[] {
  return [...(state.persons?.people ?? []), ...(state.persons?.past ?? []), ...(state.factions?.people ?? [])];
}

/** The people who married `person`: the other parent of their children, and their household's head or spouse. */
function partnersOf(all: readonly Person[], person: Person): readonly Person[] {
  const ids = new Set<string>();
  for (const child of all) {
    if (child.fatherId === person.id && child.motherId !== undefined) ids.add(child.motherId);
    if (child.motherId === person.id && child.fatherId !== undefined) ids.add(child.fatherId);
  }
  const partnerRole = person.role === "head" ? "spouse" : person.role === "spouse" ? "head" : null;
  if (partnerRole !== null) for (const other of all) if (other.householdId === person.householdId && other.role === partnerRole && other.id !== person.id) ids.add(other.id);
  return all.filter(other => ids.has(other.id));
}

/** The lineage the tree shows for `person` (see the header). */
function treeLineage(all: readonly Person[], person: Person): string {
  const size = (lineageId: string) => all.filter(other => other.lineageId === lineageId).length;
  if (size(person.lineageId) > 1) return person.lineageId;
  const partner = [...partnersOf(all, person)].sort((a, b) => size(b.lineageId) - size(a.lineageId))[0];
  return partner !== undefined && size(partner.lineageId) > 1 ? partner.lineageId : person.lineageId;
}

function buildUnits(state: GameState, all: readonly Person[], lineageId: string): readonly Unit[] {
  const generations = persons.lineage(state, lineageId);
  const members = generations.flat();
  const memberIds = new Set(members.map(person => person.id));
  const parentOf = new Map<string, string>();
  for (const child of members) {
    const father = child.fatherId !== undefined && memberIds.has(child.fatherId) ? child.fatherId : undefined;
    const mother = child.motherId !== undefined && memberIds.has(child.motherId) ? child.motherId : undefined;
    const head = father ?? mother ?? (child.role === "child" ? members.find(other => other.role === "head" && other.householdId === child.householdId && other.id !== child.id)?.id : undefined);
    if (head !== undefined) parentOf.set(child.id, head);
  }
  const build = (member: Person, generation: number): Unit => {
    const children = members.filter(child => parentOf.get(child.id) === member.id);
    return {
      member, generation,
      spouses: partnersOf(all, member).filter(partner => !memberIds.has(partner.id)).sort((a, b) => a.birthYear - b.birthYear || a.id.localeCompare(b.id)),
      children: children.sort((a, b) => a.birthYear - b.birthYear || a.id.localeCompare(b.id)).map(child => build(child, generation + 1)),
    };
  };
  return members.filter(member => !parentOf.has(member.id)).sort((a, b) => a.birthYear - b.birthYear || a.id.localeCompare(b.id)).map(member => build(member, 0));
}

const unitWidth = (unit: Unit) => TREE.nodeWidth * (1 + unit.spouses.length) + TREE.spouseGap * unit.spouses.length;
const descendants = (unit: Unit): number => unit.children.reduce((sum, child) => sum + 1 + child.spouses.length + descendants(child), 0);
const walk = (units: readonly Unit[]): Unit[] => units.flatMap(unit => [unit, ...walk(unit.children)]);

/** The subtree's width with `folded` units' children hidden. */
function subtreeWidth(unit: Unit, folded: ReadonlySet<string>): number {
  if (unit.children.length === 0 || folded.has(unit.member.id)) return unitWidth(unit);
  const children = unit.children.reduce((sum, child) => sum + subtreeWidth(child, folded), 0) + TREE.siblingGap * (unit.children.length - 1);
  return Math.max(unitWidth(unit), children);
}

/** The units on the selected person's line (their own and every ancestor's), which never fold to fit. */
function lineOf(roots: readonly Unit[], personId: string): ReadonlySet<string> {
  const path = (unit: Unit): string[] | null => {
    if (unit.member.id === personId || unit.spouses.some(spouse => spouse.id === personId)) return [unit.member.id];
    for (const child of unit.children) { const below = path(child); if (below !== null) return [unit.member.id, ...below]; }
    return null;
  };
  for (const root of roots) { const found = path(root); if (found !== null) return new Set(found); }
  return new Set();
}

function years(person: Person): string {
  return FAMILY_TREE_COPY.years(person.birthYear, person.deathYear ?? person.leftYear ?? null, person.alive);
}

/**
 * The tree of `personId`'s lineage. `choices`: the player's fold (false) / unfold (true) per unit; `maxWidth`: the view's
 * width in tree pixels (units fold to fit it; Infinity = never).
 */
export function familyTreeView(state: GameState, personId: string, choices: ReadonlyMap<string, boolean> = new Map(), maxWidth = Infinity): FamilyTreeView | null {
  const all = everyone(state);
  const focus = all.find(person => person.id === personId);
  if (focus === undefined) return null;
  const lineageId = treeLineage(all, focus);
  const roots = buildUnits(state, all, lineageId);
  if (roots.length === 0) return null;
  const units = walk(roots);
  const line = lineOf(roots, personId);
  const folded = new Set(units.filter(unit => choices.get(unit.member.id) === false).map(unit => unit.member.id));
  const rootsWidth = () => roots.reduce((sum, root) => sum + subtreeWidth(root, folded), 0) + TREE.siblingGap * (roots.length - 1);
  const shown = (unit: Unit): boolean => {
    // A unit is shown when no ancestor of it is folded.
    const parent = units.find(candidate => candidate.children.includes(unit));
    return parent === undefined || (!folded.has(parent.member.id) && shown(parent));
  };
  const autoFolded: string[] = [];
  const content = maxWidth - TREE.labelColumn - TREE.margin * 2;
  while (rootsWidth() > content) {
    const candidate = units
      .filter(unit => unit.children.length > 0 && !folded.has(unit.member.id) && !line.has(unit.member.id) && choices.get(unit.member.id) === undefined && shown(unit))
      .sort((a, b) => b.generation - a.generation || subtreeWidth(b, folded) - subtreeWidth(a, folded) || a.member.id.localeCompare(b.member.id))[0];
    if (candidate === undefined) break;
    folded.add(candidate.member.id);
    autoFolded.push(candidate.member.id);
  }

  const nodes: TreeNodeView[] = []; const lines: TreeLine[] = []; const joints: TreeJoint[] = [];
  const marriages: { x: number; y: number }[] = []; const toggles: TreeToggle[] = [];
  const rowY = (generation: number) => TREE.top + generation * (TREE.nodeHeight + TREE.rowGap);
  const node = (person: Person, x: number, generation: number, outside: boolean) => {
    const dead = !person.alive && person.deathYear !== undefined;
    const name = persons.displayName(person);
    nodes.push({ personId: person.id, x, y: rowY(generation), generation, outside, dead, selected: person.id === personId, name, years: years(person),
      portraitId: drawnPortraitId(person, persons.portrait(state, person).portraitId), label: FAMILY_TREE_COPY.node(name, years(person), outside, dead) });
  };
  let deepest = 0;
  /** Lays `unit`'s subtree from `left`; returns the x of the member's centre (the drop's target from its parents). */
  const place = (unit: Unit, left: number): number => {
    deepest = Math.max(deepest, unit.generation);
    const width = subtreeWidth(unit, folded);
    const unitLeft = left + (width - unitWidth(unit)) / 2;
    const y = rowY(unit.generation);
    node(unit.member, unitLeft, unit.generation, false);
    unit.spouses.forEach((spouse, index) => {
      const x = unitLeft + (index + 1) * (TREE.nodeWidth + TREE.spouseGap);
      node(spouse, x, unit.generation, true);
      marriages.push({ x: x - TREE.spouseGap / 2, y: y + TREE.nodeHeight / 2 });
    });
    const memberCentre = unitLeft + TREE.nodeWidth / 2;
    if (unit.children.length === 0) return memberCentre;
    // The branch starts at the first marriage link (the children's parents), or under the member.
    const stemX = unit.spouses.length > 0 ? unitLeft + TREE.nodeWidth + TREE.spouseGap / 2 : memberCentre;
    const stemTop = unit.spouses.length > 0 ? y + TREE.nodeHeight / 2 : y + TREE.nodeHeight;
    const barY = y + TREE.nodeHeight + TREE.rowGap / 2;
    const hidden = descendants(unit);
    if (folded.has(unit.member.id)) {
      lines.push({ axis: "v", x: stemX, y: stemTop, length: y + TREE.nodeHeight + TREE.toggle / 2 - stemTop });
      toggles.push({ unitId: unit.member.id, x: stemX, y: y + TREE.nodeHeight + TREE.toggle / 2, open: false, hidden,
        label: FAMILY_TREE_COPY.expand(persons.displayName(unit.member), hidden) });
      return memberCentre;
    }
    let childLeft = left + (width - (unit.children.reduce((sum, child) => sum + subtreeWidth(child, folded), 0) + TREE.siblingGap * (unit.children.length - 1))) / 2;
    const drops: number[] = [];
    for (const child of unit.children) {
      drops.push(place(child, childLeft));
      childLeft += subtreeWidth(child, folded) + TREE.siblingGap;
    }
    const childTop = rowY(unit.generation + 1);
    lines.push({ axis: "v", x: stemX, y: stemTop, length: barY - stemTop });
    for (const drop of drops) lines.push({ axis: "v", x: drop, y: barY, length: childTop - barY });
    const barLeft = Math.min(stemX, ...drops), barRight = Math.max(stemX, ...drops);
    if (barRight > barLeft) lines.push({ axis: "h", x: barLeft, y: barY, length: barRight - barLeft });
    // Joints where the bar meets the stem and the drops, by the ports each point joins.
    for (const x of new Set([stemX, ...drops])) {
      const left = x > barLeft, right = x < barRight, up = x === stemX, down = drops.includes(x);
      const kind: TreeJointKind | null = left && right ? (down ? "junction_t" : "junction_t_up")
        : right ? (down && up ? null : down ? "corner_tl" : "corner_bl")
        : left ? (down && up ? null : down ? "corner_tr" : "corner_br") : null;
      if (kind !== null) joints.push({ kind, x, y: barY });
      if (left && right && up && down) joints.push({ kind: "junction_t_up", x, y: barY });
    }
    toggles.push({ unitId: unit.member.id, x: stemX, y: barY, open: true, hidden, label: FAMILY_TREE_COPY.collapse(persons.displayName(unit.member), hidden) });
    return memberCentre;
  };
  let left = TREE.labelColumn + TREE.margin;
  for (const root of roots) { place(root, left); left += subtreeWidth(root, folded) + TREE.siblingGap; }
  const named = persons.lineageSet(state, lineageId);
  const founder = roots[0]!.member;
  return {
    lineageId, banner: FAMILY_TREE_COPY.banner(founder.surname === undefined || founder.surname === "" ? null : SURNAMES_KO[founder.surname] ?? founder.surname, (named?.kind ?? null) as NamedLineageKind | null), emblemPersonId: founder.id,
    width: Math.max(left - TREE.siblingGap + TREE.margin, TREE.labelColumn + 360), height: rowY(deepest + 1) - TREE.rowGap + TREE.toggle,
    generations: Array.from({ length: deepest + 1 }, (_, index) => ({ label: FAMILY_TREE_COPY.generation(index), y: rowY(index) + TREE.nodeHeight / 2 })),
    nodes, lines, joints, marriages, toggles, autoFolded,
  };
}
