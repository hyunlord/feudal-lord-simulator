import { Fragment, useId } from "react";

import { KO_UI } from "../content/locale.ko";
import type { GameState } from "../engine/engine.types";
import type { PlacementTool } from "../render/renderer";
import { DEFAULT_GAME_STATE } from "../state/gameStore";
import { BuildGlyph } from "./BuildGlyph";
import {
  buildMenuGroups,
  buildToolAffordability,
  buildToolTooltipLines,
  ROAD_TOOL_OPTION,
  type BuildToolOption,
} from "./buildMenuModel";

type BuildSealsProps = {
  readonly selectedTool: PlacementTool | null;
  readonly state?: GameState;
  readonly highlightedTools?: readonly PlacementTool[];
  readonly onSelect: (tool: PlacementTool | null) => void;
};

export function BuildSeals({
  selectedTool,
  state,
  highlightedTools = [],
  onSelect,
}: BuildSealsProps) {
  const idPrefix = useId().replaceAll(":", "");
  const menuState = state ?? DEFAULT_GAME_STATE;
  const groups = buildMenuGroups(menuState);

  return (
    <div className="build-seals" role="group" aria-label={KO_UI.placementSeals}>
      {groups.map((group) => (
        <section key={group.key} className="build-group" aria-label={`${group.label} 도구`}>
          <span className="build-group-label">{group.label}</span>
          <div className="build-group-seals">
            {group.options.map((option) =>
              renderSeal({ option, idPrefix, menuState, selectedTool, highlightedTools, onSelect }),
            )}
          </div>
        </section>
      ))}
      <div className="road-tool" role="group" aria-label={KO_UI.roadTool}>
        {renderSeal({
          option: ROAD_TOOL_OPTION,
          idPrefix,
          menuState,
          selectedTool,
          highlightedTools,
          onSelect,
        })}
      </div>
    </div>
  );
}

type RenderSealInput = {
  readonly option: BuildToolOption;
  readonly idPrefix: string;
  readonly menuState: GameState;
  readonly selectedTool: PlacementTool | null;
  readonly highlightedTools: readonly PlacementTool[];
  readonly onSelect: (tool: PlacementTool | null) => void;
};

function renderSeal(input: RenderSealInput) {
  const tooltipId = `${input.idPrefix}-seal-tip-${input.option.tool}`;
  const affordability = buildToolAffordability(input.option.tool, input.menuState);
  const isSelected = input.selectedTool === input.option.tool;
  const isHighlighted = input.highlightedTools.includes(input.option.tool);
  const className = [
    "build-seal",
    isSelected ? "build-seal--selected" : null,
    isHighlighted ? "build-seal--highlighted" : null,
    input.option.tool === "road" ? "build-seal--road" : null,
  ].filter((item) => item !== null).join(" ");

  return (
    <Fragment key={input.option.tool}>
      <button
        className={className}
        type="button"
        aria-label={input.option.label}
        aria-describedby={tooltipId}
        aria-disabled={!affordability.affordable}
        aria-pressed={isSelected}
        data-affordable={affordability.affordable ? "true" : "false"}
        data-highlighted={isHighlighted ? input.option.tool : undefined}
        onClick={() => {
          if (affordability.affordable) input.onSelect(input.option.tool);
        }}
      >
        <BuildGlyph tool={input.option.tool} />
        <span className="build-seal-label" aria-hidden="true">{input.option.label}</span>
      </button>
      <span id={tooltipId} className="seal-tooltip" role="tooltip">
        {buildToolTooltipLines(input.option.tool, input.menuState).map((line) => (
          <span key={line}>{line}</span>
        ))}
      </span>
    </Fragment>
  );
}
