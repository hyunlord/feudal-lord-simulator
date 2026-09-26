import { MONEY_LABEL } from "../content/moneyCopy.ko";
import { useEffect, useId, useState } from "react";

import { BUILDING_CONFIG_BY_KIND } from "../content/buildingConfig";
import { RESOURCE_TYPES, type ResourceType } from "../content/resourceConfig";
import { HOUSEHOLD_SERVICE_CONFIG } from "../population/serviceAllocation";

import { KO_UI } from "../content/locale.ko";
import type { GameState } from "../engine/engine.types";
import { canProclaimPalisadeEra, evaluateEraRequirements } from "../engine/era";
import { A_QUADRUPLE_PRIME_WALL_COPY as WALL_COPY } from "./aQuadruplePrimeWallCopy";
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
import { lastInputDevice, subscribeInputDevice, type InputDevice } from "../input/inputDevice";
import { INPUT_HINT_COPY, ZONE_BRUSH_HINT_COPY } from "./inputHintCopy.ko";
import { BUILD_CARD_PURPOSE, BUILD_MENU_COPY } from "./buildMenuCopy.ko";
import { TUTORIAL_COPY } from "./tutorial/tutorialCopy.ko";
import { tutorialAccess, type ControlLayer, type TutorialAccess } from "./tutorial/tutorialModel";
import { UiIcon } from "./UiIcon";
import type { UiIconCell } from "./uiArt";
import { ZoneLandLegend } from "./hud/ZoneToolbar";

/** Zone cards (C1b): plots, arable, pasture, orchard and the eraser, in the zone layer (UX-1); UX-2 painted icons. */
type ZoneCardIcon = { readonly sheet: "building"; readonly cell: UiIconCell<"building"> } | { readonly sheet: "prediction"; readonly cell: UiIconCell<"prediction"> };
const ZONE_CARDS: readonly { readonly target: ZoneBrushTarget; readonly label: string; readonly hint: string; readonly icon: ZoneCardIcon | null; readonly thumbnail: string | null }[] = [
  { target: "burgage", label: ZONE_KIND_LABELS.burgage, hint: ZONE_BRUSH_COPY.cardHint.burgage, icon: { sheet: "building", cell: "burgage" }, thumbnail: null },
  { target: "arable", label: ZONE_KIND_LABELS.arable, hint: ZONE_BRUSH_COPY.cardHint.arable, icon: { sheet: "building", cell: "field" }, thumbnail: null },
  { target: "pasture", label: ZONE_KIND_LABELS.pasture, hint: ZONE_BRUSH_COPY.cardHint.pasture, icon: null, thumbnail: "/assets/zones/pasture_a-v1.png" },
  { target: "orchard", label: ZONE_KIND_LABELS.orchard, hint: ZONE_BRUSH_COPY.cardHint.orchard, icon: null, thumbnail: "/assets/zones/orchard_floor_a-v1.png" },
  { target: "erase", label: ZONE_BRUSH_COPY.eraser, hint: ZONE_BRUSH_COPY.eraserHint, icon: { sheet: "prediction", cell: "block" }, thumbnail: null },
];
/** UX-2: tools without a building thumbnail show their first-session icon (the road). */
const TOOL_ICON: Partial<Record<PlacementTool, UiIconCell<"building">>> = { road: "road", farmstead: "barn" };
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
};

const OPEN_ACCESS = tutorialAccess(false, 0);

