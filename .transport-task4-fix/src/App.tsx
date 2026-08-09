import { GameCanvas } from "./render/GameCanvas";
import { BuildMenu } from "./ui/BuildMenu";
import { InfoPanel } from "./ui/InfoPanel";
import { OverlayControls } from "./ui/OverlayControls";
import { SpeedControls } from "./ui/SpeedControls";

export function App() {
  return (
    <main className="app-shell" aria-label="Feudal Lord Simulator scaffold">
      <GameCanvas />
      <header className="title-panel">
        <h1>Feudal Lord Simulator</h1>
        <p>Phase 1 scaffolding</p>
      </header>
      <div className="viewport-label" aria-hidden="true">
        Simulation viewport
      </div>
      <OverlayControls />
      <SpeedControls />
      <InfoPanel />
      <BuildMenu />
    </main>
  );
}
