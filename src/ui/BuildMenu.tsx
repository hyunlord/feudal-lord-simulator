import { useId } from "react";

import type { GameState } from "../engine/engine.types";
import type { PlacementTool } from "../render/renderer";
import { DEFAULT_GAME_STATE } from "../state/gameStore";
import { BuildGlyph } from "./BuildGlyph";
import {
  buildMenuGroups,
  buildToolAffordability,
  buildToolTooltipLines,
} from "./buildMenuModel";

type BuildSealsProps = {
  readonly selectedTool: PlacementTool | null;
  readonly state?: GameState;
  readonly onSelect: (tool: PlacementTool | null) => void;
};

export function BuildSeals({ selectedTool, state, onSelect }: BuildSealsProps) {
  const idPrefix = useId().replaceAll(":", "");
  const menuState = state ?? DEFAULT_GAME_STATE;
  const groups = buildMenuGroups(menuState);

  return (
    <div className="build-seals" role="group" aria-label="Placement seals">
      {groups.map((group) => (
        <section key={group.key} className="build-group" aria-label={`${group.label} tools`}>
          <span className="build-group-label">{group.label}</span>
          <div className="build-group-seals">
            {group.options.map((option) => {
              const tooltipId = `${idPrefix}-seal-tip-${option.tool}`;
              const affordability = buildToolAffordability(option.tool, menuState);
              return (
                <button
                  key={option.tool}
                  className="build-seal"
                  type="button"
                  aria-label={option.label}
                  aria-describedby={tooltipId}
                  aria-disabled={!affordability.affordable}
                  aria-pressed={selectedTool === option.tool}
                  data-affordable={affordability.affordable ? "true" : "false"}
                  onClick={() => {
                    if (affordability.affordable) onSelect(option.tool);
                  }}
                >
                  <BuildGlyph tool={option.tool} />
                  <span id={tooltipId} className="seal-tooltip" role="tooltip">
                    {buildToolTooltipLines(option.tool, menuState).map((line) => (
                      <span key={line}>{line}</span>
                    ))}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
