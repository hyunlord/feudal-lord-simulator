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
import { buildMenuGroups, buildToolAffordability, buildToolTooltipLines, ROAD_TOOL_OPTION, type BuildToolOption } from "./buildMenuModel";
import { BUILD_CATEGORIES, buildCategory, buildCategorySelection, buildCostLabel, buildThumbnail, type BuildCategory } from "./buildMenuPresentation";
import { DEFAULT_ZONE_BRUSH_RADIUS, ZONE_BRUSH_RADII, type ZoneBrushTarget, type ZoneBrushTool } from "../render/zoneBrushInteraction";
import { ZONE_BRUSH_COPY } from "../render/zoneBrushCopy.ko";
import { ZONE_KIND_LABELS } from "../zones/zoneCopy.ko";
import { platformServices } from "../platform/platform";
import { INTENT_ORDER } from "../input/intentBus";
import { lastInputDevice, subscribeInputDevice, type InputDevice } from "../input/inputDevice";
import { INPUT_HINT_COPY } from "./inputHintCopy.ko";

/** Zone cards (C1b): plots, arable, pasture, orchard and the eraser. Hay meadow and woodland come with C1c. */
const ZONE_CARDS: readonly { readonly target: ZoneBrushTarget; readonly label: string; readonly hint: string; readonly glyph: string; readonly thumbnail: string | null }[] = [
  { target: "burgage", label: ZONE_KIND_LABELS.burgage, hint: ZONE_BRUSH_COPY.cardHint.burgage, glyph: "⌂", thumbnail: null },
  { target: "arable", label: ZONE_KIND_LABELS.arable, hint: ZONE_BRUSH_COPY.cardHint.arable, glyph: "≡", thumbnail: null },
  { target: "pasture", label: ZONE_KIND_LABELS.pasture, hint: ZONE_BRUSH_COPY.cardHint.pasture, glyph: "", thumbnail: "/assets/zones/pasture_a-v1.png" },
  { target: "orchard", label: ZONE_KIND_LABELS.orchard, hint: ZONE_BRUSH_COPY.cardHint.orchard, glyph: "", thumbnail: "/assets/zones/orchard_floor_a-v1.png" },
  { target: "erase", label: ZONE_BRUSH_COPY.eraser, hint: ZONE_BRUSH_COPY.eraserHint, glyph: "⌫", thumbnail: null },
];

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
};

