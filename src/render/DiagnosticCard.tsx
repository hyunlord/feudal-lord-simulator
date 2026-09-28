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
import { Button, Disclosure, Select } from "../ui/kit";
import { ResourceGlyph } from "../ui/ResourceArtwork";
import { resourceName } from "../content/resourceCatalog.ko";
import type { FieldCrop } from "../content/buildingConfig";
import type { FarmsteadCropModel } from "../ui/farmsteadCropModel";
import { FARMSTEAD_CROP_COPY } from "../ui/farmsteadCropCopy.ko";
import { houseAleProgressLine } from "../ui/houseAleModel";
import { HOUSE_ALE_COPY } from "../ui/houseAleCopy.ko";
import { DIAGNOSTIC_CARD_COPY } from "./diagnosticCardCopy.ko";
import type { WallInspectorModel } from "./wallInspectorModel";
import { WALL_INSPECTOR_COPY } from "./wallInspectorCopy.ko";

type Size = Readonly<{ width: number; height: number }>;
/** A construction site's card; a wall site's also carries the ring's defence against a raid (UI-6, WR-5). */
type SiteCardModel = ConstructionSiteCardModel & { readonly ringDefence?: { readonly label: string; readonly value: string } | null };
type Rect = Readonly<{ x: number; y: number; width: number; height: number }>;
type Position = Readonly<{ x: number; y: number }>;

export type DiagnosticCardModel =
  | { readonly kind: "house"; readonly value: HouseDiagnosisModel }
  | { readonly kind: "building"; readonly value: BuildingInspectorModel }
  | { readonly kind: "walker"; readonly value: WalkerDiagnosisModel }
  | { readonly kind: "construction_site"; readonly value: SiteCardModel }
  /** UX-3R2: a storehouse or granary (capacity, items, the week's change, who uses it). */
  | { readonly kind: "store"; readonly value: StoreInspectorModel }
  /** UI-6: a finished wall segment (the ring's defence against a raid, WR-5). */
  | { readonly kind: "wall"; readonly value: WallInspectorModel };

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
      <p>{DIAGNOSTIC_CARD_COPY.houseSummary(model.level, model.residents, model.capacity, model.footprintLabel)}</p>
      {members.length === 0 ? null : <section key={model.buildingId} className="inspector-members" aria-label={PERSONS_COPY.membersHeading}>
        <h3>{PERSONS_COPY.membersHeading}</h3>
        <PersonList rows={members} onOpen={onPerson} />
      </section>}
      <dl>
        <div><dt>{DIAGNOSTIC_CARD_COPY.builtStageTerm}</dt><dd>{DIAGNOSTIC_CARD_COPY.builtStage(model.builtLevel, model.conditionLabel)}</dd></div>
        <div><dt>{DIAGNOSTIC_CARD_COPY.waterTerm}</dt><dd>{model.water.label}</dd></div>
        <div><dt>{DIAGNOSTIC_CARD_COPY.breadTerm}</dt><dd>{model.bread.label}</dd></div>
        <div><dt>{DIAGNOSTIC_CARD_COPY.populationTerm}</dt><dd>{model.population.label}</dd></div>
      </dl>
      <Disclosure className="inspector-development" summary={DIAGNOSTIC_CARD_COPY.developmentSummary}>
        <dl>
          {model.ale === undefined ? null
            : <div data-ale-condition={model.ale.served ? "served" : "unserved"}><dt>{HOUSE_ALE_COPY.term}</dt><dd>{model.ale.label}</dd></div>}
          <div><dt>{DIAGNOSTIC_CARD_COPY.protectionTerm}</dt><dd>{model.protection.label}</dd></div>
          <div><dt>{DIAGNOSTIC_CARD_COPY.marketTerm}</dt><dd>{model.market.label}</dd></div>
          <div><dt>{DIAGNOSTIC_CARD_COPY.churchTerm}</dt><dd>{model.church.label}</dd></div>
          <div><dt>{DIAGNOSTIC_CARD_COPY.stoneHouseTerm}</dt><dd>{model.stoneHouse.label}</dd></div>
        </dl>
      </Disclosure>
      <section className="inspector-actions inspector-merge" aria-label={DIAGNOSTIC_CARD_COPY.mergeHeading}>
        <h3>{DIAGNOSTIC_CARD_COPY.mergeHeading}</h3>
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
          <p>{DIAGNOSTIC_CARD_COPY.demolishWarning(model.residents)}</p>
          <Button
            type="button"
            className="diagnostic-card-cancel"
            data-action="demolish-house"
            onPress={() => onDemolishHouse(model.buildingId)}
           variant="secondary">
            {DIAGNOSTIC_CARD_COPY.demolishHouse}
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
        <div><dt>{DIAGNOSTIC_CARD_COPY.cargoTerm}</dt><dd>{model.cargoLabel}</dd></div>
        <div><dt>{DIAGNOSTIC_CARD_COPY.sourceTerm}</dt><dd>{model.sourceLabel}</dd></div>
        {model.sourceDirectionLabel === null || model.sourceDistance === null ? null : (
          <div><dt>{DIAGNOSTIC_CARD_COPY.sourcePositionTerm}</dt><dd>{DIAGNOSTIC_CARD_COPY.sourcePosition(model.sourceDirectionLabel, model.sourceDistance)}</dd></div>
        )}
        <div><dt>{DIAGNOSTIC_CARD_COPY.destinationTerm}</dt><dd>{model.destinationLabel}</dd></div>
        <div><dt>{DIAGNOSTIC_CARD_COPY.statusTerm}</dt><dd>{model.statusLabel}</dd></div>
        <div><dt>{DIAGNOSTIC_CARD_COPY.remainingTerm}</dt><dd>{DIAGNOSTIC_CARD_COPY.remaining(Math.max(0, Math.round(model.remainingDistance)), durationLabel(model.etaTicks))}</dd></div>
        <div><dt>{DIAGNOSTIC_CARD_COPY.passedTerm}</dt><dd>{DIAGNOSTIC_CARD_COPY.passed(model.housesPassed)}</dd></div>
        {model.tilesTravelled === null ? null : (
          <div><dt>{DIAGNOSTIC_CARD_COPY.roundTerm}</dt><dd>{DIAGNOSTIC_CARD_COPY.travelled(model.tilesTravelled)}</dd></div>
        )}
        {model.cancellationLabel === null ? null : (
          <div><dt>{DIAGNOSTIC_CARD_COPY.cancellationTerm}</dt><dd>{model.cancellationLabel}</dd></div>
        )}
      </dl>
    </>
  );
}

