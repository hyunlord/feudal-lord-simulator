import { useSyncExternalStore } from "react";

import { platformServices } from "../../platform/platform";
import { zoneEditHistory } from "../../render/zoneEditHistory";
import { ZONE_BRUSH_RADII, type ZoneBrushTarget, type ZoneBrushTool } from "../../render/zoneBrushInteraction";
import type { ZoneKind } from "../../zones/zone.types";
import { ZONE_KIND_LABELS } from "../../zones/zoneCopy.ko";
import { TUTORIAL_COPY } from "../tutorial/tutorialCopy.ko";
import { UiIcon } from "../UiIcon";
import { ZONE_TOOLBAR_COPY, zoneLegend } from "./zoneToolbarCopy.ko";
import { Button } from "../kit";

// UX-3R2 zone panel (UX3R 5절): left of the map while the zone layer is open — the four kind chips, the tools (brush,
// polygon, eraser, undo, redo, size) and the paintable-land legend, in one narrow panel (the area budget of the zone
// state: chips in a drawer below as well as a toolbar went over 8 % at 1280 × 800, US-D11). The brush and the polygon
// paint the last kind chosen. Undo and redo go through the intent bus (the map's zone handler holds the history).
const KIND_CHIPS = ["burgage", "arable", "pasture", "orchard"] as const;

