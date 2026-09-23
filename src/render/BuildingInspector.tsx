import { buildingCauseSnapshot } from "../ui/houseProgressModel";
import type { GameState } from "../engine/engine.types";
import { buildingInspectorModel } from "./buildingInspectorModel";

export type HoveredBuilding = {
  readonly buildingId: string;
  readonly clusterCount?: number;
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
  const cause = buildingCauseSnapshot(state).get(hover.buildingId);
  if (cause !== undefined) return <aside className="building-inspector cause-tooltip" role="tooltip"
    style={{ left: `clamp(12px, ${hover.x + 16}px, calc(100% - min(720px, 100% - 24px) - 12px))`,
      top: `clamp(calc(var(--resource-height) + 8px), ${hover.y - 48}px, calc(100% - var(--command-height) - 96px))` }}
    aria-label={`${cause.name} 원인`}>{(hover.clusterCount ?? 1) > 1 ? `${hover.clusterCount}곳 · ` : ""}{cause.name} · {cause.summary}</aside>;
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