function ConstructionSiteCard({
  model,
  onCancelConstruction,
}: {
  readonly model: SiteCardModel;
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
        {model.ringDefence === undefined || model.ringDefence === null ? null
          : <div data-ring-defence="true"><dt>{model.ringDefence.label}</dt><dd>{model.ringDefence.value}</dd></div>}
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
        {cancellationEnabled ? DIAGNOSTIC_CARD_COPY.abandonConstruction : DIAGNOSTIC_CARD_COPY.abandonConstructionUnavailable}
      </Button>
      {cancellation.reason === null ? null : <p>{cancellation.reason}</p>}
    </>
  );
}

/** INSTALL-3: the barn's crop (the game command `set_farmstead_crop`; a change is sown from the next sowing). */
function FarmsteadCropSection({ model, onChange }: { readonly model: FarmsteadCropModel; readonly onChange: (crop: FieldCrop) => void }): ReactElement {
  return (
    <section className="inspector-crop" aria-label={FARMSTEAD_CROP_COPY.heading} data-farmstead-crop={model.crop}>
      <h3>{FARMSTEAD_CROP_COPY.heading}</h3>
      <p className="inspector-crop-current"><ResourceGlyph resource={model.crop} />{model.current}</p>
      <Select className="inspector-crop-select" label={model.label} value={model.crop} options={model.options} onChange={onChange} disabled={model.disabled} />
      {model.locked === null ? null : <p className="inspector-crop-locked" role="note"><UiIcon sheet="lock" cell="locked" />{model.locked}</p>}
      <p className="inspector-crop-note">{model.note}</p>
      <p className="inspector-crop-sowing">{model.sowing}</p>
      {model.pending === null ? null : <p className="inspector-crop-pending" role="status">{model.pending}</p>}
      {model.carting === null ? null : <p className="inspector-crop-carting">{model.carting}</p>}
    </section>
  );
}

