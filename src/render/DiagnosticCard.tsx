import type { ReactElement } from "react";

import type { HouseProgressModel } from "../ui/houseProgressModel";
import type { HouseDiagnosisModel } from "../ui/houseDiagnosisModel";
import type { WalkerDiagnosisModel } from "../ui/walkerDiagnosisModel";
import type { ConstructionSiteCardModel } from "../ui/constructionSiteCardModel";

import { BuildGlyph } from "../ui/BuildGlyph";
import { buildThumbnail } from "../ui/buildMenuPresentation";
import type { BuildingInspectorModel } from "./buildingInspectorModel";

type Size = Readonly<{ width: number; height: number }>;
type Rect = Readonly<{ x: number; y: number; width: number; height: number }>;
type Position = Readonly<{ x: number; y: number }>;

export type DiagnosticCardModel =
  | { readonly kind: "house"; readonly value: HouseDiagnosisModel }
  | { readonly kind: "building"; readonly value: BuildingInspectorModel }
  | { readonly kind: "walker"; readonly value: WalkerDiagnosisModel }
  | { readonly kind: "construction_site"; readonly value: ConstructionSiteCardModel };

function fits(position: Position, viewport: Size, card: Size): boolean {
  return position.x >= 8
    && position.y >= 8
    && position.x + card.width <= viewport.width - 8
    && position.y + card.height <= viewport.height - 8;
}

export function placeDiagnosticCard(viewport: Size, target: Rect, card: Size): Position {
  const gap = 12;
  const candidates = [
    { x: target.x + target.width + gap, y: target.y },
    { x: target.x - card.width - gap, y: target.y },
    { x: target.x, y: target.y + target.height + gap },
    { x: target.x, y: target.y - card.height - gap },
  ];
  const fitting = candidates.find((candidate) => fits(candidate, viewport, card));
  if (fitting !== undefined) return fitting;

  const below = target.y + target.height + gap;
  const above = target.y - card.height - gap;
  return {
    x: Math.min(viewport.width - card.width - 8, Math.max(8, target.x)),
    y: below + card.height <= viewport.height - 8
      ? below
      : Math.max(8, above),
  };
}

function HouseCard({ model, onDemolishHouse, onMergeHouses }: {
  readonly model: HouseDiagnosisModel;
  readonly onDemolishHouse: ((buildingId: string) => void) | undefined;
  readonly onMergeHouses: ((sourceBuildingId: string, targetBuildingId: string) => void) | undefined;
}): ReactElement {
  return (
    <>
      <p>생활 등급 {model.level} · 주민 {model.residents}명 / 정원 {model.capacity}명 · {model.footprintLabel}칸</p>
      <dl>
        <div><dt>건축 단계</dt><dd>{model.builtLevel}단계 · {model.conditionLabel}</dd></div>
        <div><dt>물</dt><dd>{model.water.label}</dd></div>
        <div><dt>빵</dt><dd>{model.bread.label}</dd></div>
        <div><dt>인구</dt><dd>{model.population.label}</dd></div>
      </dl>
      <details className="inspector-development">
        <summary>주택 발전 조건</summary>
        <dl>
          <div><dt>성벽</dt><dd>{model.protection.label}</dd></div>
          <div><dt>시장</dt><dd>{model.market.label}</dd></div>
          <div><dt>교회</dt><dd>{model.church.label}</dd></div>
          <div><dt>도시 대가옥</dt><dd>{model.stoneHouse.label}</dd></div>
        </dl>
      </details>
      <section className="inspector-actions inspector-merge" aria-label="인접 주택 합필">
        <h3>인접 주택 합필</h3>
        <p>{model.mergeStatus}</p>
        {model.mergeOptions.map((option) => (
          <div key={option.targetBuildingId}>
            <button
              type="button"
              className="diagnostic-card-merge"
              data-action="merge-houses"
              data-target-building-id={option.targetBuildingId}
              disabled={!option.enabled || onMergeHouses === undefined}
              onClick={() => {
                if (option.enabled) onMergeHouses?.(model.buildingId, option.targetBuildingId);
              }}
            >{option.label}</button>
            {option.reason === null ? null : <p>{option.reason}</p>}
          </div>
        ))}
      </section>
      {onDemolishHouse === undefined ? null : (
        <section className="inspector-actions">
          <p>철거하면 주민 {model.residents}명이 떠납니다. 자재와 보관 식량은 반환되지 않습니다.</p>
          <button
            type="button"
            className="diagnostic-card-cancel"
            data-action="demolish-house"
            onClick={() => onDemolishHouse(model.buildingId)}
          >
            주택 철거
          </button>
        </section>
      )}
    </>
  );
}