export function BuildSeals({ selectedTool, state, highlightedTools = [], onSelect, palisadeDrawing = false, onStartPalisadeDrawing, zoneTool = null, onZoneToolChange,
  access = OPEN_ACCESS, layer = "direct", onLayerChange, pulse = null, openRequest = null, open, onOpenChange, showLayers = true }: BuildSealsProps) {
  const id = useId().replaceAll(":", "");
  const menuState = state ?? DEFAULT_GAME_STATE;
  // Era-locked buildings stay visible with their lock and the stage that opens them (UX-0 "잠긴 건물은 숨기지 말고").
  const options = buildMenuGroups(menuState, { includeEraLocked: true }).flatMap((group) => group.options);
  const [inputDevice, setInputDevice] = useState<InputDevice>(() => lastInputDevice());
  useEffect(() => subscribeInputDevice(setInputDevice), []);
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
  }, [openRequest]);
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
      <button key={card.target} type="button" className={`build-seal build-tool zone-tool${selected ? " build-tool--selected" : ""}${open ? "" : " build-tool--locked"}`}
        aria-label={card.label} aria-pressed={selected} aria-disabled={!open} data-zone-tool={card.target} data-pulse={pulsing(`zone:${card.target}`)}
        onClick={() => {
          if (!open) { setLockNote(`${card.label} · ${TUTORIAL_COPY.lockedTool}`); return; }
          setLockNote(null);
          onZoneToolChange?.({ target: card.target, radius: zoneTool?.radius ?? DEFAULT_ZONE_BRUSH_RADIUS, polygon: zoneTool?.polygon ?? false }); closeAfterPick();
        }}>
        <span className="build-tool-art" aria-hidden="true">
          {card.thumbnail !== null ? <img src={card.thumbnail} width="80" height="40" alt="" draggable={false} />
            : card.icon === null ? null : card.icon.sheet === "building" ? <UiIcon sheet="building" cell={card.icon.cell} size={48} /> : <UiIcon sheet="prediction" cell={card.icon.cell} size={48} />}
        </span>
        <span className="build-seal-label" aria-hidden="true">{card.label}</span>
        <span className="build-tool-cost">{card.hint}</span>
        {open ? null : <span className="build-tool-lock"><UiIcon sheet="lock" cell="locked" /> {TUTORIAL_COPY.locked}</span>}
      </button>
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
    return (
      <button key={option.tool} type="button"
        className={`build-seal build-tool${selected ? " build-tool--selected" : ""}${locked ? " build-tool--locked" : ""}`}
        aria-label={option.label} aria-describedby={`${id}-tool-${option.tool}`} aria-pressed={selected}
        aria-disabled={!toolAffordable} data-affordable={String(affordability.affordable)} data-locked={locked ? eraLock !== null ? "era" : "tutorial" : undefined}
        data-highlighted={highlightedTools.includes(option.tool) ? option.tool : undefined} data-pulse={pulsing(option.tool)}
        onMouseEnter={() => setPreview(option.tool)} onMouseLeave={() => setPreview(null)}
        onFocus={() => setPreview(option.tool)} onBlur={() => setPreview(null)}
        onClick={() => { if (toolAffordable) { onSelect(option.tool); closeAfterPick(); setPreview(null); setPinned(null); setLockNote(null); } else if (locked) { setLockNote(`${option.label} · ${lockText}`); setPinned(null); } else setPinned(option.tool); }}>
        <span id={`${id}-tool-${option.tool}`} className="visually-hidden">{buildToolTooltipLines(option.tool, menuState).join(". ")}</span>
        <span className="build-tool-art" aria-hidden="true">
          {thumbnail !== null ? <img src={thumbnail} width="80" height="64" alt="" draggable={false} />
            : TOOL_ICON[option.tool] !== undefined ? <UiIcon sheet="building" cell={TOOL_ICON[option.tool]!} size={48} /> : <BuildGlyph tool={option.tool} />}
        </span>
        <span className="build-seal-label" aria-hidden="true">{option.label}</span>
        <span className="build-tool-purpose">{BUILD_CARD_PURPOSE[option.tool]}</span>
        <span className="build-tool-cost">{buildCostLabel(option)}</span>
        {locked ? <span className="build-tool-lock"><UiIcon sheet="lock" cell="locked" /> {eraLock ?? TUTORIAL_COPY.locked}</span>
          : !affordability.affordable && <span className="build-tool-shortfall">{shortfallText(option, affordability.spendable)}</span>}
      </button>
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
          return <button key={item} type="button" className={`control-layer${item === "zone" ? " build-menu-category" : ""}${open ? "" : " control-layer--locked"}`}
            aria-pressed={active} aria-disabled={!open} data-layer={item} data-pulse={pulsing(`layer:${item}`)}
            onClick={() => {
              if (!open) { setLockNote(`${TUTORIAL_COPY.layers[item]} · ${item === "direction" ? TUTORIAL_COPY.lockedLayer.direction : TUTORIAL_COPY.lockedLayer.zone}`); setCatalogOpen(true); return; }
              setLockNote(null); setPinned(null);
              if (item === "zone") { onLayerChange?.("zone"); setCatalogOpen(!(catalogOpen && layer === "zone")); return; }
              onLayerChange?.(item); if (item === "direct") onZoneToolChange?.(null);
            }}>
            <UiIcon sheet="layer" cell={item} />{TUTORIAL_COPY.layers[item]}{open ? null : <UiIcon sheet="lock" cell="locked" className="control-layer-lock" />}
          </button>;
        })}
      </div> : null}
      <div className="build-menu-categories" role="group" aria-label={BUILD_MENU_COPY.categoryGroup} hidden={layer === "zone" || (open !== undefined && !catalogOpen)}>
        {BUILD_CATEGORIES.map((item) => {
          const open = access.categories[item.key];
          return (
          <button key={item.key} type="button" className={`build-menu-category${open ? "" : " build-menu-category--locked"}`}
            aria-pressed={category === item.key} aria-expanded={catalogOpen && category === item.key} aria-controls={`${id}-${item.key}`}
            aria-disabled={!open} data-category={item.key} data-pulse={pulsing(`category:${item.key}`)}
            onClick={() => {
              if (!open) { setLockNote(`${item.label} · ${TUTORIAL_COPY.lockedCategory[item.key as keyof typeof TUTORIAL_COPY.lockedCategory] ?? TUTORIAL_COPY.lockedTool}`); setCatalogOpen(true); setPinned(null); return; }
              setLockNote(null);
              onSelect(buildCategorySelection(item.key)); setDetailsOpen(false); setCatalogOpen(open !== undefined || !catalogOpen || category !== item.key); setCategory(item.key); setPreview(null); setPinned(null);
            }}>
            <UiIcon sheet="category" cell={item.key} />{item.label}{open ? null : <UiIcon sheet="lock" cell="locked" className="build-menu-category-lock" />}
            {options.some((option) => buildCategory(option.tool) === item.key && highlightedTools.includes(option.tool)) && <span className="build-menu-task" aria-label="현재 과업">·</span>}
          </button>
          );
        })}
      </div>
      </div>
      <div className="build-menu-body" hidden={!catalogOpen}>
        <div className="build-menu-quick-road" role="group" aria-label={KO_UI.roadTool}>{toolButton(ROAD_TOOL_OPTION)}</div>
        <div className="build-menu-catalog">
          {lockNote !== null ? <p className="build-menu-pinned build-menu-lock-note" role="status"><UiIcon sheet="lock" cell="locked" /> {lockNote}</p>
            : pinned === null ? null : <p className="build-menu-pinned" role="status">{buildToolTooltipLines(pinned, menuState).join(" · ")}</p>}
          {layer === "zone" && onZoneToolChange !== undefined ? <section id={`${id}-zone`} aria-label={`${TUTORIAL_COPY.layers.zone} 도구`} className="build-menu-tools">
            {/* UX-3R2: in the UX-3 shell the eraser, the polygon and the size are on the left zone toolbar. */}
            {ZONE_CARDS.filter(card => open === undefined || card.target !== "erase").map(card => zoneCard(card, access.zoneTargets(card.target)))}
          </section> : null}
          {BUILD_CATEGORIES.map((item) => (
            <section key={item.key} id={`${id}-${item.key}`} hidden={layer === "zone" || category !== item.key} aria-label={`${item.label} 도구`} className="build-menu-tools">
              {item.key === "trade" && access.arableCard && onZoneToolChange !== undefined ? zoneCard(ARABLE_CARD, true) : null}
              {options.filter((option) => buildCategory(option.tool) === item.key).map(toolButton)}
              {item.key === 'defense' && onStartPalisadeDrawing !== undefined ? (
                <button type="button" className={`build-seal build-tool${palisadeDrawing ? ' build-tool--selected' : ''}`}
                  aria-label={WALL_COPY.drawTool} aria-pressed={palisadeDrawing} aria-disabled={!palisadeReady}
                  onClick={() => { if (palisadeReady) { onStartPalisadeDrawing(); closeAfterPick(); } }}>
                  <span className="build-tool-art" aria-hidden="true"><UiIcon sheet="building" cell="palisade" size={48} /></span>
                  <span className="build-seal-label" aria-hidden="true">{WALL_COPY.drawTool}</span>
                  <span className="build-tool-cost">{WALL_COPY.drawCost}</span>
                  {!palisadeReady ? <span className="build-tool-shortfall">{palisadeReason}</span> : null}
                </button>
              ) : null}
              {item.key === "paths" && <p className="build-menu-empty">드래그로 길을 연결하세요. 강 양쪽을 직선으로 이으면 목교를 놓습니다.<br />다리는 물 한 칸당 목재 4, 최대 8칸입니다. 다리나 접속 길을 누르면 다리 전체를 걷습니다.</p>}
              {item.key === "defense" && !options.some((option) => buildCategory(option.tool) === "defense") && onStartPalisadeDrawing === undefined && <p className="build-menu-empty">성채는 석조 도시에서 건설할 수 있습니다.</p>}
            </section>
          ))}
        </div>
      </div>
      {open !== undefined && zoneTool === null && !palisadeDrawing ? null : <div className="build-menu-summary">
        {zoneTool !== null && onZoneToolChange !== undefined && open !== undefined ? zoneTool.target === "erase"
          ? <span className="zone-land-legend">{ZONE_BRUSH_COPY.eraserHint}</span> : <ZoneLandLegend kind={zoneTool.target} />
        : zoneTool !== null && onZoneToolChange !== undefined ? <>
          <strong>{zoneTool.target === "erase" ? ZONE_BRUSH_COPY.eraser : ZONE_KIND_LABELS[zoneTool.target]}</strong>
          <span className="zone-radius" role="group" aria-label={ZONE_BRUSH_COPY.radiusHint}>
            {ZONE_BRUSH_RADII.map(radius => (
              <button key={radius} type="button" className="zone-radius-button" aria-pressed={zoneTool.radius === radius}
                onClick={() => onZoneToolChange({ ...zoneTool, radius })}>{ZONE_BRUSH_COPY.radius(radius)}</button>
            ))}
          </span>
          <button type="button" className="zone-polygon-toggle" aria-pressed={zoneTool.polygon}
            onClick={() => onZoneToolChange({ ...zoneTool, polygon: !zoneTool.polygon })}>{ZONE_BRUSH_COPY.polygonToggle}</button>
          {zoneTool.polygon ? <span className="zone-polygon-hint">{ZONE_BRUSH_COPY.polygonToggleHint}</span> : null}
        </> : palisadeDrawing ? <><strong>{WALL_COPY.drawTool}</strong><span>{WALL_COPY.drawHint}</span></>
          : selectedTool === null && preview === null ? <span className="build-menu-pick">{TUTORIAL_COPY.pickTool}</span> : <>
          <strong>{detailOption.label}</strong><span>{buildCostLabel(detailOption)}</span>
          {radius !== undefined && radius > 0 && <span>반경 {radius}칸</span>}
          {service && <span>수용 {service.capacity}필지</span>}
        </>}
        {open !== undefined ? null : <button type="button" className="build-info-toggle" aria-label="선택 도구 상세 안내" aria-expanded={detailsOpen} aria-controls={`${id}-details`} onClick={() => { setCatalogOpen(false); setDetailsOpen(!detailsOpen); }}><UiIcon sheet="action" cell="log" size={32} /></button>}
      </div>}
      <div id={`${id}-details`} className="build-menu-details" aria-label="건설 안내" hidden={!detailsOpen}>
        {palisadeDrawing ? <p>{WALL_COPY.drawHint}</p> : selectedOption === null ? <p>선택 도구 없음 · 건설 카드를 눌러 도구를 선택하세요.</p> : <>
          <div className="build-menu-detail-heading"><strong>{selectedOption.label}</strong><span>{buildCostLabel(selectedOption)}</span></div>
          <p>{selectedOption.purpose}</p><p>{selectedOption.requirements.join(" · ")}</p>
          <p className={buildToolAffordability(selectedOption.tool, menuState).affordable ? "build-menu-ready" : "build-menu-shortfall"}>{buildToolTooltipLines(selectedOption.tool, menuState).at(-1)}</p>
        </>}
      </div>
      {open !== undefined ? null : <div className="build-menu-instruction">{zoneTool === null ? INPUT_HINT_COPY[inputDevice]
        : inputDevice === "mouse" ? zoneTool.target === "erase" ? ZONE_BRUSH_COPY.eraserStatus : ZONE_BRUSH_COPY.status(ZONE_KIND_LABELS[zoneTool.target])
        : zoneTool.target === "erase" ? ZONE_BRUSH_HINT_COPY[inputDevice].eraser : ZONE_BRUSH_HINT_COPY[inputDevice].status(ZONE_KIND_LABELS[zoneTool.target])}</div>}
    </div>
  );
}

const RESOURCE_LABELS = { wheat: "밀", bread: "빵", logs: "통나무", timber: "목재", stone_raw: "원석", stone: "석재", coin: MONEY_LABEL } as const satisfies Record<ResourceType, string>;

function shortfallText(option: BuildToolOption, spendable: Partial<Record<ResourceType, number>>): string {
  return RESOURCE_TYPES.filter(resource => (option.cost[resource] ?? 0) > (spendable[resource] ?? 0))
    .map(resource => `${RESOURCE_LABELS[resource]} 부족 ${spendable[resource] ?? 0}/${option.cost[resource] ?? 0}`)
    .join(" · ");
}
