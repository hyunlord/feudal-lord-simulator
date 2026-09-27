import type { ReactElement } from "react";

import {
  groupPopulationEvents,
  populationGroupLabel,
  type PopulationEvent,
} from "./populationEventModel";
import { Button } from "./kit";

type PopulationEventPanelProps = Readonly<{
  events: readonly PopulationEvent[];
  onSelectHouseIds: (houseIds: readonly string[]) => void;
  /** UI-6 (F2-A WR-3): the men the commission of array took, while they are away (a line under the heading). */
  note?: string | null;
}>;

export function PopulationEventPanel({
  events,
  onSelectHouseIds,
  note = null,
}: PopulationEventPanelProps): ReactElement {
  const groups = [...groupPopulationEvents(events)].reverse();

  return (
    <section className="population-event-panel" aria-label="인구 변화 기록">
      <h2>인구 변화 기록</h2>
      {note === null ? null : <p className="population-event-note" role="status">{note}</p>}
      {groups.length === 0 ? (
        <p>아직 기록된 인구 변화가 없습니다</p>
      ) : (
        <ol>
          {groups.map((group) => (
            <li key={`${group.firstTick}-${group.cause}`}>
              <Button type="button" onPress={() => onSelectHouseIds(group.houseIds)} variant="secondary">
                {populationGroupLabel(group)}
              </Button>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
