import { UiIcon } from "../ui/UiIcon";
import { BUILDING_OPERATION_COPY } from '../ui/buildingOperationCopy.ko';
import { durationLabel } from "../ui/gameTimeCopy.ko";
import type { ReactElement } from "react";
import { BALANCE } from "../content/balanceConfig";

import type { HouseProgressModel } from "../ui/houseProgressModel";
import type { HouseDiagnosisModel } from "../ui/houseDiagnosisModel";
import type { WalkerDiagnosisModel } from "../ui/walkerDiagnosisModel";
import type { PersonRow, WalkerHeadline } from "../ui/persons/personModels";
import { PersonList, PersonPortrait } from "../ui/persons/PersonViews";
import { PERSONS_COPY } from "../ui/persons/personsCopy.ko";
import type { ConstructionSiteCardModel } from "../ui/constructionSiteCardModel";

import { BuildGlyph } from "../ui/BuildGlyph";
import { buildThumbnail } from "../ui/buildMenuPresentation";
import type { BuildingInspectorModel } from "./buildingInspectorModel";
import type { StoreInspectorModel } from "../ui/storeInspectorModel";
import { StoreInspectorBody } from "../ui/StoreInspector";
import { STORE_INSPECTOR_COPY } from "../ui/storeInspectorCopy.ko";
import { Button, Disclosure } from "../ui/kit";

type Size = Readonly<{ width: number; height: number }>;
type Rect = Readonly<{ x: number; y: number; width: number; height: number }>;
type Position = Readonly<{ x: number; y: number }>;

export type DiagnosticCardModel =
  | { readonly kind: "house"; readonly value: HouseDiagnosisModel }
  | { readonly kind: "building"; readonly value: BuildingInspectorModel }
  | { readonly kind: "walker"; readonly value: WalkerDiagnosisModel }
  | { readonly kind: "construction_site"; readonly value: ConstructionSiteCardModel }
  /** UX-3R2: a storehouse or granary (capacity, items, the week's change, who uses it). */
  | { readonly kind: "store"; readonly value: StoreInspectorModel };

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

function HouseCard({ model, onDemolishHouse, onMergeHouses, members, onPerson }: {
  readonly model: HouseDiagnosisModel;
  readonly onDemolishHouse: ((buildingId: string) => void) | undefined;
  readonly onMergeHouses: ((sourceBuildingId: string, targetBuildingId: string) => void) | undefined;
  readonly members: readonly PersonRow[];
  readonly onPerson: ((personId: string) => void) | undefined;
}): ReactElement {
  return (
    <>
      {model.pressure === undefined || model.pressure === null ? null
        : <p className="inspector-pressure" role="status"><UiIcon sheet="cause" cell="food" />{model.pressure}</p>}
      <p>생활 등급 {model.level} · 주민 {model.residents}명 / 정원 {model.capacity}명 · {model.footprintLabel}칸</p>
      {members.length === 0 ? null : <section key={model.buildingId} className="inspector-members" aria-label={PERSONS_COPY.membersHeading}>
        <h3>{PERSONS_COPY.membersHeading}</h3>
        <PersonList rows={members} onOpen={onPerson} />
      </section>}
      <dl>
        <div><dt>건축 단계</dt><dd>{model.builtLevel}단계 · {model.conditionLabel}</dd></div>
        <div><dt>물</dt><dd>{model.water.label}</dd></div>
        <div><dt>빵</dt><dd>{model.bread.label}</dd></div>
        <div><dt>인구</dt><dd>{model.population.label}</dd></div>
      </dl>
      <Disclosure className="inspector-development" summary="주택 발전 조건">
        <dl>
          <div><dt>성벽</dt><dd>{model.protection.label}</dd></div>
          <div><dt>시장</dt><dd>{model.market.label}</dd></div>
          <div><dt>교회</dt><dd>{model.church.label}</dd></div>
          <div><dt>도시 대가옥</dt><dd>{model.stoneHouse.label}</dd></div>
        </dl>
      </Disclosure>
      <section className="inspector-actions inspector-merge" aria-label="인접 주택 합필">
        <h3>인접 주택 합필</h3>
        <p>{model.mergeStatus}</p>
        {model.mergeOptions.map((option) => (
          <div key={option.targetBuildingId}>
            <Button
              type="button"
              className="diagnostic-card-merge"
              data-action="merge-houses"
              data-target-building-id={option.targetBuildingId}
              disabled={!option.enabled || onMergeHouses === undefined}
              onPress={() => {
                if (option.enabled) onMergeHouses?.(model.buildingId, option.targetBuildingId);
              }}
             variant="secondary">{option.label}</Button>
            {option.reason === null ? null : <p>{option.reason}</p>}
          </div>
        ))}
      </section>
      {onDemolishHouse === undefined ? null : (
        <section className="inspector-actions">
          <p>철거하면 주민 {model.residents}명이 떠납니다. 자재와 보관 식량은 반환되지 않습니다.</p>
          <Button
            type="button"
            className="diagnostic-card-cancel"
            data-action="demolish-house"
            onPress={() => onDemolishHouse(model.buildingId)}
           variant="secondary">
            주택 철거
          </Button>
        </section>
      )}
    </>
  );
}

