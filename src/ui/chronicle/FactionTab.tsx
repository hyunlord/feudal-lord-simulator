import { useEffect, useRef } from "react";
import { EmblemImage } from "../heraldry/EmblemImage";
import { Button } from "../kit";
import { portraitStyle } from "../portraitArt";
import { personPortraitStateClass, personStateOrnamentStyle } from "../persons/personStates";
import { wave19ImageStyle, wave19Url } from "../wave19Art";
import { CHRONICLE_SCREEN_COPY as COPY } from "./chronicleScreenCopy.ko";
import type { FactionRow, WorldLine } from "./factionTabModel";
// UI-9: tug-of-war strip (RG-4) and influence bars on faction rows.
import { FACTION_INFLUENCE_COPY as INFLUENCE } from "./factionInfluenceCopy.ko";
import type { TugOfWarView } from "./factionInfluenceModel";

// CHRON-2 faction tab (UI-6 first pass): the nine factions, one row each (a kit button: Enter, Space or a press opens
// the faction's page) — the arms, the name and kind, the leader's portrait and name, the relation on the Wave 19 scale
// with its reading, the open demands and the promises — and under the list the world beyond the town up to this year.
// UI-9 (RG-4): influence bars inside the counts column and a tug-of-war strip above the list from chapter 4.
const EMBLEM = 48;
const FACE = 44;
const SCALE_WIDTH = 200;
const TUG_WARN = 50;

/** UI-9 RG-4: tug-of-war strip (town+merchants vs overlord+Crown), shown only from chapter 4. */
function TugOfWarStrip({ tug }: { readonly tug: TugOfWarView }) {
  const total = Math.max(1, tug.townSum + tug.merchantSum);
  const townPct = Math.round((tug.townSum / total) * 100);
  const warnPct = Math.round((TUG_WARN / total) * 100);
  return (
    <section className="chronicle-factions-tug" aria-label={INFLUENCE.tugOfWarLabel}>
      <div className="chronicle-factions-tug-bar" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={townPct}
        aria-valuetext={`${tug.townSideLabel} ${townPct}%`} aria-label={INFLUENCE.tugOfWarLabel}>
        <span className="chronicle-factions-tug-fill" style={{ width: `${townPct}%` }} aria-hidden="true" />
        <span className="chronicle-factions-tug-warn" style={{ left: `${warnPct}%` }} aria-hidden="true" />
      </div>
      <div className="chronicle-factions-tug-labels" aria-hidden="true">
        <span>{tug.townSideLabel}</span>
        <span className="chronicle-factions-tug-warn-label">{tug.warningLine}</span>
        <span>{tug.lordSideLabel}</span>
      </div>
      {tug.warningActive ? <p className="chronicle-factions-tug-alert" role="alert">{tug.warningActiveLabel}</p> : null}
    </section>
  );
}

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

export function FactionTab({ rows, world, tug = null, onOpen }: {
  readonly rows: readonly FactionRow[]; readonly world: readonly WorldLine[];
  /** UI-9: RG-4 tug-of-war data; null before chapter 4. */
  readonly tug?: TugOfWarView | null;
  readonly onOpen: (factionId: string) => void;
}) {
  // The strip opens on this year's end (the newest events); earlier years are a scroll (or the arrow keys) to the left.
  const strip = useRef<HTMLOListElement>(null);
  useEffect(() => { if (strip.current !== null) strip.current.scrollLeft = strip.current.scrollWidth; }, [world.length]);
  return (
    <div className="chronicle-factions">
      {/* UI-9: RG-4 tug-of-war strip above the list, chapter 4 only. */}
      {tug !== null && tug !== undefined ? <TugOfWarStrip tug={tug} /> : null}
      {rows.length === 0 ? <p className="chronicle-empty">{COPY.noFactions}</p> : (
        <ul className="chronicle-factions-list" aria-label={COPY.factionsLabel}>
          {rows.map(row => {
            const face = row.leader === null ? null : portraitStyle(row.leader.portraitId, FACE);
            return (
              <li key={row.id}>
                <Button type="button" className="chronicle-factions-row" data-faction={row.id} data-relation={row.relation} data-memory={row.memory} aria-label={row.label}
                  onPress={() => onOpen(row.id)} variant="secondary">
                  <span className="chronicle-factions-emblem" aria-hidden="true"><EmblemImage emblem={row.emblem} size={EMBLEM} label="" /></span>
                  <span className="chronicle-factions-name"><strong>{row.name}</strong>{row.kind === row.name ? null : <span>{row.kind}</span>}</span>
                  <span className="chronicle-factions-leader">
                    {face === null ? <span className="chronicle-factions-face chronicle-factions-face--none" aria-hidden="true" />
                      : <span className="chronicle-factions-face-frame" aria-hidden="true">
                        <span className={`chronicle-factions-face ${personPortraitStateClass(row.leader?.ornament) === "" ? "" : "portrait-greyscale"}`}
                          data-portrait={row.leader?.portraitId} data-person-state={row.leader?.ornament ?? undefined} style={face} />
                        {row.leader === null || row.leader.ornament === undefined || row.leader.ornament === null ? null
                          : <span className="person-state-ornament" data-ornament={row.leader.ornament} style={personStateOrnamentStyle(row.leader.ornament, FACE)} />}
                      </span>}
                    <span className="chronicle-factions-leader-text"><strong>{row.leader?.name ?? COPY.noLeader}</strong>{row.leader === null ? null : <span>{row.leader.line}</span>}</span>
                  </span>
                  <RelationScale row={row} />
                  <span className="chronicle-factions-counts">
                    <span>{COPY.demandsCount(row.demands)}</span><span>{COPY.promisesCount(row.promises)}</span>
                    {/* UI-9: RG-4 influence bar (only town and merchant factions from ch4). */}
                    {row.influence !== null ? (
                      <span className="chronicle-factions-influence" aria-label={INFLUENCE.influenceBarLabel(row.name, row.influence)}>
                        <span className="chronicle-factions-influence-track" aria-hidden="true">
                          <span className="chronicle-factions-influence-fill" style={{ width: `${row.influence}%` }} />
                        </span>
                        <span className="chronicle-factions-influence-value">{INFLUENCE.influenceLabel(row.influence)}</span>
                      </span>
                    ) : null}
                  </span>
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
