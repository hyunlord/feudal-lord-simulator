import { useEffect, useId, useState } from "react";

import { BUILDING_CONFIG_BY_KIND } from "../content/buildingConfig";
import { buildingEntry } from "../content/buildingCatalog";
import { RESOURCE_TYPES, type ResourceType } from "../content/resourceConfig";
import { HOUSEHOLD_SERVICE_CONFIG } from "../population/serviceAllocation";

import { KO_UI } from "../content/locale.ko";
import type { GameState } from "../engine/engine.types";
import { canProclaimPalisadeEra, evaluateEraRequirements } from "../engine/era";
import { WALL_DRAFT_COPY as WALL_COPY } from "./wallDraftCopy.ko";
import type { PlacementTool } from "../render/renderer";
import { DEFAULT_GAME_STATE } from "../state/gameStore";
import { BuildGlyph } from "./BuildGlyph";
import { buildMenuGroups, buildToolAffordability, buildToolTooltipLines, eraLockReason, ROAD_TOOL_OPTION, type BuildToolOption } from "./buildMenuModel";
import { BUILD_CATEGORIES, buildCategory, buildCategorySelection, buildCostLabel, buildThumbnail, type BuildCategory } from "./buildMenuPresentation";
import { DEFAULT_ZONE_BRUSH_RADIUS, ZONE_BRUSH_RADII, type ZoneBrushTarget, type ZoneBrushTool } from "../render/zoneBrushInteraction";
import { ZONE_BRUSH_COPY } from "../render/zoneBrushCopy.ko";
import { ZONE_KIND_LABELS } from "../zones/zoneCopy.ko";
import { platformServices } from "../platform/platform";
import { INTENT_ORDER } from "../input/intentBus";
import { INPUT_HINT_COPY, PAD_HINT_COPY, ZONE_BRUSH_HINT_COPY } from "./inputHintCopy.ko";
import { PadHint } from "./PadGlyph";
import { useInputDevice } from "./useInputDevice";
import { BUILD_MENU_COPY, buildCardPurpose } from "./buildMenuCopy.ko";
import { TUTORIAL_COPY } from "./tutorial/tutorialCopy.ko";
import { tutorialAccess, type ControlLayer, type TutorialAccess } from "./tutorial/tutorialModel";
import { UiIcon } from "./UiIcon";
import type { UiIconCell } from "./uiArt";
import { ZoneLandLegend } from "./hud/ZoneToolbar";
import { Button } from "./kit";
import { resourceName } from "../content/resourceCatalog.ko";
import { DRAINAGE_COPY } from "./drainageCopy.ko";
import { drainToolAvailable } from "./drainToolModel";

/** Zone cards (C1b): plots, arable, pasture, orchard and the eraser, in the zone layer (UX-1); UX-2 painted icons. */
type ZoneCardIcon = { readonly sheet: "building"; readonly cell: UiIconCell<"building"> } | { readonly sheet: "prediction"; readonly cell: UiIconCell<"prediction"> };
const ZONE_CARDS: readonly { readonly target: ZoneBrushTarget; readonly label: string; readonly hint: string; readonly icon: ZoneCardIcon | null; readonly thumbnail: string | null }[] = [
  { target: "burgage", label: ZONE_KIND_LABELS.burgage, hint: ZONE_BRUSH_COPY.cardHint.burgage, icon: { sheet: "building", cell: "burgage" }, thumbnail: null },
  { target: "arable", label: ZONE_KIND_LABELS.arable, hint: ZONE_BRUSH_COPY.cardHint.arable, icon: { sheet: "building", cell: "field" }, thumbnail: null },
  { target: "pasture", label: ZONE_KIND_LABELS.pasture, hint: ZONE_BRUSH_COPY.cardHint.pasture, icon: null, thumbnail: "/assets/zones/pasture_a-v1.png" },
  { target: "orchard", label: ZONE_KIND_LABELS.orchard, hint: ZONE_BRUSH_COPY.cardHint.orchard, icon: null, thumbnail: "/assets/zones/orchard_floor_a-v1.png" },
  { target: "erase", label: ZONE_BRUSH_COPY.eraser, hint: ZONE_BRUSH_COPY.eraserHint, icon: { sheet: "prediction", cell: "block" }, thumbnail: null },
];
/** UX-2: tools without a building thumbnail show their first-session icon (the road; a building's catalog `menuIcon`). */
const toolIcon = (tool: PlacementTool): UiIconCell<"building"> | undefined => tool === "road" ? "road" : buildingEntry(tool).menuIcon;
/** UX-1: the arable brush also sits in the trade (생업) category of the direct layer, the script's first field. */
const ARABLE_CARD = { ...ZONE_CARDS[1]!, hint: BUILD_MENU_COPY.arableCardHint };