function WalkerCard({ model, headline }: { readonly model: WalkerDiagnosisModel; readonly headline: WalkerHeadline | null }): ReactElement {
  return (
    <>
      {headline === null ? null : <p className="walker-headline" data-walker-headline={model.walkerId} data-person={headline.personId ?? undefined}
        data-portrait-exact={headline.personId === null ? undefined : headline.exact ? "true" : "false"}>{headline.line}</p>}
      <dl>
        <div><dt>화물</dt><dd>{model.cargoLabel}</dd></div>
        <div><dt>출발</dt><dd>{model.sourceLabel}</dd></div>
        {model.sourceDirectionLabel === null || model.sourceDistance === null ? null : (
          <div><dt>출발 위치</dt><dd>{model.sourceDirectionLabel} {model.sourceDistance}칸</dd></div>
        )}
        <div><dt>목적</dt><dd>{model.destinationLabel}</dd></div>
        <div><dt>상태</dt><dd>{model.statusLabel}</dd></div>
        <div><dt>남은 길</dt><dd>{Math.max(0, Math.round(model.remainingDistance))}칸 · {durationLabel(model.etaTicks)}</dd></div>
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
      {model.blockerLine === undefined || model.blockerLine === null ? null : <p className="inspector-blocker" role="status">{model.blockerLine}</p>}
      {model.currentStallLabel === "" ? null : <p>{model.currentStallLabel}</p>}
      <dl>
        {model.rows.map((row) => (
          <div key={row.label}><dt>{row.label}</dt><dd>{row.value}</dd></div>
        ))}
      </dl>
      <Button
        type="button"
        className="diagnostic-card-cancel"
        data-action="cancel-construction"
        disabled={!cancellationEnabled}
        onPress={() => {
          if (cancellationEnabled) onCancelConstruction?.(model.siteId);
        }}
       variant="secondary">
        {cancellationEnabled ? "공사 포기" : "공사 포기 불가"}
      </Button>
      {cancellation.reason === null ? null : <p>{cancellation.reason}</p>}
    </>
  );
}

function cardIdentity(model: DiagnosticCardModel, headline: WalkerHeadline | null = null): Readonly<{ name: string; type: string; label: string; art: ReactElement }> {
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
    case "store": {
      const source = buildThumbnail(model.value.kind);
      return { name: model.value.name, type: STORE_INSPECTOR_COPY.type, label: STORE_INSPECTOR_COPY.label(model.value.name),
        art: source === null ? <BuildGlyph tool={model.value.kind} /> : <img src={source} alt="" /> };
    }
    case "walker": return { name: headline?.name === null || headline?.name === undefined ? model.value.roleLabel : PERSONS_COPY.walkerName(headline.name, model.value.roleLabel),
      type: "주민 · 이동과 운송", label: `${model.value.roleLabel} 임무 진단`,
      art: headline?.portraitId === null || headline?.portraitId === undefined ? <span>이동</span> : <PersonPortrait portraitId={headline.portraitId} size={44} /> };
    case "construction_site": return { name: model.value.name, type: "건설 현장", label: `${model.value.name} 건설 진단`, art: <span>공사</span> };
  }
}

