import { useEffect, useState, type CSSProperties } from "react";

import type { GameSpeed } from "./engine/engine.types";
import { GameCanvas } from "./render/GameCanvas";
import { DEFAULT_PLACEMENT_TOOL } from "./render/interactions";
import type { PlacementTool } from "./render/renderer";
import { useGameStore } from "./state/gameStore";
import { PALETTE_CSS_VARIABLES } from "./styles/paletteVariables";
import { BuildSeals } from "./ui/BuildMenu";
import { CourtLedger } from "./ui/InfoPanel";
import { MapShield } from "./ui/OverlayControls";
import { SpeedSeals, speedToIntervalMs } from "./ui/SpeedControls";

export function App() {
  const { state, dispatch } = useGameStore();
  const [selectedTool, setSelectedTool] = useState<PlacementTool>(DEFAULT_PLACEMENT_TOOL);
  const [speed, setSpeed] = useState<GameSpeed>(0);

  useEffect(() => {
    const intervalMs = speedToIntervalMs(speed);
    if (intervalMs === null) return undefined;
    const interval = window.setInterval(() => dispatch({ type: "advance_tick" }), intervalMs);
    return () => window.clearInterval(interval);
  }, [dispatch, speed]);

  return (
    <main
      className="app-shell"
      aria-label="Feudal Lord Simulator"
      style={PALETTE_CSS_VARIABLES as CSSProperties}
    >
      <h1 className="visually-hidden">Feudal Lord Simulator</h1>
      <GameCanvas selectedTool={selectedTool} />
      <aside className="court-console" aria-label="Court console">
        <div className="court-recess map-recess">
          <MapShield grid={state} />
        </div>
        <div className="court-recess seal-recess">
          <BuildSeals selectedTool={selectedTool} onSelect={setSelectedTool} />
        </div>
        <div className="court-recess ledger-recess">
          <CourtLedger tick={state.tick} timber={state.treasuryTimber} selectedTool={selectedTool} />
          <SpeedSeals speed={speed} onChange={setSpeed} />
        </div>
      </aside>
    </main>
  );
}