/** INSTALL-3: a building's stock row, each good with its icon and name. */
function StockRow({ stock }: { readonly stock: NonNullable<BuildingInspectorModel["stock"]> }): ReactElement {
  return (
    <span className="inspector-stock">{DIAGNOSTIC_CARD_COPY.stockTerm}
      {stock.length === 0 ? <span>{DIAGNOSTIC_CARD_COPY.none}</span> : stock.map(item => (
        <span key={item.resource} className="inspector-stock-item" data-resource={item.resource}><ResourceGlyph resource={item.resource} />{resourceName(item.resource)} {item.amount}</span>))}
    </span>
  );
}

function cardIdentity(model: DiagnosticCardModel, headline: WalkerHeadline | null = null): Readonly<{ name: string; type: string; label: string; art: ReactElement }> {
  switch (model.kind) {
    case "house": return {
      name: model.value.name, type: DIAGNOSTIC_CARD_COPY.houseType(model.value.level), label: DIAGNOSTIC_CARD_COPY.houseLabel(model.value.name),
      art: model.value.thumbnailUrl === null
        ? <span>{DIAGNOSTIC_CARD_COPY.houseArt(model.value.footprintLabel)}</span>
        : <img src={model.value.thumbnailUrl} alt="" />,
    };
    case "building": {
      const source = buildThumbnail(model.value.kind);
      return { name: model.value.name, type: DIAGNOSTIC_CARD_COPY.facilityType, label: DIAGNOSTIC_CARD_COPY.facilityLabel(model.value.name),
        art: source === null ? <BuildGlyph tool={model.value.kind} /> : <img src={source} alt="" /> };
    }
    case "store": {
      const source = buildThumbnail(model.value.kind);
      return { name: model.value.name, type: STORE_INSPECTOR_COPY.type, label: STORE_INSPECTOR_COPY.label(model.value.name),
        art: source === null ? <BuildGlyph tool={model.value.kind} /> : <img src={source} alt="" /> };
    }
    case "walker": return { name: headline?.name === null || headline?.name === undefined ? model.value.roleLabel : PERSONS_COPY.walkerName(headline.name, model.value.roleLabel),
      type: DIAGNOSTIC_CARD_COPY.walkerType, label: DIAGNOSTIC_CARD_COPY.walkerLabel(model.value.roleLabel),
      art: headline?.portraitId === null || headline?.portraitId === undefined ? <span>{DIAGNOSTIC_CARD_COPY.walkerArt}</span> : <PersonPortrait portraitId={headline.portraitId} size={44} ornament={headline.ornament ?? null} /> };
    case "wall": return { name: model.value.name, type: WALL_INSPECTOR_COPY.type, label: WALL_INSPECTOR_COPY.label(model.value.name), art: <span>{WALL_INSPECTOR_COPY.art}</span> };
    case "construction_site": return { name: model.value.name, type: DIAGNOSTIC_CARD_COPY.siteType, label: DIAGNOSTIC_CARD_COPY.siteLabel(model.value.name), art: <span>{DIAGNOSTIC_CARD_COPY.siteArt}</span> };
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
  farmsteadCrop,
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
  /** INSTALL-3: a barn's crop choice (the game command `set_farmstead_crop`). */
  farmsteadCrop?: { readonly model: FarmsteadCropModel; readonly onChange: (crop: FieldCrop) => void };
}>): ReactElement {
  const identity = cardIdentity(model, walkerHeadline);
  const aleLine = causeSummary == null ? null : houseAleProgressLine(causeSummary);
  return (
    <div className="diagnostic-card-position" onKeyDown={(event) => {
      event.stopPropagation();
      if (event.key === "Escape") onClose?.();
    }}>
      <aside className="diagnostic-card" aria-label={identity.label}>
        <header className="inspector-heading">
          <div className="inspector-thumbnail" aria-hidden="true">{identity.art}</div>
          <div><p>{identity.type}</p><h2>{identity.name}</h2></div>
          {onClose === undefined ? null : <Button className="inspector-close" type="button" aria-label={DIAGNOSTIC_CARD_COPY.close} onPress={() => onClose()} variant="icon">×</Button>}
        </header>
        {causeLine === null ? null : <p className="inspector-cause-line" role="status">{causeLine}</p>}
        {causeSummary == null ? null : <div className="inspector-cause-summary">
          {DIAGNOSTIC_CARD_COPY.causeSummary(
            causeSummary.nextLevel === null ? DIAGNOSTIC_CARD_COPY.topLevel : DIAGNOSTIC_CARD_COPY.nextLevel(causeSummary.nextLevel),
            causeSummary.currentLevel === 4 ? DIAGNOSTIC_CARD_COPY.keepRisk : DIAGNOSTIC_CARD_COPY.firstBlocker,
            causeSummary.blocker?.label ?? (causeSummary.status === 'ready' ? DIAGNOSTIC_CARD_COPY.noneAwaitingPromotion : DIAGNOSTIC_CARD_COPY.none),
          )}
          {causeSummary.status === 'ready' && causeSummary.remainingTicks !== null && causeSummary.nextLevel !== null ?
            <p>{DIAGNOSTIC_CARD_COPY.holdRemaining(causeSummary.nextLevel, Math.floor(Math.ceil(causeSummary.remainingTicks / BALANCE.TICKS_PER_SECOND) / 60), String(Math.ceil(causeSummary.remainingTicks / BALANCE.TICKS_PER_SECOND) % 60).padStart(2, '0'))}</p> : null}
          {aleLine === null ? null
            : <p className="inspector-ale-line" data-ale={causeSummary.ale?.served === true ? "served" : "unserved"}>{aleLine}</p>}
        </div>}
        <div className="inspector-body">
          {model.kind === "house" ? <HouseCard model={model.value} onDemolishHouse={onDemolishHouse} onMergeHouses={onMergeHouses} members={houseMembers} onPerson={onPerson} /> : null}
          {model.kind === "walker" ? <WalkerCard model={model.value} headline={walkerHeadline} /> : null}
          {model.kind === "store" ? <StoreInspectorBody model={model.value} /> : null}
          {model.kind === "building" ? <><p>{model.value.purpose}</p>{farmsteadCrop === undefined ? null : <FarmsteadCropSection model={farmsteadCrop.model} onChange={farmsteadCrop.onChange} />}{reachLine === null ? null : <p className="inspector-market-reach" data-market-reach="true">{reachLine}</p>}{buildingOperation === undefined ? null : <section className="inspector-actions"><Button type="button" style={{ minHeight: 44, minWidth: 44 }} aria-pressed={buildingOperation.paused} data-action="toggle-building-operation" onPress={() => buildingOperation.onToggle()} variant="secondary">{buildingOperation.paused ? BUILDING_OPERATION_COPY.resume : BUILDING_OPERATION_COPY.pause}</Button><p>{BUILDING_OPERATION_COPY.explanation}</p></section>}<h3>{DIAGNOSTIC_CARD_COPY.operationsHeading}</h3><ul className="inspector-facts">{model.value.rows.map((row) => <li key={row}>{row === model.value.stockRow && model.value.stock !== undefined ? <StockRow stock={model.value.stock} /> : row}</li>)}</ul></> : null}
          {model.kind === "wall" ? <><p>{model.value.purpose}</p><ul className="inspector-facts" data-wall-segment={model.value.segmentId}>{model.value.rows.map((row) => <li key={row}>{row}</li>)}</ul></> : null}
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
