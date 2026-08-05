import { useEffect, useState, type CSSProperties } from "react";

import type { GameSpeed, OverlayMode } from "./engine/engine.types";
import { GameCanvas } from "./render/GameCanvas";
import { DEFAULT_PLACEMENT_TOOL } from "./render/interactions";
import type { PlacementTool } from "./render/renderer";
import { useGameStore } from "./state/gameStore";
import { PALETTE_CSS_VARIABLES } from "./styles/paletteVariables";
import { BuildSeals } from "./ui/BuildMenu";
import { EconomyOverlayControls, toggleOverlayByKey } from "./ui/EconomyOverlayControls";
import { CourtLedger, SettlementObjective, SettlementStatusLine } from "./ui/InfoPanel";
import { economyStockTotals } from "./ui/ledgerModel";
import { MapShield } from "./ui/OverlayControls";
import { SpeedSeals, speedToIntervalMs } from "./ui/SpeedControls";

export function App() {
  const { state, dispatch } = useGameStore();
  const [selectedTool, setSelectedTool] = useState<PlacementTool | null>(DEFAULT_PLACEMENT_TOOL);
  const [overlayMode, setOverlayMode] = useState<OverlayMode>("none");
  const [speed, setSpeed] = useState<GameSpeed>(0);
  const guidanceSample = Math.floor(state.tick / 60);
  const [guidanceSnapshot, setGuidanceSnapshot] = useState(() => ({
    sample: guidanceSample,
    state,
  }));

  useEffect(() => {
    const intervalMs = speedToIntervalMs(speed);
    if (intervalMs === null) return undefined;
    const interval = window.setInterval(() => dispatch({ type: "advance_tick" }), intervalMs);
    return () => window.clearInterval(interval);
  }, [dispatch, speed]);

  useEffect(() => {
    setGuidanceSnapshot((current) =>
      current.sample === guidanceSample ? current : { sample: guidanceSample, state },
    );
  }, [guidanceSample, state]);

  useEffect(() => {
    const keyDown = (event: KeyboardEvent) => {
      if (event.code === "Escape") {
        event.preventDefault();
        setSelectedTool(null);
        return;
      }
      const nextMode = toggleOverlayByKey(event.code, overlayMode);
      if (nextMode === overlayMode) return;
      event.preventDefault();
      setOverlayMode(nextMode);
    };
    window.addEventListener("keydown", keyDown);
    return () => window.removeEventListener("keydown", keyDown);
  }, [overlayMode]);

  const stockTotals = economyStockTotals(state);

  return (
    <main
      className="app-shell"
      aria-label="Feudal Lord Simulator"
      style={PALETTE_CSS_VARIABLES as CSSProperties}
    >
      <h1 className="visually-hidden">Feudal Lord Simulator</h1>
      <GameCanvas selectedTool={selectedTool} overlayMode={overlayMode} />
      <SettlementStatusLine state={guidanceSnapshot.state} />
      <aside className="court-console" aria-label="Court console">
        <div className="court-recess map-recess">
          <MapShield grid={state} />
        </div>
        <div className="court-recess seal-recess">
          <BuildSeals selectedTool={selectedTool} state={state} onSelect={setSelectedTool} />
        </div>
        <div className="court-recess ledger-recess">
          <div className="ledger-stack">
            <SettlementObjective state={state} />
            <CourtLedger
              tick={state.tick}
              timber={state.treasuryTimber}
              selectedTool={selectedTool}
              population={state.population}
              idleWorkers={state.idleWorkers}
              stockTotals={stockTotals}
            />
            <EconomyOverlayControls overlayMode={overlayMode} onChange={setOverlayMode} />
          </div>
          <SpeedSeals speed={speed} onChange={setSpeed} />
        </div>
      </aside>
    </main>
  );
}