function WalkerCard({ model }: { readonly model: WalkerDiagnosisModel }): ReactElement {
  return (
    <>
      <dl>
        <div><dt>화물</dt><dd>{model.cargoLabel}</dd></div>
        <div><dt>출발</dt><dd>{model.sourceLabel}</dd></div>
        {model.sourceDirectionLabel === null || model.sourceDistance === null ? null : (
          <div><dt>출발 위치</dt><dd>{model.sourceDirectionLabel} {model.sourceDistance}칸</dd></div>
        )}
        <div><dt>목적</dt><dd>{model.destinationLabel}</dd></div>
        <div><dt>상태</dt><dd>{model.statusLabel}</dd></div>
        <div><dt>남은 길</dt><dd>거리 {model.remainingDistance} · 예상 {model.etaTicks}틱</dd></div>
        <div><dt>통과</dt><dd>지난 집 {model.housesPassed}</dd></div>
        {model.tilesTravelled === null ? null : (
          <div><dt>순회</dt><dd>이동 {model.tilesTravelled}칸</dd></div>
        )}
        {model.cancellationLabel === null ? null : (
          <div><dt>취소</dt><dd>{model.cancellationLabel}</dd></div>
        )}
      </dl>
    </>
  );
}

function ConstructionSiteCard({
  model,
  onCancelConstruction,
}: {
  readonly model: ConstructionSiteCardModel;
  readonly onCancelConstruction?: (siteId: string) => void;
}): ReactElement {
  const cancellation = model.cancellation ?? { enabled: true, reason: null };
  const cancellationEnabled = cancellation.enabled;
  return (
    <>
      {model.currentStallLabel === "" ? null : <p>{model.currentStallLabel}</p>}
      <dl>
        {model.rows.map((row) => (
          <div key={row.label}><dt>{row.label}</dt><dd>{row.value}</dd></div>
        ))}
      </dl>
      <button
        type="button"
        className="diagnostic-card-cancel"
        data-action="cancel-construction"
        disabled={!cancellationEnabled}
        title={cancellation.reason ?? undefined}
        onClick={() => {
          if (cancellationEnabled) onCancelConstruction?.(model.siteId);
        }}
      >
        {cancellationEnabled ? "공사 포기" : "공사 포기 불가"}
      </button>
      {cancellation.reason === null ? null : <p>{cancellation.reason}</p>}
    </>
  );
}

function cardIdentity(model: DiagnosticCardModel): Readonly<{ name: string; type: string; label: string; art: ReactElement }> {
  switch (model.kind) {
    case "house": return {
      name: model.value.name, type: `주택 · 생활 등급 ${model.value.level}`, label: `${model.value.name} 원인 진단`,
      art: model.value.thumbnailUrl === null
        ? <span>{model.value.footprintLabel} 주택</span>
        : <img src={model.value.thumbnailUrl} alt="" />,
    };
    case "building": {
      const source = buildThumbnail(model.value.kind);
      return { name: model.value.name, type: "도시 시설", label: `${model.value.name} 시설 진단`,
        art: source === null ? <BuildGlyph tool={model.value.kind} /> : <img src={source} alt="" /> };
    }
    case "walker": return { name: model.value.roleLabel, type: "주민 · 이동과 운송", label: `${model.value.roleLabel} 임무 진단`, art: <span>이동</span> };
    case "construction_site": return { name: model.value.name, type: "건설 현장", label: `${model.value.name} 건설 진단`, art: <span>공사</span> };
  }
}

export function DiagnosticCard({
  model,
  causeSummary,
  onDemolishHouse,
  onMergeHouses,
  onCancelConstruction,
  onClose,
}: Readonly<{
  model: DiagnosticCardModel;
  causeSummary?: HouseProgressModel | null;
  onDemolishHouse?: (buildingId: string) => void;
  onMergeHouses?: (sourceBuildingId: string, targetBuildingId: string) => void;
  onCancelConstruction?: (siteId: string) => void;
  onClose?: () => void;
  position: Position;
}>): ReactElement {
  const identity = cardIdentity(model);
  return (
    <div className="diagnostic-card-position" onKeyDown={(event) => {
      event.stopPropagation();
      if (event.key === "Escape") onClose?.();
    }}>
      <aside className="diagnostic-card" aria-label={identity.label}>
        <header className="inspector-heading">
          <div className="inspector-thumbnail" aria-hidden="true">{identity.art}</div>
          <div><p>{identity.type}</p><h2>{identity.name}</h2></div>
          {onClose === undefined ? null : <button className="inspector-close" type="button" aria-label="상세 정보 닫기" onClick={onClose}>×</button>}
        </header>
        {causeSummary == null ? null : <div className="inspector-cause-summary">
          다음: {causeSummary.nextLevel === null ? '최고 단계' : `L${causeSummary.nextLevel}`} / 첫 방해: {causeSummary.blocker?.label ?? (causeSummary.status === 'ready' ? '없음 · 승급 대기' : '없음')}
        </div>}
        <div className="inspector-body">
          {model.kind === "house" ? <HouseCard model={model.value} onDemolishHouse={onDemolishHouse} onMergeHouses={onMergeHouses} /> : null}
          {model.kind === "walker" ? <WalkerCard model={model.value} /> : null}
          {model.kind === "building" ? <><p>{model.value.purpose}</p><h3>운영과 재고</h3><ul className="inspector-facts">{model.value.rows.map((row) => <li key={row}>{row}</li>)}</ul></> : null}
          {model.kind === "construction_site"
            ? onCancelConstruction === undefined
              ? <ConstructionSiteCard model={model.value} />
              : <ConstructionSiteCard model={model.value} onCancelConstruction={onCancelConstruction} />
            : null}
        </div>
      </aside>
    </div>
  );
}
