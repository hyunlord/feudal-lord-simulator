import { Button } from "../../kit";
import { SCENARIO_COPY } from "../../../content/scenario/scenarioCopy.ko";
import type { SeasonBand as Band } from "./seasonBandModel";
import { SEASON_BAND_COPY as COPY } from "./seasonBandCopy.ko";

/**
 * LS1-2: the season-turn band over the map, under the status pill — one line of what changed in the town in the season
 * that closed (or that it was quiet). It does not stop time; a press opens that season's card (lord mode's season card
 * never opens by itself); the pointer on it holds it.
 */
export function SeasonBand({ band, onOpen, onHold }: { readonly band: Band; readonly onOpen: () => void; readonly onHold: (held: boolean) => void }) {
  const [year, season] = band.key.split(":").map(Number) as [number, number];
  const text = band.quiet ? COPY.quiet : band.items.map(item => item.text).join(" · ");
  return (
    <div className="season-band-layer" role="status" aria-label={COPY.region}>
      <Button type="button" className="season-band" data-frame="tooltip" data-season={band.key} data-quiet={band.quiet ? "true" : undefined}
        aria-label={`${COPY.label(year, SCENARIO_COPY.seasons[season as 0 | 1 | 2 | 3])}: ${text}`} variant="surface" onPress={() => onOpen()} onHover={held => onHold(held)}>
        {band.quiet ? <span className="season-band-item">{COPY.quiet}</span>
          : band.items.map(item => <span key={item.key} className="season-band-item" data-item={item.key}>{item.text}</span>)}
      </Button>
    </div>
  );
}
