import { useId } from "react";

import type { PlacementTool } from "../render/renderer";
import { BuildGlyph } from "./BuildGlyph";
import { BUILD_TOOL_OPTIONS } from "./buildMenuModel";

type BuildSealsProps = {
  readonly selectedTool: PlacementTool;
  readonly onSelect: (tool: PlacementTool) => void;
};

export function BuildSeals({ selectedTool, onSelect }: BuildSealsProps) {
  const idPrefix = useId().replaceAll(":", "");

  return (
    <div className="build-seals" role="group" aria-label="Placement seals">
      {BUILD_TOOL_OPTIONS.map((option) => {
        const tooltipId = `${idPrefix}-seal-tip-${option.tool}`;
        return (
          <button
            key={option.tool}
            className="build-seal"
            type="button"
            aria-label={option.label}
            aria-describedby={tooltipId}
            aria-pressed={selectedTool === option.tool}
            onClick={() => onSelect(option.tool)}
          >
            <BuildGlyph tool={option.tool} />
            <span id={tooltipId} className="seal-tooltip" role="tooltip">
              {option.label} · {option.timberCost} timber
            </span>
          </button>
        );
      })}
    </div>
  );
}