export function DiagnosticCard({
  model,
  causeLine = null,
  causeSummary,
  buildingOperation,
  onDemolishHouse,
  onMergeHouses,
  onCancelConstruction,
  onClose,
  walkerHeadline = null,
  houseMembers = [],
  onPerson,
  reachLine = null,
}: Readonly<{
  model: DiagnosticCardModel;
  /** The hover tooltip's cause line for a selected building (same text, UI-1 / B9). */
  causeLine?: string | null;
  causeSummary?: HouseProgressModel | null;
  buildingOperation?: { readonly paused: boolean; readonly onToggle: () => void };
  onDemolishHouse?: (buildingId: string) => void;
  onMergeHouses?: (sourceBuildingId: string, targetBuildingId: string) => void;
  onCancelConstruction?: (siteId: string) => void;
  onClose?: () => void;
  position: Position;
  /** UI-5: the person behind a selected walker and what they do (verb + what + where + progress). */
  walkerHeadline?: WalkerHeadline | null;
  /** UI-5: a house's members (head first; portrait, name, age, role), each opening their person card. */
  houseMembers?: readonly PersonRow[];
  onPerson?: (personId: string) => void;
  /** UX-0b2 MARKET-1: a market's reach ("길 40걸음 안 집 15채"; the map shows the road tiles). */
  reachLine?: string | null;
}>): ReactElement {
  const identity = cardIdentity(model, walkerHeadline);
  return (
    <div className="diagnostic-card-position" onKeyDown={(event) => {
      event.stopPropagation();
      if (event.key === "Escape") onClose?.();
    }}>
      <aside className="diagnostic-card" aria-label={identity.label}>
        <header className="inspector-heading">
          <div className="inspector-thumbnail" aria-hidden="true">{identity.art}</div>
          <div><p>{identity.type}</p><h2>{identity.name}</h2></div>
          {onClose === undefined ? null : <Button className="inspector-close" type="button" aria-label="상세 정보 닫기" onPress={() => onClose()} variant="icon">×</Button>}
        </header>
        {causeLine === null ? null : <p className="inspector-cause-line" role="status">{causeLine}</p>}
        {causeSummary == null ? null : <div className="inspector-cause-summary">
          다음: {causeSummary.nextLevel === null ? '최고 단계' : `L${causeSummary.nextLevel}`} / {causeSummary.currentLevel === 4 ? '유지 위험' : '첫 방해'}: {causeSummary.blocker?.label ?? (causeSummary.status === 'ready' ? '없음 · 승급 대기' : '없음')}
          {causeSummary.status === 'ready' && causeSummary.remainingTicks !== null && causeSummary.nextLevel !== null ?
            <p>L{causeSummary.nextLevel}까지 조건 유지 {Math.floor(Math.ceil(causeSummary.remainingTicks / BALANCE.TICKS_PER_SECOND) / 60)}:{String(Math.ceil(causeSummary.remainingTicks / BALANCE.TICKS_PER_SECOND) % 60).padStart(2, '0')} 남음</p> : null}
        </div>}
        <div className="inspector-body">
          {model.kind === "house" ? <HouseCard model={model.value} onDemolishHouse={onDemolishHouse} onMergeHouses={onMergeHouses} members={houseMembers} onPerson={onPerson} /> : null}
          {model.kind === "walker" ? <WalkerCard model={model.value} headline={walkerHeadline} /> : null}
          {model.kind === "store" ? <StoreInspectorBody model={model.value} /> : null}
          {model.kind === "building" ? <><p>{model.value.purpose}</p>{reachLine === null ? null : <p className="inspector-market-reach" data-market-reach="true">{reachLine}</p>}{buildingOperation === undefined ? null : <section className="inspector-actions"><Button type="button" style={{ minHeight: 44, minWidth: 44 }} aria-pressed={buildingOperation.paused} data-action="toggle-building-operation" onPress={() => buildingOperation.onToggle()} variant="secondary">{buildingOperation.paused ? BUILDING_OPERATION_COPY.resume : BUILDING_OPERATION_COPY.pause}</Button><p>{BUILDING_OPERATION_COPY.explanation}</p></section>}<h3>운영과 재고</h3><ul className="inspector-facts">{model.value.rows.map((row) => <li key={row}>{row}</li>)}</ul></> : null}
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