export function BuildSeals({ selectedTool, state, highlightedTools = [], onSelect, palisadeDrawing = false, onStartPalisadeDrawing, zoneTool = null, onZoneToolChange }: BuildSealsProps) {
  const id = useId().replaceAll(":", "");
  const menuState = state ?? DEFAULT_GAME_STATE;
  const options = buildMenuGroups(menuState).flatMap((group) => group.options);
  const [inputDevice, setInputDevice] = useState<InputDevice>(() => lastInputDevice());
  useEffect(() => subscribeInputDevice(setInputDevice), []);
  const [category, setCategory] = useState<BuildCategory>(() => {
    const initialTool = selectedTool ?? highlightedTools[0] ?? "house";
    return buildCategory(initialTool);
  });
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [preview, setPreview] = useState<PlacementTool | null>(null);
  // A tapped card that cannot be built yet: its tooltip lines stay visible in the catalogue (no hover needed).
  const [pinned, setPinned] = useState<PlacementTool | null>(null);
  useEffect(() => {
    if (selectedTool !== null) setCategory(buildCategory(selectedTool));
  }, [selectedTool]);
  // Esc (the global `cancel` intent, after the map and the app shell) closes the catalog and the details (B9).
  useEffect(() => platformServices().input.subscribe(intent => {
    if (intent.kind !== "cancel" || intent.world !== undefined) return;
    setCatalogOpen(false);
    setDetailsOpen(false);
  }, INTENT_ORDER.menu), []);
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

  const toolButton = (option: BuildToolOption) => {
    const affordability = buildToolAffordability(option.tool, menuState);
    const toolAffordable = affordability.affordable;
    const selected = selectedTool === option.tool;
    const thumbnail = buildThumbnail(option.tool);
    return (
      <button key={option.tool} type="button"
        className={`build-seal build-tool${selected ? " build-tool--selected" : ""}`}
        aria-label={option.label} aria-describedby={`${id}-tool-${option.tool}`} aria-pressed={selected}
        aria-disabled={!toolAffordable} data-affordable={String(toolAffordable)}
        data-highlighted={highlightedTools.includes(option.tool) ? option.tool : undefined}
        onMouseEnter={() => setPreview(option.tool)} onMouseLeave={() => setPreview(null)}
        onFocus={() => setPreview(option.tool)} onBlur={() => setPreview(null)}
        onClick={() => { if (toolAffordable) { onSelect(option.tool); setCatalogOpen(false); setPreview(null); setPinned(null); } else setPinned(option.tool); }}>
        <span id={`${id}-tool-${option.tool}`} className="visually-hidden">{buildToolTooltipLines(option.tool, menuState).join(". ")}</span>
        <span className="build-tool-art" aria-hidden="true">
          {thumbnail === null ? <BuildGlyph tool={option.tool} /> : <img src={thumbnail} width="80" height="64" alt="" draggable={false} />}
        </span>
        <span className="build-seal-label" aria-hidden="true">{option.label}</span>
        {option.tool === "market" ? <span className="build-tool-purpose">남는 물자를 팔아 재정 수입</span> : null}
        <span className="build-tool-cost">{buildCostLabel(option)}</span>
        {!toolAffordable && <span className="build-tool-shortfall">{shortfallText(option, affordability.spendable)}</span>}
      </button>
    );
  };

  return (
    <div className="build-menu" role="group" aria-label={KO_UI.placementSeals}>
      <div className="build-menu-categories" role="group" aria-label="건설 분류">
        {BUILD_CATEGORIES.map((item) => (
          <button key={item.key} type="button" className="build-menu-category"
            aria-pressed={category === item.key} aria-expanded={catalogOpen && category === item.key} aria-controls={`${id}-${item.key}`}
            onClick={() => { onSelect(buildCategorySelection(item.key)); setDetailsOpen(false); setCatalogOpen(!catalogOpen || category !== item.key); setCategory(item.key); setPreview(null); setPinned(null); }}>
            {item.label}
            {options.some((option) => buildCategory(option.tool) === item.key && highlightedTools.includes(option.tool)) && <span className="build-menu-task" aria-label="현재 과업">·</span>}
          </button>
        ))}
      </div>
      <div className="build-menu-body" hidden={!catalogOpen}>
        <div className="build-menu-quick-road" role="group" aria-label={KO_UI.roadTool}>{toolButton(ROAD_TOOL_OPTION)}</div>
        <div className="build-menu-catalog">
          {pinned === null ? null : <p className="build-menu-pinned" role="status">{buildToolTooltipLines(pinned, menuState).join(" · ")}</p>}
          {BUILD_CATEGORIES.map((item) => (
            <section key={item.key} id={`${id}-${item.key}`} hidden={category !== item.key} aria-label={`${item.label} 도구`} className="build-menu-tools">
              {options.filter((option) => buildCategory(option.tool) === item.key).map(toolButton)}
              {item.key === 'defense' && onStartPalisadeDrawing !== undefined ? (
                <button type="button" className={`build-seal build-tool${palisadeDrawing ? ' build-tool--selected' : ''}`}
                  aria-label={WALL_COPY.drawTool} aria-pressed={palisadeDrawing} aria-disabled={!palisadeReady}
                  onClick={() => { if (palisadeReady) { onStartPalisadeDrawing(); setCatalogOpen(false); } }}>
                  <span className="build-tool-art" aria-hidden="true">⌁</span>
                  <span className="build-seal-label" aria-hidden="true">{WALL_COPY.drawTool}</span>
                  <span className="build-tool-cost">{WALL_COPY.drawCost}</span>
                  {!palisadeReady ? <span className="build-tool-shortfall">{palisadeReason}</span> : null}
                </button>
              ) : null}
              {item.key === "zone" && onZoneToolChange !== undefined ? ZONE_CARDS.map(card => {
                const selected = zoneTool?.target === card.target;
                return (
                  <button key={card.target} type="button" className={`build-seal build-tool zone-tool${selected ? " build-tool--selected" : ""}`}
                    aria-label={card.label} aria-pressed={selected} data-zone-tool={card.target}
                    onClick={() => { onZoneToolChange({ target: card.target, radius: zoneTool?.radius ?? DEFAULT_ZONE_BRUSH_RADIUS, polygon: zoneTool?.polygon ?? false }); setCatalogOpen(false); }}>
                    <span className="build-tool-art" aria-hidden="true">
                      {card.thumbnail === null ? <span className="zone-tool-glyph">{card.glyph}</span> : <img src={card.thumbnail} width="80" height="40" alt="" draggable={false} />}
                    </span>
                    <span className="build-seal-label" aria-hidden="true">{card.label}</span>
                    <span className="build-tool-cost">{card.hint}</span>
                  </button>
                );
              }) : null}
              {item.key === "road" && <p className="build-menu-empty">드래그로 길을 연결하세요. 강 양쪽을 직선으로 이으면 목교를 놓습니다.<br />다리는 물 한 칸당 목재 4, 최대 8칸입니다. 다리나 접속 길을 누르면 다리 전체를 걷습니다.</p>}
              {item.key === "defense" && !options.some((option) => buildCategory(option.tool) === "defense") && onStartPalisadeDrawing === undefined && <p className="build-menu-empty">성채는 석조 도시에서 건설할 수 있습니다.</p>}
            </section>
          ))}
        </div>
      </div>
      <div className="build-menu-summary">
        {zoneTool !== null && onZoneToolChange !== undefined ? <>
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
        </> : palisadeDrawing ? <><strong>{WALL_COPY.drawTool}</strong><span>{WALL_COPY.drawHint}</span></> : <>
          <strong>{detailOption.label}</strong><span>{buildCostLabel(detailOption)}</span>
          {radius !== undefined && radius > 0 && <span>반경 {radius}칸</span>}
          {service && <span>수용 {service.capacity}필지</span>}
        </>}
        <button type="button" className="build-info-toggle" aria-label="선택 도구 상세 안내" aria-expanded={detailsOpen} aria-controls={`${id}-details`} onClick={() => { setCatalogOpen(false); setDetailsOpen(!detailsOpen); }}>i</button>
      </div>
      <div id={`${id}-details`} className="build-menu-details" aria-label="건설 안내" hidden={!detailsOpen}>
        {palisadeDrawing ? <p>{WALL_COPY.drawHint}</p> : selectedOption === null ? <p>선택 도구 없음 · 건설 카드를 눌러 도구를 선택하세요.</p> : <>
          <div className="build-menu-detail-heading"><strong>{selectedOption.label}</strong><span>{buildCostLabel(selectedOption)}</span></div>
          <p>{selectedOption.purpose}</p><p>{selectedOption.requirements.join(" · ")}</p>
          <p className={buildToolAffordability(selectedOption.tool, menuState).affordable ? "build-menu-ready" : "build-menu-shortfall"}>{buildToolTooltipLines(selectedOption.tool, menuState).at(-1)}</p>
        </>}
      </div>
      <div className="build-menu-instruction">{zoneTool !== null ? zoneTool.target === "erase" ? ZONE_BRUSH_COPY.eraserStatus
        : ZONE_BRUSH_COPY.status(ZONE_KIND_LABELS[zoneTool.target]) : INPUT_HINT_COPY[inputDevice]}</div>
    </div>
  );
}

const RESOURCE_LABELS = { wheat: "밀", bread: "빵", logs: "통나무", timber: "목재", stone_raw: "원석", stone: "석재", coin: MONEY_LABEL } as const satisfies Record<ResourceType, string>;

function shortfallText(option: BuildToolOption, spendable: Partial<Record<ResourceType, number>>): string {
  return RESOURCE_TYPES.filter(resource => (option.cost[resource] ?? 0) > (spendable[resource] ?? 0))
    .map(resource => `${RESOURCE_LABELS[resource]} 부족 ${spendable[resource] ?? 0}/${option.cost[resource] ?? 0}`)
    .join(" · ");
}