type BuildSealsProps = {
  readonly selectedTool: PlacementTool | null;
  readonly state?: GameState;
  readonly highlightedTools?: readonly PlacementTool[];
  readonly onSelect: (tool: PlacementTool | null) => void;
  readonly palisadeDrawing?: boolean;
  readonly onStartPalisadeDrawing?: () => void;
  /** Zone brush (C1b): the armed tool, and the setter (null disarms). */
  readonly zoneTool?: ZoneBrushTool | null;
  readonly onZoneToolChange?: (tool: ZoneBrushTool | null) => void;
  /** UX-1: what the tutorial has opened (default: everything), the control layer and its setter. */
  readonly access?: TutorialAccess;
  readonly layer?: ControlLayer;
  readonly onLayerChange?: (layer: ControlLayer) => void;
  /** UX-1: a menu target to pulse twice (a tool, category, zone card or layer key); `nonce` replays a new request. */
  readonly pulse?: { readonly key: string; readonly nonce: number } | null;
  /** UX-1: open the catalogue at a category (a goal card's button), `nonce` per request. */
  readonly openRequest?: { readonly category: BuildCategory; readonly nonce: number } | null;
  /** UX-3: the drawer is controlled by the UI state machine (one panel slot); absent = the menu keeps its own. */
  readonly open?: boolean;
  readonly onOpenChange?: (open: boolean) => void;
  /** UX-3: the layer switch lives outside the drawer (bottom left); true keeps the old top row (tests, old shells). */
  readonly showLayers?: boolean;
  /** LAND-UI (LU-D6): the fen's drain tool — a card in the trade (생업) category beside the arable brush, on the fen only. */
  readonly drainTool?: boolean;
  readonly onDrainToolChange?: (armed: boolean) => void;
};

const OPEN_ACCESS = tutorialAccess(false, 0);

