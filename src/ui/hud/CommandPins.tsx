import type { ReactElement, ReactNode } from "react";

import { BUILDING_CONFIG_BY_KIND, type BuildingKind } from "../../content/buildingConfig";
import { SCENARIO_COPY } from "../../content/scenario/scenarioCopy.ko";
import type { GameState } from "../../engine/engine.types";
import { LORD_PUBLIC_WORKS } from "../../engine/townAgency";
import { buildingUnlockStage, isBuildingUnlocked } from "../../world/placement";
import { Button } from "../kit";
import { UiIcon } from "../UiIcon";
import { COMMAND_PINS_COPY as COPY } from "./commandPinsCopy.ko";

// LM-R1 (lord-mode design §2 "명령 핀", §4): lord mode's build drawer. The lord places only the public works
// (`LORD_PUBLIC_WORKS`, the engine refuses any other placement there) and marks out zones for the town to fill; the
// pins are those, one row at the foot of the screen in the drawer's place. The sandbox and the campaign keep the drawer.

export type CommandPin = Readonly<{ id: string; title: string; note: string; enabled: boolean }>;

/** One pin per public work: open unless it stands, is being built or its stage has not come. */
export function publicWorkPins(state: GameState): readonly CommandPin[] {
  return LORD_PUBLIC_WORKS.map((kind: BuildingKind) => {
    const name = BUILDING_CONFIG_BY_KIND[kind].name;
    const id = `work:${kind}`;
    if (state.buildings.some(building => building.kind === kind)) return { id, title: COPY.publicWork(name), note: COPY.standing(name), enabled: false };
    if (state.constructionSites.some(site => site.kind === kind)) return { id, title: COPY.publicWork(name), note: COPY.building(name), enabled: false };
    if (!isBuildingUnlocked(kind, state.era, state.scenarioId)) {
      return { id, title: COPY.publicWork(name), note: COPY.locked(SCENARIO_COPY.stages[buildingUnlockStage(kind, state.scenarioId)]), enabled: false };
    }
    return { id, title: COPY.publicWork(name), note: COPY.publicWorkNote, enabled: true };
  });
}

export function CommandPins({ state, onPublicWork, onZone, children = null }: {
  readonly state: GameState;
  /** Arms the public work's placement tool. */
  readonly onPublicWork: (kind: BuildingKind) => void;
  /** Opens the zone layer (the encouragement zones). */
  readonly onZone: () => void;
  /** Other lord-mode commands' pins (LM-R1's other screens add theirs here). */
  readonly children?: ReactNode;
}): ReactElement {
  return (
    <aside className="command-pins" data-frame="strip-bottom" aria-label={COPY.region}>
      <div className="command-pins-row">
        {publicWorkPins(state).map(pin => (
          <Button key={pin.id} type="button" className="command-pin" data-command-pin={pin.id} aria-disabled={!pin.enabled}
            onPress={() => { if (pin.enabled) onPublicWork(pin.id.slice("work:".length) as BuildingKind); }} variant="secondary">
            <UiIcon sheet="category" cell="public" /><span className="command-pin-text"><strong>{pin.title}</strong><small>{pin.note}</small></span>
          </Button>
        ))}
        <Button type="button" className="command-pin" data-command-pin="zone" onPress={() => onZone()} variant="secondary">
          <UiIcon sheet="layer" cell="zone" /><span className="command-pin-text"><strong>{COPY.zone}</strong><small>{COPY.zoneNote}</small></span>
        </Button>
        {children}
      </div>
      <p className="command-pins-note">{COPY.townBuilds}</p>
    </aside>
  );
}
