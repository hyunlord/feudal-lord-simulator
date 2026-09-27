import { useEffect, useRef } from "react";
import { EmblemImage } from "../heraldry/EmblemImage";
import { Button } from "../kit";
import { portraitStyle } from "../portraitArt";
import { wave19ImageStyle, wave19Url } from "../wave19Art";
import { CHRONICLE_SCREEN_COPY as COPY } from "./chronicleScreenCopy.ko";
import type { FactionRow, WorldLine } from "./factionTabModel";

// CHRON-2 faction tab (UI-6 first pass): the nine factions, one row each (a kit button: Enter, Space or a press opens
// the faction's page) — the arms, the name and kind, the leader's portrait and name, the relation on the Wave 19 scale
// with its reading, the open demands and the promises — and under the list the world beyond the town up to this year.
const EMBLEM = 48;
const FACE = 44;
const SCALE_WIDTH = 200;

function RelationScale({ row }: { readonly row: FactionRow }) {
  return (
    <span className="chronicle-factions-scale" aria-hidden="true">
      <span className="chronicle-factions-track" style={{ width: SCALE_WIDTH, backgroundImage: `url("${wave19Url("relation_scale_track")}")` }}>
        <span className="chronicle-factions-pin" style={{ left: `${row.relationX * 100}%`, ...wave19ImageStyle("relation_scale_pin", 24) }} />
      </span>
      <span className="chronicle-factions-reading">{row.relationText}</span>
    </span>
  );
}

export function FactionTab({ rows, world, onOpen }: {
  readonly rows: readonly FactionRow[]; readonly world: readonly WorldLine[]; readonly onOpen: (factionId: string) => void;
}) {
  // The strip opens on this year's end (the newest events); earlier years are a scroll (or the arrow keys) to the left.
  const strip = useRef<HTMLOListElement>(null);
  useEffect(() => { if (strip.current !== null) strip.current.scrollLeft = strip.current.scrollWidth; }, [world.length]);
  return (
    <div className="chronicle-factions">
      {rows.length === 0 ? <p className="chronicle-empty">{COPY.noFactions}</p> : (
        <ul className="chronicle-factions-list" aria-label={COPY.factionsLabel}>
          {rows.map(row => {
            const face = row.leader === null ? null : portraitStyle(row.leader.portraitId, FACE);
            return (
              <li key={row.id}>
                <Button type="button" className="chronicle-factions-row" data-faction={row.id} data-relation={row.relation} aria-label={row.label}
                  onPress={() => onOpen(row.id)} variant="secondary">
                  <span className="chronicle-factions-emblem" aria-hidden="true"><EmblemImage emblem={row.emblem} size={EMBLEM} label="" /></span>
                  <span className="chronicle-factions-name"><strong>{row.name}</strong>{row.kind === row.name ? null : <span>{row.kind}</span>}</span>
                  <span className="chronicle-factions-leader">
                    {face === null ? <span className="chronicle-factions-face chronicle-factions-face--none" aria-hidden="true" />
                      : <span className="chronicle-factions-face" aria-hidden="true" data-portrait={row.leader?.portraitId} style={face} />}
                    <span className="chronicle-factions-leader-text"><strong>{row.leader?.name ?? COPY.noLeader}</strong>{row.leader === null ? null : <span>{row.leader.line}</span>}</span>
                  </span>
                  <RelationScale row={row} />
                  <span className="chronicle-factions-counts"><span>{COPY.demandsCount(row.demands)}</span><span>{COPY.promisesCount(row.promises)}</span></span>
                </Button>
              </li>
            );
          })}
        </ul>)}
      <section className="chronicle-world" aria-label={COPY.worldLabel}>
        <h3>{COPY.worldHeading}</h3>
        {world.length === 0 ? <p className="chronicle-world-empty">{COPY.worldEmpty}</p> : (
          <ol ref={strip} className="chronicle-world-strip" tabIndex={0} aria-label={COPY.worldLabel}>
            {world.map(event => <li key={event.id} data-world={event.id}><strong>{event.year}</strong><span>{event.line}</span></li>)}
          </ol>)}
      </section>
    </div>
  );
}
