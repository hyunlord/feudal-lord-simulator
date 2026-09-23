import { useEffect, useId, useState } from "react";

import { BUILDING_CONFIG_BY_KIND } from "../content/buildingConfig";
import { RESOURCE_TYPES, type ResourceType } from "../content/resourceConfig";
import { HOUSEHOLD_SERVICE_CONFIG } from "../population/serviceAllocation";

import { KO_UI } from "../content/locale.ko";
import type { GameState } from "../engine/engine.types";
import type { PlacementTool } from "../render/renderer";
import { DEFAULT_GAME_STATE } from "../state/gameStore";
import { BuildGlyph } from "./BuildGlyph";
import { buildMenuGroups, buildToolAffordability, buildToolTooltipLines, ROAD_TOOL_OPTION, type BuildToolOption } from "./buildMenuModel";
import { BUILD_CATEGORIES, buildCategory, buildCostLabel, buildThumbnail, type BuildCategory } from "./buildMenuPresentation";

type BuildSealsProps = {
  readonly selectedTool: PlacementTool | null;
  readonly state?: GameState;
  readonly highlightedTools?: readonly PlacementTool[];
  readonly onSelect: (tool: PlacementTool | null) => void;
};

export function BuildSeals({ selectedTool, state, highlightedTools = [], onSelect }: BuildSealsProps) {
  const id = useId().replaceAll(":", "");
  const menuState = state ?? DEFAULT_GAME_STATE;
  const options = buildMenuGroups(menuState).flatMap((group) => group.options);
  const [category, setCategory] = useState<BuildCategory>(() => {
    const initialTool = selectedTool ?? highlightedTools[0] ?? "house";
    return buildCategory(initialTool);
  });
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [preview, setPreview] = useState<PlacementTool | null>(null);
  useEffect(() => {
    if (selectedTool !== null) setCategory(buildCategory(selectedTool));
  }, [selectedTool]);
  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.code !== "Escape") return;
      setCatalogOpen(false);
      setDetailsOpen(false);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);
  const visibleOptions = options.filter((option) => buildCategory(option.tool) === category);
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
        title={buildToolTooltipLines(option.tool, menuState).join("\n")}
        onMouseEnter={() => setPreview(option.tool)} onMouseLeave={() => setPreview(null)}
        onFocus={() => setPreview(option.tool)} onBlur={() => setPreview(null)}
        onClick={() => { if (toolAffordable) { onSelect(option.tool); setCatalogOpen(false); setPreview(null); } }}>
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
            onClick={() => { setDetailsOpen(false); setCatalogOpen(!catalogOpen || category !== item.key); setCategory(item.key); setPreview(null); }}>
            {item.label}
            {options.some((option) => buildCategory(option.tool) === item.key && highlightedTools.includes(option.tool)) && <span className="build-menu-task" aria-label="현재 과업">·</span>}
          </button>
        ))}
      </div>
      <div className="build-menu-body" hidden={!catalogOpen}>
        <div className="build-menu-quick-road" role="group" aria-label={KO_UI.roadTool}>{toolButton(ROAD_TOOL_OPTION)}</div>
        <div className="build-menu-catalog">
          {BUILD_CATEGORIES.map((item) => (
            <section key={item.key} id={`${id}-${item.key}`} hidden={category !== item.key} aria-label={`${item.label} 도구`} className="build-menu-tools">
              {options.filter((option) => buildCategory(option.tool) === item.key).map(toolButton)}
              {item.key === "road" && <p className="build-menu-empty">드래그로 길을 연결하세요. 강 양쪽을 직선으로 이으면 목교를 놓습니다.<br />다리는 물 한 칸당 목재 4, 최대 8칸입니다. 다리나 접속 길을 누르면 다리 전체를 걷습니다.</p>}
              {item.key === "defense" && !options.some((option) => buildCategory(option.tool) === "defense") && <p className="build-menu-empty">성채는 석조 도시에서 건설할 수 있습니다.</p>}
            </section>
          ))}
        </div>
      </div>
      <div className="build-menu-summary">
        <strong>{detailOption.label}</strong><span>{buildCostLabel(detailOption)}</span>
        {radius !== undefined && radius > 0 && <span>반경 {radius}칸</span>}
        {service && <span>수용 {service.capacity}필지</span>}
        <button type="button" className="build-info-toggle" aria-label="선택 도구 상세 안내" aria-expanded={detailsOpen} aria-controls={`${id}-details`} onClick={() => { setCatalogOpen(false); setDetailsOpen(!detailsOpen); }}>i</button>
      </div>
      <div id={`${id}-details`} className="build-menu-details" aria-label="건설 안내" hidden={!detailsOpen}>
        {selectedOption === null ? <p>선택 도구 없음 · 건설 카드를 눌러 도구를 선택하세요.</p> : <>
          <div className="build-menu-detail-heading"><strong>{selectedOption.label}</strong><span>{buildCostLabel(selectedOption)}</span></div>
          <p>{selectedOption.purpose}</p><p>{selectedOption.requirements.join(" · ")}</p>
          <p className={buildToolAffordability(selectedOption.tool, menuState).affordable ? "build-menu-ready" : "build-menu-shortfall"}>{buildToolTooltipLines(selectedOption.tool, menuState).at(-1)}</p>
        </>}
      </div>
      <div className="build-menu-instruction">클릭 설치 · Esc/우클릭 취소 · 휠 확대 · O 문제 보기</div>
    </div>
  );
}

const RESOURCE_LABELS = { wheat: "밀", bread: "빵", logs: "통나무", timber: "목재", stone_raw: "원석", stone: "석재", coin: "금화" } as const satisfies Record<ResourceType, string>;

function shortfallText(option: BuildToolOption, spendable: Partial<Record<ResourceType, number>>): string {
  return RESOURCE_TYPES.filter(resource => (option.cost[resource] ?? 0) > (spendable[resource] ?? 0))
    .map(resource => `${RESOURCE_LABELS[resource]} 부족 ${spendable[resource] ?? 0}/${option.cost[resource] ?? 0}`)
    .join(" · ");
}
