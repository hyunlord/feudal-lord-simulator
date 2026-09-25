import { BALANCE } from "../content/balanceConfig";
import { createHouseholdSeed, householdMemberHash } from "../engine/prng";
import type { House, HouseholdMembers } from "./population.types";

export type MemberSex = "female" | "male";
export type MemberAgeBand = "child" | "adult" | "elder";
export interface MemberProfile {
  readonly sex: MemberSex;
  readonly ageBand: MemberAgeBand;
}

const wholeNonnegative = (value: number): number => (Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0);

/** LB-1: the labour pool of a running total of residents (the old `availableWorkers` rule). */
function adultsOf(residents: number): number {
  return Math.floor(wholeNonnegative(residents) * BALANCE.WORKERS_PER_RESIDENT);
}

/**
 * LB-1: adults and children of every house. Houses are taken in building-id order and each gets the difference of
 * ⌊running residents × 0.5⌋, so the adults add up to exactly `availableWorkers(population)` and the odd resident of
 * a house goes to adults and children in turn. The seed is the game seed hashed with the building id.
 */
export function withHouseholdMembers(houses: readonly House[], stateSeed: number): readonly House[] {
  const order = houses.map((house, index) => ({ house, index }))
    .sort((a, b) => a.house.buildingId.localeCompare(b.house.buildingId));
  let running = 0;
  let next: House[] | null = null;
  for (const { house, index } of order) {
    const residents = wholeNonnegative(house.residents);
    const adults = adultsOf(running + residents) - adultsOf(running);
    running += residents;
    const children = residents - adults;
    const members = house.members;
    if (members !== undefined && members.adults === adults && members.children === children) continue;
    next ??= [...houses];
    next[index] = { ...house, members: { adults, children, seed: members?.seed ?? createHouseholdSeed(stateSeed, house.buildingId) } };
  }
  return next ?? houses;
}

/** LB-2: one member's sex and age band, derived from the household seed (not stored). */
export function memberProfile(members: HouseholdMembers, index: number): MemberProfile {
  const hash = householdMemberHash(members.seed, index);
  const sex: MemberSex = (hash & 1) === 0 ? "female" : "male";
  if (index >= members.adults) return { sex, ageBand: "child" };
  // One adult in eight is an elder; the first adult never is, so every working household has a working-age head.
  return { sex, ageBand: index > 0 && ((hash >>> 1) & 7) === 0 ? "elder" : "adult" };
}

export interface HouseholdMembersView {
  readonly adults: number;
  readonly children: number;
  readonly members: readonly MemberProfile[];
}

/** LB-2: the render API (V2 walkers read sex and age band). `null` for an unknown house or one not yet counted. */
export function householdMembers(state: { readonly houses: readonly House[] }, houseId: string): HouseholdMembersView | null {
  const members = state.houses.find(house => house.buildingId === houseId)?.members;
  if (members === undefined) return null;
  return {
    adults: members.adults,
    children: members.children,
    members: Array.from({ length: members.adults + members.children }, (_, index) => memberProfile(members, index)),
  };
}
