import { BALANCE } from "../content/balanceConfig";
import type { GameState } from "../engine/engine.types";
import type { House } from "../population/population.types";

export type PopulationCause = "growth" | "starvation" | "no_water" | "recruited";

export type PopulationEvent = Readonly<{
  tick: number;
  delta: 1 | -1;
  cause: PopulationCause;
  houseId: string;
}>;

export type PopulationEventGroup = Readonly<{
  cause: PopulationCause;
  count: number;
  firstTick: number;
  lastTick: number;
  houseIds: readonly string[];
}>;

function lossCause(state: GameState, house: House): PopulationCause {
  if (state.tick - house.lastServicedTick > BALANCE.STARVATION_WINDOW) {
    return "starvation";
  }
  return house.hasWater ? "starvation" : "no_water";
}

function unitEvents(
  tick: number,
  houseId: string,
  delta: number,
  cause: PopulationCause,
): readonly PopulationEvent[] {
  const signedDelta: 1 | -1 = delta > 0 ? 1 : -1;
  return Array.from({ length: Math.abs(delta) }, () => ({
    tick,
    delta: signedDelta,
    cause,
    houseId,
  }));
}

export function diffPopulationEvents(
  previous: GameState,
  current: GameState,
): readonly PopulationEvent[] {
  const previousById = new Map(previous.houses.map((house) => [house.buildingId, house]));

  return current.houses.flatMap((house) => {
    const prior = previousById.get(house.buildingId);
    if (prior === undefined) {
      return house.residents > 0
        ? unitEvents(current.tick, house.buildingId, house.residents, "recruited")
        : [];
    }

    const delta = house.residents - prior.residents;
    if (delta === 0) return [];
    const cause = delta > 0 ? "growth" : lossCause(current, house);
    return unitEvents(current.tick, house.buildingId, delta, cause);
  });
}

export function appendPopulationEvents(
  existing: readonly PopulationEvent[],
  incoming: readonly PopulationEvent[],
): readonly PopulationEvent[] {
  return [...existing, ...incoming].slice(-200);
}

export function groupPopulationEvents(
  events: readonly PopulationEvent[],
): readonly PopulationEventGroup[] {
  const groups: PopulationEventGroup[] = [];
  for (const event of events) {
    const previous = groups.at(-1);
    if (previous?.cause === event.cause) {
      const houseIds = previous.houseIds.includes(event.houseId)
        ? previous.houseIds
        : [...previous.houseIds, event.houseId];
      groups[groups.length - 1] = {
        ...previous,
        count: previous.count + 1,
        lastTick: event.tick,
        houseIds,
      };
      continue;
    }
    groups.push({
      cause: event.cause,
      count: 1,
      firstTick: event.tick,
      lastTick: event.tick,
      houseIds: [event.houseId],
    });
  }
  return groups;
}

export function populationGroupLabel(group: PopulationEventGroup): string {
  const tickLabel = group.firstTick === group.lastTick
    ? `틱 ${group.firstTick}`
    : `틱 ${group.firstTick}~${group.lastTick}`;
  switch (group.cause) {
    case "growth":
      return `인구 ${group.count}명 증가 — 성장 (${tickLabel})`;
    case "starvation":
      return `인구 ${group.count}명 감소 — 굶주림 (${tickLabel})`;
    case "no_water":
      return `인구 ${group.count}명 감소 — 물 부족 (${tickLabel})`;
    case "recruited":
      return `인구 ${group.count}명 증가 — 정착 (${tickLabel})`;
  }
}
