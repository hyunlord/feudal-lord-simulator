import type { ReactElement } from "react";

import {
  groupPopulationEvents,
  populationGroupLabel,
  type PopulationEvent,
} from "./populationEventModel";

type PopulationEventPanelProps = Readonly<{
  events: readonly PopulationEvent[];
  onSelectHouseIds: (houseIds: readonly string[]) => void;
}>;

export function PopulationEventPanel({
  events,
  onSelectHouseIds,
}: PopulationEventPanelProps): ReactElement {
  const groups = [...groupPopulationEvents(events)].reverse();

  return (
    <section className="population-event-panel" aria-label="인구 변화 기록">
      <h2>인구 변화 기록</h2>
      {groups.length === 0 ? (
        <p>아직 기록된 인구 변화가 없습니다</p>
      ) : (
        <ol>
          {groups.map((group) => (
            <li key={`${group.firstTick}-${group.cause}`}>
              <button type="button" onClick={() => onSelectHouseIds(group.houseIds)}>
                {populationGroupLabel(group)}
              </button>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
