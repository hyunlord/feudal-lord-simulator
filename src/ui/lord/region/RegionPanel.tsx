import { useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import { estatesOf } from "../../../engine/estates";
import type { GameState } from "../../../engine/engine.types";
import { EmblemImage } from "../../heraldry/EmblemImage";
import { Button } from "../../kit";
import { useUiParts } from "../uiPartArt";
import type { LordNavGate, LordPanelProps } from "../screen/lordScreenTypes";
import { flagArtId, REGION_PART_IDS, siteArtId, useRegionMap } from "./regionArt";
import { REGION_COPY as COPY } from "./regionCopy.ko";
import { MAP_WIDTH, MARKER_SCALE, markerLayout, REGION_ZOOMS, regionChosen, regionEstates, type RegionEstateView, type RegionFlag, type RegionZoom } from "./regionModel";

// LM-R2 (region area): the lord screen's 지역 — one region map (the user's decision, 2026-10-06: lord-components-region's
// map_region, the approved single map; the five-land atlas and its 18 neighbours wait for LM-E10). On it the home estate
// and the engine's three neighbours, each on its site picture with its flag (direct, delegated, neighbour) and, on the
// flag's empty base, its house's arms (a layer of its own). The map has its own zoom (the town's is untouched: the panel
// is not the canvas). Pressing an estate chooses it; its line below opens it in the estates screen (onOpen).

/** The map opens whenever there are estates to put on it (every lord-mode game has the home and three neighbours). */
export const regionGate: LordNavGate = (state: GameState) => estatesOf(state).estates.length > 0 ? null : COPY.noEstates;

type Parts = ReturnType<typeof useUiParts>;

/** Where a marker's label hangs: from a site in the left third it starts at the marker, in the right third it ends there. */
const labelSide = (x: number): "start" | "centre" | "end" => x < 1 / 3 ? "start" : x > 2 / 3 ? "end" : "centre";

function Marker({ view, scale, chosen, parts, size, onChoose }: {
  readonly view: RegionEstateView; readonly scale: 0.5 | 1; readonly chosen: boolean; readonly parts: Parts;
  readonly size: { readonly width: number; readonly height: number }; readonly onChoose: (estateId: string) => void;
}): ReactElement | null {
  const slot = view.slot;
  if (slot === null) return null;
  const siteArt = view.site === null ? null : parts.image(siteArtId(view.site), 96 * scale);
  const flagArt = parts.image(flagArtId(view.flag), 64 * scale);
  const layout = markerLayout(slot, scale, flagArt === null ? null : view.flag, siteArt !== null, view.arms !== null);
  return (
    <Button type="button" variant="surface" className="lord-region-site" data-region-estate={view.estateId} data-region-flag={view.flag}
      data-region-site={view.site ?? "none"} data-region-art={siteArt === null ? "none" : "art"} aria-pressed={chosen} onPress={() => onChoose(view.estateId)}
      style={{ left: `${slot.site.x / size.width * 100}%`, top: `${slot.site.y / size.height * 100}%`, marginTop: -layout.anchorY }}>
      <span className="lord-region-site-art-box" aria-hidden="true" style={{ width: layout.width, height: layout.height }}>
        {siteArt === null || layout.site === null ? null : <span className="lord-region-site-art" style={{ ...siteArt, left: layout.site.left, top: layout.site.top }} />}
        {flagArt === null || layout.flag === null ? null : <span className="lord-region-flag-art" style={{ ...flagArt, left: layout.flag.left, top: layout.flag.top }} />}
        {/* The arms are their own layer, only on a flag's empty base (no flag picture: no base, no arms). */}
        {view.arms === null || layout.arms === null ? null : <span className="lord-region-arms" data-region-arms={view.arms.house}
          style={{ left: layout.arms.left, top: layout.arms.top, width: layout.arms.width, height: layout.arms.height }}>
          <EmblemImage emblem={view.arms.emblem} size={layout.arms.width} label={COPY.armsLabel(view.arms.house)} /></span>}
      </span>
      {/* The label hangs under the marker toward the map's middle (a site in the left third starts it, the right third ends
          it), wrapped at 10em, so a long name never crosses the map's edge (geometry: text clipped by the map). */}
      <span className="lord-region-label" data-label-side={labelSide(slot.site.x / size.width)}>{view.label}</span>
    </Button>
  );
}

function FlagKey({ flag, parts }: { readonly flag: RegionFlag; readonly parts: Parts }): ReactElement {
  const art = parts.image(flagArtId(flag), 32);
  return <li className="lord-region-key" data-region-key={flag}>
    {art === null ? null : <span className="lord-region-key-art" aria-hidden="true" style={art} />}
    <span className="lord-region-key-word">{COPY.flags[flag]}</span><span className="lord-region-key-line">{COPY.flagLines[flag]}</span>
  </li>;
}

export function RegionPanel({ state, focus, onOpen }: LordPanelProps): ReactElement {
  const map = useRegionMap();
  const parts = useUiParts(REGION_PART_IDS);
  const [zoom, setZoom] = useState<RegionZoom>("fit");
  const [chosen, setChosen] = useState<string | null>(focus);
  useEffect(() => { if (focus !== null) setChosen(focus); }, [focus]);
  // Once per state object (and the session's one map entry): the clock's and the zoom's re-renders reuse it.
  const estates = useMemo(() => regionEstates(state, map.entry), [state, map.entry]);
  const placed = estates.filter(view => view.slot !== null);
  const listed = estates.filter(view => view.slot === null);
  const line = useMemo(() => chosen === null ? null : regionChosen(state, chosen), [state, chosen]);
  const size = map.entry?.coordinateSpace ?? { width: 1600, height: 1000 };
  const scroller = useRef<HTMLDivElement | null>(null);
  const chosenLine = useRef<HTMLElement | null>(null);
  // A press on the map shows the chosen estate's line (it sits under the map; the screen scrolls only as far as needed).
  const choose = (estateId: string) => { setChosen(estateId); requestAnimationFrame(() => chosenLine.current?.scrollIntoView({ block: "nearest" })); };
  // A zoom keeps the chosen estate (or the home) in the middle of the map's view.
  const centred = chosen ?? estates.find(view => view.home)?.estateId ?? null;
  const centre = estates.find(view => view.estateId === centred)?.slot?.site ?? null;
  useEffect(() => {
    const box = scroller.current;
    if (box === null || centre === null || zoom === "fit") return;
    const width = MAP_WIDTH[zoom];
    box.scrollLeft = Math.max(0, centre.x / size.width * width - box.clientWidth / 2);
    box.scrollTop = Math.max(0, centre.y / size.height * width * size.height / size.width - box.clientHeight / 2);
  // why: only a zoom step re-centres; choosing an estate must not move the map under the pointer
  }, [zoom]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="lord-region" data-region-zoom={zoom}>
      <header className="lord-region-head"><h3>{COPY.heading}</h3><p className="lord-region-intro">{COPY.intro}</p></header>
      <div className="lord-region-zooms" role="group" aria-label={COPY.zoom}>
        {REGION_ZOOMS.map(step => <Button key={step} type="button" variant="toggle" size="sm" className="lord-region-zoom" data-region-zoom-step={step}
          aria-pressed={zoom === step} onPress={() => setZoom(step)}>{COPY.zooms[step]}</Button>)}
      </div>
      <div className="lord-region-map" ref={scroller} role="group" aria-label={COPY.map} data-region-map={map.url === null ? "plain" : "art"}>
        <div className="lord-region-canvas" style={{ width: zoom === "fit" ? "100%" : MAP_WIDTH[zoom], aspectRatio: `${size.width} / ${size.height}`,
          backgroundImage: map.url === null ? undefined : `url("${map.url}")` }}>
          {placed.map(view => <Marker key={view.estateId} view={view} scale={MARKER_SCALE[zoom]} chosen={chosen === view.estateId} parts={parts} size={size} onChoose={choose} />)}
        </div>
      </div>
      {map.failed ? <p className="lord-region-note">{COPY.noPicture}</p> : null}
      {listed.length === 0 ? null : <div className="lord-region-listed">
        {listed.map(view => <Button key={view.estateId} type="button" variant="toggle" size="sm" className="lord-region-site-listed" data-region-estate={view.estateId}
          data-region-flag={view.flag} aria-pressed={chosen === view.estateId} onPress={() => choose(view.estateId)}>{view.label}</Button>)}
      </div>}
      <ul className="lord-region-keys" aria-label={COPY.legend}>
        {(["direct", "delegated", "neighbour"] as const).map(flag => <FlagKey key={flag} flag={flag} parts={parts} />)}
      </ul>
      <section ref={chosenLine} className="lord-region-chosen" aria-label={COPY.chosen} data-region-chosen={line?.estateId ?? "none"}>
        {line === null ? <p className="lord-region-pick">{COPY.pick}</p> : <>
          <h4>{line.name}</h4>
          <dl className="lord-region-rows">
            {line.rows.map(row => <div key={row.key} className="lord-region-row" data-region-row={row.key}><dt>{COPY.rows[row.key]}</dt><dd>{row.value}</dd></div>)}
          </dl>
          <Button type="button" variant="secondary" className="lord-region-open" data-region-open={line.estateId} aria-label={COPY.openLabel(line.name)}
            onPress={() => onOpen("estates", line.estateId)}>{COPY.open}</Button>
        </>}
      </section>
    </div>
  );
}