export function BuildSeals({ selectedTool, state, highlightedTools = [], onSelect, palisadeDrawing = false, onStartPalisadeDrawing, zoneTool = null, onZoneToolChange,
  access = OPEN_ACCESS, layer = "direct", onLayerChange, pulse = null, openRequest = null, open, onOpenChange, showLayers = true, drainTool = false, onDrainToolChange }: BuildSealsProps) {
  const id = useId().replaceAll(":", "");
  const menuState = state ?? DEFAULT_GAME_STATE;
  // Era-locked buildings stay visible with their lock and the stage that opens them (UX-0 "잠긴 건물은 숨기지 말고").
  const options = buildMenuGroups(menuState, { includeEraLocked: true }).flatMap((group) => group.options);
  const inputDevice = useInputDevice();
  const [category, setCategory] = useState<BuildCategory>(() => {
    const initialTool = selectedTool ?? highlightedTools[0] ?? "house";
    return buildCategory(initialTool);
  });
  const [ownOpen, setOwnOpen] = useState(false);
  const catalogOpen = open ?? ownOpen;
  const setCatalogOpen = (next: boolean) => { if (open === undefined) setOwnOpen(next); onOpenChange?.(next); };
  // A pick closes the menu; a controlled drawer (UX-3) closes by the state machine's pick_tool instead (no second event).
  const closeAfterPick = () => { if (open === undefined) setCatalogOpen(false); };
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [preview, setPreview] = useState<PlacementTool | null>(null);
  // A tapped card that cannot be built yet: its tooltip lines stay visible in the catalogue (no hover needed).
  const [pinned, setPinned] = useState<PlacementTool | null>(null);
  // UX-1: why a locked category, card or layer cannot be used (shown in the catalogue, no hover needed).
  const [lockNote, setLockNote] = useState<string | null>(null);
  useEffect(() => {
    if (selectedTool !== null) setCategory(buildCategory(selectedTool));
  }, [selectedTool]);
  // A goal card's button opens the catalogue at its category (UX-1 "CTA → 정확한 도구 자동 열기").
  useEffect(() => {
    if (openRequest === null) return;
    setCategory(openRequest.category); setCatalogOpen(true); setDetailsOpen(false); setPinned(null);
  // why: a request is applied once, when it arrives; setCatalogOpen is a new forwarder each render
  }, [openRequest]); // eslint-disable-line react-hooks/exhaustive-deps
  const pulseKey = pulse === null ? null : `${pulse.key}#${pulse.nonce}`;
  const pulsing = (key: string) => pulse !== null && pulse.key === key ? pulseKey ?? undefined : undefined;
  // Esc (the global `cancel` intent, after the map and the app shell) closes the catalog and the details (B9). A
  // controlled drawer (UX-3) is closed by the UI state machine's one-step Esc instead.
  useEffect(() => platformServices().input.subscribe(intent => {
    if (intent.kind !== "cancel" || intent.world !== undefined || open !== undefined) return;
    setOwnOpen(false);
    setDetailsOpen(false);
  }, INTENT_ORDER.menu), [open]);
  const visibleOptions = options.filter((option) => buildCategory(option.tool) === category);
  const palisadeReady = canProclaimPalisadeEra(menuState);
  const unmetPalisade = menuState.era === 'hamlet'
    ? evaluateEraRequirements(menuState).find(requirement => !requirement.met)
    : undefined;
  const palisadeReason = menuState.era !== 'hamlet' ? WALL_COPY.alreadyProclaimed
    : unmetPalisade === undefined ? WALL_COPY.requirementMissing
      : WALL_COPY.requirementProgress(unmetPalisade.label, unmetPalisade.current, unmetPalisade.target);
  const detailTool = selectedTool ?? preview ?? visibleOptions[0]?.tool ?? "road";
  const detailOption = detailTool === "road" ? ROAD_TOOL_OPTION : options.find((option) => option.tool === detailTool) ?? ROAD_TOOL_OPTION;
  const selectedOption = selectedTool === null ? null : selectedTool === "road" ? ROAD_TOOL_OPTION : options.find((option) => option.tool === selectedTool) ?? null;
  const service = Object.values(HOUSEHOLD_SERVICE_CONFIG).find(item => item.kind === detailOption.tool);
  const radius = detailOption.tool === "road" ? undefined : BUILDING_CONFIG_BY_KIND[detailOption.tool].serviceRadius;

  const zoneCard = (card: typeof ZONE_CARDS[number], open: boolean) => {
    const selected = zoneTool?.target === card.target;
    return (
      <Button key={card.target} type="button" className={`build-seal build-tool zone-tool${selected ? " build-tool--selected" : ""}${open ? "" : " build-tool--locked"}`}
        aria-label={card.label} aria-pressed={selected} aria-disabled={!open} data-zone-tool={card.target} data-pulse={pulsing(`zone:${card.target}`)}
        onPress={() => {
          if (!open) { setLockNote(`${card.label} · ${TUTORIAL_COPY.lockedTool}`); return; }
          setLockNote(null);
          onZoneToolChange?.({ target: card.target, radius: zoneTool?.radius ?? DEFAULT_ZONE_BRUSH_RADIUS, polygon: zoneTool?.polygon ?? false }); closeAfterPick();
        }} variant="secondary">
        <span className="build-tool-art" aria-hidden="true">
          {card.thumbnail !== null ? <img src={card.thumbnail} width="80" height="40" alt="" draggable={false} />
            : card.icon === null ? null : card.icon.sheet === "building" ? <UiIcon sheet="building" cell={card.icon.cell} size={48} /> : <UiIcon sheet="prediction" cell={card.icon.cell} size={48} />}
        </span>
        <span className="build-seal-label" aria-hidden="true">{card.label}</span>
        <span className="build-tool-cost">{card.hint}</span>
        {open ? null : <span className="build-tool-lock"><UiIcon sheet="lock" cell="locked" /> {TUTORIAL_COPY.locked}</span>}
      </Button>
    );
  };

  const toolButton = (option: BuildToolOption) => {
    const affordability = buildToolAffordability(option.tool, menuState);
    const eraLock = eraLockReason(option.tool, menuState);
    const locked = !access.tools(option.tool) || eraLock !== null;
    const lockText = eraLock ?? TUTORIAL_COPY.lockedTool;
    const toolAffordable = affordability.affordable && !locked;
    const selected = selectedTool === option.tool;
    const thumbnail = buildThumbnail(option.tool);
    const icon = toolIcon(option.tool);
    return (
      <Button key={option.tool} type="button"
        className={`build-seal build-tool${selected ? " build-tool--selected" : ""}${locked ? " build-tool--locked" : ""}`}
        aria-label={option.label} aria-describedby={`${id}-tool-${option.tool}`} aria-pressed={selected}
        aria-disabled={!toolAffordable} data-affordable={String(affordability.affordable)} data-locked={locked ? eraLock !== null ? "era" : "tutorial" : undefined}
        data-highlighted={highlightedTools.includes(option.tool) ? option.tool : undefined} data-pulse={pulsing(option.tool)}
        onHover={hovering => setPreview(hovering ? option.tool : null)} onFocusChange={focused => setPreview(focused ? option.tool : null)}
        onPress={() => { if (toolAffordable) { onSelect(option.tool); closeAfterPick(); setPreview(null); setPinned(null); setLockNote(null); } else if (locked) { setLockNote(`${option.label} · ${lockText}`); setPinned(null); } else setPinned(option.tool); }} variant="secondary">
        <span id={`${id}-tool-${option.tool}`} className="visually-hidden">{buildToolTooltipLines(option.tool, menuState).join(". ")}</span>
        <span className="build-tool-art" aria-hidden="true">
          {thumbnail !== null ? <img src={thumbnail} width="80" height="64" alt="" draggable={false} />
            : icon !== undefined ? <UiIcon sheet="building" cell={icon} size={48} /> : <BuildGlyph tool={option.tool} />}
        </span>
        <span className="build-seal-label" aria-hidden="true">{option.label}</span>
        <span className="build-tool-purpose">{buildCardPurpose(option.tool)}</span>
        <span className="build-tool-cost">{buildCostLabel(option)}</span>
        {locked ? <span className="build-tool-lock"><UiIcon sheet="lock" cell="locked" /> {eraLock ?? TUTORIAL_COPY.locked}</span>
          : !affordability.affordable && <span className="build-tool-shortfall">{shortfallText(option, affordability.spendable)}</span>}
      </Button>
    );
  };

  return (
    <div className="build-menu" role="group" aria-label={KO_UI.placementSeals}>
      <div className="build-menu-toprow">
      {showLayers ? <div className="control-layers" role="group" aria-label={TUTORIAL_COPY.layerGroup}>
        {(["direct", "zone", "direction"] as const).map(item => {
          const open = access.layers[item];
          const active = layer === item;
          // The zone layer button keeps the category class: it opens the zone cards as the old 구역 category did.
          return <Button key={item} type="button" className={`control-layer${item === "zone" ? " build-menu-category" : ""}${open ? "" : " control-layer--locked"}`}
            aria-pressed={active} aria-disabled={!open} data-layer={item} data-pulse={pulsing(`layer:${item}`)}
            onPress={() => {
              if (!open) { setLockNote(`${TUTORIAL_COPY.layers[item]} · ${item === "direction" ? TUTORIAL_COPY.lockedLayer.direction : TUTORIAL_COPY.lockedLayer.zone}`); setCatalogOpen(true); return; }
              setLockNote(null); setPinned(null);
              if (item === "zone") { onLayerChange?.("zone"); setCatalogOpen(!(catalogOpen && layer === "zone")); return; }
              onLayerChange?.(item); if (item === "direct") onZoneToolChange?.(null);
            }} variant="toggle">
            <UiIcon sheet="layer" cell={item} />{TUTORIAL_COPY.layers[item]}{open ? null : <UiIcon sheet="lock" cell="locked" className="control-layer-lock" />}
          </Button>;
        })}
      </div> : null}
      <div className="build-menu-categories" role="group" aria-label={BUILD_MENU_COPY.categoryGroup} hidden={layer === "zone" || (open !== undefined && !catalogOpen)}>
        {BUILD_CATEGORIES.map((item) => {
          const open = access.categories[item.key];
          return (
          <Button key={item.key} type="button" className={`build-menu-category${open ? "" : " build-menu-category--locked"}`}
            aria-pressed={category === item.key} aria-expanded={catalogOpen && category === item.key} aria-controls={`${id}-${item.key}`}
            aria-disabled={!open} data-category={item.key} data-pulse={pulsing(`category:${item.key}`)}
            onPress={() => {
              if (!open) { setLockNote(`${item.label} · ${TUTORIAL_COPY.lockedCategory[item.key as keyof typeof TUTORIAL_COPY.lockedCategory] ?? TUTORIAL_COPY.lockedTool}`); setCatalogOpen(true); setPinned(null); return; }
              setLockNote(null);
              onSelect(buildCategorySelection(item.key)); setDetailsOpen(false); setCatalogOpen(open !== undefined || !catalogOpen || category !== item.key); setCategory(item.key); setPreview(null); setPinned(null);
            }} variant="tab">
            <UiIcon sheet="category" cell={item.key} />{item.label}{open ? null : <UiIcon sheet="lock" cell="locked" className="build-menu-category-lock" />}
            {options.some((option) => buildCategory(option.tool) === item.key && highlightedTools.includes(option.tool)) && <span className="build-menu-task" aria-label={BUILD_MENU_COPY.currentTask}>·</span>}
          </Button>
          );
        })}
      </div>
      </div>
      <div className="build-menu-body" hidden={!catalogOpen}>
        <div className="build-menu-quick-road" role="group" aria-label={KO_UI.roadTool}>{toolButton(ROAD_TOOL_OPTION)}</div>
        <div className="build-menu-catalog">
          {lockNote !== null ? <p className="build-menu-pinned build-menu-lock-note" data-frame="tooltip" role="status"><UiIcon sheet="lock" cell="locked" /> {lockNote}</p>
            : pinned === null ? null : <p className="build-menu-pinned" data-frame="tooltip" role="status">{buildToolTooltipLines(pinned, menuState).join(" · ")}</p>}
          {layer === "zone" && onZoneToolChange !== undefined ? <section id={`${id}-zone`} aria-label={BUILD_MENU_COPY.toolsLabel(TUTORIAL_COPY.layers.zone)} className="build-menu-tools">
            {/* UX-3R2: in the UX-3 shell the eraser, the polygon and the size are on the left zone toolbar. */}
            {ZONE_CARDS.filter(card => open === undefined || card.target !== "erase").map(card => zoneCard(card, access.zoneTargets(card.target)))}
          </section> : null}
          {BUILD_CATEGORIES.map((item) => (
            <section key={item.key} id={`${id}-${item.key}`} hidden={layer === "zone" || category !== item.key} aria-label={BUILD_MENU_COPY.toolsLabel(item.label)} className="build-menu-tools">
              {item.key === "trade" && access.arableCard && onZoneToolChange !== undefined ? zoneCard(ARABLE_CARD, true) : null}
              {item.key === "trade" && onDrainToolChange !== undefined && drainToolAvailable(menuState) ? (
                <Button type="button" className={`build-seal build-tool drain-tool${drainTool ? " build-tool--selected" : ""}`}
                  aria-label={DRAINAGE_COPY.card} aria-pressed={drainTool} data-drain-tool="fen"
                  onPress={() => { onDrainToolChange(!drainTool); setLockNote(null); setPinned(null); closeAfterPick(); }} variant="secondary">
                  <span className="build-tool-art" aria-hidden="true"><UiIcon sheet="cause" cell="water" size={48} /></span>
                  <span className="build-seal-label" aria-hidden="true">{DRAINAGE_COPY.card}</span>
                  <span className="build-tool-cost">{DRAINAGE_COPY.cardHint}</span>
                </Button>
              ) : null}
              {options.filter((option) => buildCategory(option.tool) === item.key).map(toolButton)}
              {item.key === 'defense' && onStartPalisadeDrawing !== undefined ? (
                <Button type="button" className={`build-seal build-tool${palisadeDrawing ? ' build-tool--selected' : ''}`}
                  aria-label={WALL_COPY.drawTool} aria-pressed={palisadeDrawing} aria-disabled={!palisadeReady}
                  onPress={() => { if (palisadeReady) { onStartPalisadeDrawing(); closeAfterPick(); } }} variant="secondary">
                  <span className="build-tool-art" aria-hidden="true"><UiIcon sheet="building" cell="palisade" size={48} /></span>
                  <span className="build-seal-label" aria-hidden="true">{WALL_COPY.drawTool}</span>
                  <span className="build-tool-cost">{WALL_COPY.drawCost}</span>
                  {!palisadeReady ? <span className="build-tool-shortfall">{palisadeReason}</span> : null}
                </Button>
              ) : null}
              {item.key === "paths" && <p className="build-menu-empty">{BUILD_MENU_COPY.pathsHint}<br />{BUILD_MENU_COPY.bridgeHint}</p>}
              {item.key === "defense" && !options.some((option) => buildCategory(option.tool) === "defense") && onStartPalisadeDrawing === undefined && <p className="build-menu-empty">{BUILD_MENU_COPY.keepLocked}</p>}
            </section>
          ))}
        </div>
      </div>
      {open !== undefined && zoneTool === null && !palisadeDrawing ? null : <div className="build-menu-summary">
        {zoneTool !== null && onZoneToolChange !== undefined && open !== undefined ? zoneTool.target === "erase"
          ? <span className="zone-land-legend" data-frame="flat">{ZONE_BRUSH_COPY.eraserHint}</span> : <ZoneLandLegend kind={zoneTool.target} />
        : zoneTool !== null && onZoneToolChange !== undefined ? <>
          <strong>{zoneTool.target === "erase" ? ZONE_BRUSH_COPY.eraser : ZONE_KIND_LABELS[zoneTool.target]}</strong>
          <span className="zone-radius" role="group" aria-label={ZONE_BRUSH_COPY.radiusHint}>
            {ZONE_BRUSH_RADII.map(radius => (
              <Button key={radius} type="button" className="zone-radius-button" aria-pressed={zoneTool.radius === radius}
                onPress={() => onZoneToolChange({ ...zoneTool, radius })} variant="toggle">{ZONE_BRUSH_COPY.radius(radius)}</Button>
            ))}
          </span>
          <Button type="button" className="zone-polygon-toggle" aria-pressed={zoneTool.polygon}
            onPress={() => onZoneToolChange({ ...zoneTool, polygon: !zoneTool.polygon })} variant="toggle">{ZONE_BRUSH_COPY.polygonToggle}</Button>
          {zoneTool.polygon ? <span className="zone-polygon-hint">{ZONE_BRUSH_COPY.polygonToggleHint}</span> : null}
        </> : palisadeDrawing ? <><strong>{WALL_COPY.drawTool}</strong><span>{WALL_COPY.drawHint}</span></>
          : selectedTool === null && preview === null ? <span className="build-menu-pick">{TUTORIAL_COPY.pickTool}</span> : <>
          <strong>{detailOption.label}</strong><span>{buildCostLabel(detailOption)}</span>
          {radius !== undefined && radius > 0 && <span>{BUILD_MENU_COPY.radius(radius)}</span>}
          {service && <span>{BUILD_MENU_COPY.capacity(service.capacity)}</span>}
        </>}
        {open !== undefined ? null : <Button type="button" className="build-info-toggle" aria-label={BUILD_MENU_COPY.toolDetailToggle} aria-expanded={detailsOpen} aria-controls={`${id}-details`} onPress={() => { setCatalogOpen(false); setDetailsOpen(!detailsOpen); }} variant="icon"><UiIcon sheet="action" cell="log" size={32} /></Button>}
      </div>}
      <div id={`${id}-details`} className="build-menu-details" aria-label={BUILD_MENU_COPY.detailsLabel} hidden={!detailsOpen} data-frame="light">
        {palisadeDrawing ? <p>{WALL_COPY.drawHint}</p> : selectedOption === null ? <p>{BUILD_MENU_COPY.noToolSelected}</p> : <>
          <div className="build-menu-detail-heading"><strong>{selectedOption.label}</strong><span>{buildCostLabel(selectedOption)}</span></div>
          <p>{selectedOption.purpose}</p><p>{selectedOption.requirements.join(" · ")}</p>
          <p className={buildToolAffordability(selectedOption.tool, menuState).affordable ? "build-menu-ready" : "build-menu-shortfall"}>{buildToolTooltipLines(selectedOption.tool, menuState).at(-1)}</p>
        </>}
      </div>
      {/* INSTALL-23 ⑤: with a gamepad the line is drawn with the pad's glyphs; the mouse and keyboard keep the key names. */}
      {open !== undefined ? null : <div className="build-menu-instruction" data-input-device={inputDevice}>{inputDevice === "gamepad"
        ? <PadHint parts={zoneTool === null ? PAD_HINT_COPY.build : zoneTool.target === "erase" ? PAD_HINT_COPY.zoneEraser : PAD_HINT_COPY.zoneStatus(ZONE_KIND_LABELS[zoneTool.target])} />
        : zoneTool === null ? INPUT_HINT_COPY[inputDevice]
        : inputDevice === "mouse" ? zoneTool.target === "erase" ? ZONE_BRUSH_COPY.eraserStatus : ZONE_BRUSH_COPY.status(ZONE_KIND_LABELS[zoneTool.target])
        : zoneTool.target === "erase" ? ZONE_BRUSH_HINT_COPY[inputDevice].eraser : ZONE_BRUSH_HINT_COPY[inputDevice].status(ZONE_KIND_LABELS[zoneTool.target])}</div>}
    </div>
  );
}

function shortfallText(option: BuildToolOption, spendable: Partial<Record<ResourceType, number>>): string {
  return RESOURCE_TYPES.filter(resource => (option.cost[resource] ?? 0) > (spendable[resource] ?? 0))
    .map(resource => BUILD_MENU_COPY.shortfall(resourceName(resource), spendable[resource] ?? 0, option.cost[resource] ?? 0))
    .join(" · ");
}
