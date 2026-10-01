import { useEffect, useRef } from "react";
import { SCENARIO_COPY } from "../../content/scenario/scenarioCopy.ko";
import { mapArchetypes } from "../../state/newGame";
import { Button, IconButton } from "../kit";
import { LAND_SEED_MIN, canStepLandSeed, chooseLand, landSeedLocked, stepLandSeed, type LandChoice } from "../landChoice";
import { LAND_PICKER_COPY } from "../landPickerCopy.ko";
import { cachedLandPreview } from "../landPreview";

// LAND-UI (LU-D7): the new-game screen's land choice, above the mode buttons — the five lands in mapArchetypes()
// order (each with its name, its line and a small map of its opening), and the map's number beside the prompt (seed
// 1–5; the riverside town has map 1 only; beside the prompt, not under the lands, so the lands stay below the
// viewport's centre, which scripts click to dismiss). Every control is a kit Button with `isolate`, so a pick never dismisses the welcome.
const ARCHETYPE_COPY: Readonly<Record<string, { readonly name: string; readonly description: string } | undefined>> = SCENARIO_COPY.archetypes;

export function LandPicker({ choice, onChange }: { readonly choice: LandChoice; readonly onChange: (next: LandChoice) => void }) {
  const locked = landSeedLocked(choice.archetypeId);
  const canStep = (delta: number) => canStepLandSeed(choice, delta);
  const step = (delta: number) => { if (canStep(delta)) onChange(stepLandSeed(choice, delta)); };
  return (
    <div className="welcome-lands" role="group" aria-label={SCENARIO_COPY.archetypePrompt}>
      <div className="welcome-lands-head">
        <p className="welcome-lands-prompt">{SCENARIO_COPY.archetypePrompt}</p>
        <div className="welcome-seed" role="group" aria-label={LAND_PICKER_COPY.seedLabel}>
          <span className="welcome-seed-label">{LAND_PICKER_COPY.seedLabel}</span>
          <IconButton className="welcome-seed-step" type="button" label={LAND_PICKER_COPY.seedDown} aria-disabled={!canStep(-1)} isolate onPress={() => step(-1)}>
            {LAND_PICKER_COPY.minus}
          </IconButton>
          <span className="welcome-seed-value" aria-live="polite">{choice.seed}</span>
          <IconButton className="welcome-seed-step" type="button" label={LAND_PICKER_COPY.seedUp} aria-disabled={!canStep(1)} isolate onPress={() => step(1)}>
            {LAND_PICKER_COPY.plus}
          </IconButton>
          {locked ? <span className="welcome-seed-note">{LAND_PICKER_COPY.seedFixed}</span> : null}
        </div>
      </div>
      <div className="welcome-land-row">
        {mapArchetypes().map(land => {
          const copy = ARCHETYPE_COPY[land.id.split(":")[1] ?? ""];
          return (
            <Button key={land.id} className="welcome-land" type="button" variant="toggle" aria-pressed={land.id === choice.archetypeId}
              data-archetype={land.id} isolate onPress={() => onChange(chooseLand(choice, land.id))}>
              <LandPreview archetypeId={land.id} seed={landSeedLocked(land.id) ? LAND_SEED_MIN : choice.seed} />
              <span className="welcome-land-name">{copy?.name ?? land.id}</span>
              {copy === undefined ? null : <span className="welcome-land-line">{copy.description}</span>}
            </Button>
          );
        })}
      </div>
    </div>
  );
}

/** The land's opening map, drawn once the picker is on screen (each picture is memoised per land and seed). */
function LandPreview({ archetypeId, seed }: { readonly archetypeId: string; readonly seed: number }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    const pixels = cachedLandPreview(archetypeId, seed);
    const context = canvas?.getContext("2d") ?? null;
    if (canvas === null || pixels === null || context === null) return;
    canvas.width = pixels.width;
    canvas.height = pixels.height;
    context.putImageData(new ImageData(new Uint8ClampedArray(pixels.data), pixels.width, pixels.height), 0, 0);
  }, [archetypeId, seed]);
  return <canvas ref={canvasRef} className="welcome-land-preview" aria-hidden="true" width={0} height={0} />;
}