export function ZoneToolbar({ tool, lastKind, canUndo, eraserOpen, kindOpen, pulse, onPick, onRadius, hidden = false }: {
  readonly tool: ZoneBrushTool | null;
  /** The kind the brush and the polygon paint when the eraser (or nothing) is armed. */
  readonly lastKind: ZoneKind | null;
  readonly canUndo: boolean;
  readonly eraserOpen: boolean;
  /** The tutorial's unlocks per kind, and the chip to pulse (`zone:<kind>`). */
  readonly kindOpen: (kind: ZoneKind) => boolean;
  readonly pulse?: { readonly key: string; readonly nonce: number } | null;
  readonly onPick: (target: ZoneBrushTarget, polygon: boolean) => void;
  readonly onRadius: (radius: number) => void;
  readonly hidden?: boolean;
}) {
  const canRedo = useSyncExternalStore(zoneEditHistory.subscribe, zoneEditHistory.canRedo, zoneEditHistory.canRedo);
  const painting = tool !== null && tool.target !== "erase";
  const kind = tool !== null && tool.target !== "erase" ? tool.target : lastKind;
  const radius = tool?.radius ?? ZONE_BRUSH_RADII[1];
  const nextRadius = ZONE_BRUSH_RADII[(ZONE_BRUSH_RADII.indexOf(radius as 1 | 2 | 3) + 1) % ZONE_BRUSH_RADII.length]!;
  return (
    <nav className="zone-toolbar" aria-label={ZONE_TOOLBAR_COPY.label} hidden={hidden}>
      <div className="zone-toolbar-kinds" role="group" aria-label={ZONE_TOOLBAR_COPY.kindsLabel}>
        {KIND_CHIPS.map(kind => {
          const open = kindOpen(kind);
          return <Button key={kind} type="button" className={`zone-toolbar-button zone-tool${open ? "" : " build-tool--locked"}`} data-zone-tool={kind}
            aria-pressed={tool?.target === kind} aria-disabled={!open} aria-label={open ? ZONE_KIND_LABELS[kind] : ZONE_TOOLBAR_COPY.lockedKind(ZONE_KIND_LABELS[kind], TUTORIAL_COPY.lockedTool)}
            data-pulse={pulse !== null && pulse !== undefined && pulse.key === `zone:${kind}` ? `${pulse.key}#${pulse.nonce}` : undefined}
            onPress={() => { if (open) onPick(kind, tool?.polygon === true); }} variant="toggle">
            <span className={`zone-toolbar-kind zone-toolbar-kind--${kind}`} aria-hidden="true" />{ZONE_KIND_LABELS[kind]}</Button>;
        })}
      </div>
      <div className="zone-toolbar-tools" role="group" aria-label={ZONE_TOOLBAR_COPY.toolsLabel}>
      <Button type="button" className="zone-toolbar-button" data-zone-mode="brush" aria-pressed={painting && tool?.polygon !== true}
        aria-disabled={kind === null} onPress={() => { if (kind !== null) onPick(kind, false); }} variant="toggle">
        <UiIcon sheet="layer" cell="zone" />{ZONE_TOOLBAR_COPY.brush}</Button>
      <Button type="button" className="zone-toolbar-button" data-zone-mode="polygon" aria-pressed={painting && tool?.polygon === true}
        aria-disabled={kind === null} onPress={() => { if (kind !== null) onPick(kind, true); }} variant="toggle">
        <span className="zone-toolbar-polygon" aria-hidden="true" />{ZONE_TOOLBAR_COPY.polygon}</Button>
      <Button type="button" className="zone-toolbar-button" data-zone-mode="erase" aria-pressed={tool?.target === "erase"} aria-disabled={!eraserOpen}
        onPress={() => { if (eraserOpen) onPick("erase", tool?.polygon === true); }} variant="toggle">
        <UiIcon sheet="prediction" cell="block" />{ZONE_TOOLBAR_COPY.eraser}</Button>
      <Button type="button" className="zone-toolbar-button" data-zone-mode="undo" aria-label={ZONE_TOOLBAR_COPY.undoLabel} aria-disabled={!canUndo || tool === null}
        onPress={() => { if (canUndo && tool !== null) platformServices().input.emit({ kind: "undo" }); }} variant="toggle">
        <UiIcon sheet="action" cell="up" />{ZONE_TOOLBAR_COPY.undo}</Button>
      <Button type="button" className="zone-toolbar-button" data-zone-mode="redo" aria-label={ZONE_TOOLBAR_COPY.redoLabel} aria-disabled={!canRedo || tool === null}
        onPress={() => { if (canRedo && tool !== null) platformServices().input.emit({ kind: "redo" }); }} variant="toggle">
        <UiIcon sheet="action" cell="up" className="zone-toolbar-redo-icon" />{ZONE_TOOLBAR_COPY.redo}</Button>
      <Button type="button" className="zone-toolbar-button" data-zone-mode="size" aria-label={ZONE_TOOLBAR_COPY.sizeLabel(radius)}
        aria-disabled={tool === null || tool.polygon} onPress={() => { if (tool !== null && !tool.polygon) onRadius(nextRadius); }} variant="toggle">
        <span className="zone-toolbar-size" aria-hidden="true" data-size={radius} />{ZONE_TOOLBAR_COPY.size(radius)}</Button>
      </div>
      {tool === null ? <p className="zone-land-legend">{ZONE_TOOLBAR_COPY.pickKind}</p>
        : tool.target === "erase" ? <p className="zone-land-legend">{ZONE_TOOLBAR_COPY.eraserHint}</p> : <ZoneLandLegend kind={tool.target} />}
    </nav>
  );
}

/** The paintable-land legend for the armed kind: three swatches matching the map overlay (barred also hatched). */
export function ZoneLandLegend({ kind }: { readonly kind: ZoneKind }) {
  const legend = zoneLegend(kind);
  return (
    <p className="zone-land-legend" aria-label={ZONE_TOOLBAR_COPY.legendLabel}>
      <span className="zone-land-item"><span className="zone-land-swatch zone-land-swatch--good" aria-hidden="true" />{legend.good}</span>
      {legend.fair === "" ? null : <span className="zone-land-item"><span className="zone-land-swatch zone-land-swatch--fair" aria-hidden="true" />{legend.fair}</span>}
      <span className="zone-land-item"><span className="zone-land-swatch zone-land-swatch--barred" aria-hidden="true" />{legend.barred}</span>
    </p>
  );
}
