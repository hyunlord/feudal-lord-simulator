import type { ReactElement } from "react";

import type { HouseDiagnosisModel } from "../ui/houseDiagnosisModel";
import type { WalkerDiagnosisModel } from "../ui/walkerDiagnosisModel";
import type { ConstructionSiteCardModel } from "../ui/constructionSiteCardModel";

type Size = Readonly<{ width: number; height: number }>;
type Rect = Readonly<{ x: number; y: number; width: number; height: number }>;
type Position = Readonly<{ x: number; y: number }>;

export type DiagnosticCardModel =
  | { readonly kind: "house"; readonly value: HouseDiagnosisModel }
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

function HouseCard({ model }: { readonly model: HouseDiagnosisModel }): ReactElement {
  return (
    <aside className="diagnostic-card" aria-label={`${model.name} 원인 진단`}>
      <h2>{model.name}</h2>
      <p>등급 {model.level} · 주민 {model.residents}명</p>
      <dl>
        <div><dt>물</dt><dd>{model.water.label}</dd></div>
        <div><dt>빵</dt><dd>{model.bread.label}</dd></div>
        <div><dt>인구</dt><dd>{model.population.label}</dd></div>
      </dl>
    </aside>
  );
}

function WalkerCard({ model }: { readonly model: WalkerDiagnosisModel }): ReactElement {
  return (
    <aside className="diagnostic-card" aria-label={`${model.roleLabel} 임무 진단`}>
      <h2>{model.roleLabel}</h2>
      <dl>
        <div><dt>화물</dt><dd>{model.cargoLabel}</dd></div>
        <div><dt>출발</dt><dd>{model.sourceLabel}</dd></div>
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
    </aside>
  );
}

function ConstructionSiteCard({
  model,
  onCancelConstruction,
}: {
  readonly model: ConstructionSiteCardModel;
  readonly onCancelConstruction?: (siteId: string) => void;
}): ReactElement {
  return (
    <aside className="diagnostic-card diagnostic-card--site" aria-label={`${model.name} 건설 진단`}>
      <h2>{model.name}</h2>
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
        onClick={() => onCancelConstruction?.(model.siteId)}
      >
        공사 포기
      </button>
    </aside>
  );
}

export function DiagnosticCard({
  model,
  onCancelConstruction,
  position,
}: Readonly<{
  model: DiagnosticCardModel;
  onCancelConstruction?: (siteId: string) => void;
  position: Position;
}>): ReactElement {
  const clampedLeft = `min(${position.x}px, calc(100% - min(300px, calc(100% - 16px)) - 8px))`;

  return (
    <div className="diagnostic-card-position" style={{ left: clampedLeft, top: position.y }}>
      {model.kind === "house" ? <HouseCard model={model.value} /> : null}
      {model.kind === "walker" ? <WalkerCard model={model.value} /> : null}
      {model.kind === "construction_site"
        ? onCancelConstruction === undefined
          ? <ConstructionSiteCard model={model.value} />
          : <ConstructionSiteCard model={model.value} onCancelConstruction={onCancelConstruction} />
        : null}
    </div>
  );
}
