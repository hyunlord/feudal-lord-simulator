import type { GameState } from "../engine/engine.types";
import { buildingInspectorModel } from "./buildingInspectorModel";

export type HoveredBuilding = {
  readonly buildingId: string;
  readonly x: number;
  readonly y: number;
};

export function BuildingInspector({
  state,
  hover,
}: {
  readonly state: GameState;
  readonly hover: HoveredBuilding | null;
}) {
  if (hover === null) return null;
  const model = buildingInspectorModel(state, hover.buildingId);
  if (model === null) return null;
  return (
    <aside
      className="building-inspector"
      style={{ left: `clamp(12px, ${hover.x}px, calc(100% - 274px))`, bottom: "calc(var(--command-height) + 16px)" }}
      aria-label={`${model.name} 정보`}
    >
      <strong>{model.name}</strong>
      <span>{model.purpose}</span>
      <ul>
        {model.rows.map((row) => <li key={row}>{row}</li>)}
      </ul>
    </aside>
  );
}
