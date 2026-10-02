import { useEffect, useId, useRef, useState } from "react";
import { SCENARIO_COPY } from "../../content/scenario/scenarioCopy.ko";
import { mapArchetypes } from "../../state/newGame";
import { Button, NumberField } from "../kit";
import { LAND_SEED_DIGITS, chooseLand, landSeedProblem, landSeedText, parseLandSeed, randomLandSeed, type LandChoice } from "../landChoice";
import { LAND_PICKER_COPY } from "../landPickerCopy.ko";
import { cachedLandPreview } from "../landPreview";

// LAND-UI (LU-D7): the new-game screen's land choice, above the mode buttons — the five lands in mapArchetypes()
// order (each with its name, its line and a small map of its opening), and the map's number beside the prompt (beside
// the prompt, not under the lands, so the lands stay below the viewport's centre, which scripts click to dismiss).
// NAT-4: the number is a kit NumberField (1–999,999, any land) and "무작위" draws another that has a game; a number
// that cannot start says why under it (the welcome then refuses to start). Every control isolates its press, so
// editing never dismisses the welcome. The choice follows each keystroke (a start takes what is shown); the previews
// follow it PREVIEW_DELAY_MS after the typing stops (five opening states per number).
const ARCHETYPE_COPY: Readonly<Record<string, { readonly name: string; readonly description: string } | undefined>> = SCENARIO_COPY.archetypes;
const PREVIEW_DELAY_MS = 300;

export function LandPicker({ choice, onChange }: { readonly choice: LandChoice; readonly onChange: (next: LandChoice) => void }) {
  const [text, setText] = useState(() => landSeedText(choice.seed));
  const previewSeed = useSettled(choice.seed, PREVIEW_DELAY_MS);
  const problem = landSeedProblem(choice);
  const problemId = useId();
  const type = (digits: string) => {
    setText(digits);
    onChange({ ...choice, seed: parseLandSeed(digits) });
  };
  const draw = () => {
    const next = randomLandSeed(choice);
    setText(landSeedText(next.seed));
    onChange(next);
  };
  return (
    <div className="welcome-lands" role="group" aria-label={SCENARIO_COPY.archetypePrompt}>
      <div className="welcome-lands-head">
        <p className="welcome-lands-prompt">{SCENARIO_COPY.archetypePrompt}</p>
        <div className="welcome-seed" role="group" aria-label={LAND_PICKER_COPY.seedLabel}>
          <span className="welcome-seed-label" aria-hidden="true">{LAND_PICKER_COPY.seedLabel}</span>
          <NumberField className="welcome-seed-field" label={LAND_PICKER_COPY.seedField} value={text} maxDigits={LAND_SEED_DIGITS}
            invalid={problem !== null} describedBy={problem === null ? undefined : problemId} isolate onChange={digits => type(digits)} />
          <Button className="welcome-seed-random" type="button" variant="secondary" isolate onPress={() => draw()}>
            {LAND_PICKER_COPY.random}
          </Button>
        </div>
        {problem === null ? null : <p id={problemId} className="welcome-seed-problem" role="status">{LAND_PICKER_COPY.problems[problem]}</p>}
      </div>
      <div className="welcome-land-row">
        {mapArchetypes().map(land => {
          const copy = ARCHETYPE_COPY[land.id.split(":")[1] ?? ""];
          return (
            <Button key={land.id} className="welcome-land" type="button" variant="toggle" aria-pressed={land.id === choice.archetypeId}
              data-archetype={land.id} isolate onPress={() => onChange(chooseLand(choice, land.id))}>
              <LandPreview archetypeId={land.id} seed={previewSeed} />
              <span className="welcome-land-name">{copy?.name ?? land.id}</span>
              {copy === undefined ? null : <span className="welcome-land-line">{copy.description}</span>}
            </Button>
          );
        })}
      </div>
    </div>
  );
}

/** `value`, once it has held for `delayMs` (the first value at once). */
function useSettled<T>(value: T, delayMs: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);
  return settled;
}

/** The land's opening map, drawn once the picker is on screen (each picture is memoised per land and seed); blank for a number with no map. */
function LandPreview({ archetypeId, seed }: { readonly archetypeId: string; readonly seed: number | null }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d") ?? null;
    if (canvas === null || context === null) return;
    const pixels = seed === null ? null : cachedLandPreview(archetypeId, seed);
    canvas.width = pixels?.width ?? 0;
    canvas.height = pixels?.height ?? 0;
    if (pixels !== null) context.putImageData(new ImageData(new Uint8ClampedArray(pixels.data), pixels.width, pixels.height), 0, 0);
  }, [archetypeId, seed]);
  return <canvas ref={canvasRef} className="welcome-land-preview" aria-hidden="true" width={0} height={0} />;
}
