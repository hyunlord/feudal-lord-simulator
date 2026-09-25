import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GameState } from "../../engine/engine.types";
import { getSettlementView } from "../../engine/settlementView";
import type { WorldPoint } from "../../input/inputIntent";
import { platformServices } from "../../platform/platform";
import { tileToScreen } from "../../render/iso";
import type { PlacementTool } from "../../render/renderer";
import type { ZoneBrushTool } from "../../render/zoneBrushInteraction";
import type { TileCoordinate } from "../../world/grid";
import type { ZoneStrokePoint } from "../../zones/zone.types";
import { buildCategory, type BuildCategory } from "../buildMenuPresentation";
import { TUTORIAL_COPY } from "./tutorialCopy.ko";
import {
  currentStepIndex, newCount, placedCount, stepAction, stepProgress, stepTarget, suggestedBuildingSpot, tutorialAccess,
  TUTORIAL_STEP_IDS, type BuildCategoryKey, type ControlLayer, type TutorialAccess, type TutorialAction, type TutorialStepId,
} from "./tutorialModel";
import { readTutorialRecord, writeTutorialRecord, type TutorialRecord } from "./tutorialStore";
import { setTutorialGuidanceActive, setTutorialMapTarget } from "./tutorialMapChannel";

// UX-1 tutorial controller (App shell): the record, the current step, the goal cards (the active one, the last
// completion held SUCCESS_HOLD_MS, "이미 갖춰짐 ✓" for steps the game had already met), unlock banners, the steward's
// line, and the card button, which acts only through input intents (toolSelect, select, strokes, speed) like the
// player's own clicks (research E: "튜토리얼을 꺼도 Objective CTA의 자동 메뉴 열기는 유지").

const SUCCESS_HOLD_MS = 1_500;
const BANNER_HOLD_MS = 3_000;

export type GoalCard = {
  readonly key: string;
  readonly title: string;
  readonly why: string;
  readonly progress: { readonly current: number; readonly target: number } | null;
  readonly ctaLabel: string | null;
  readonly status: "active" | "done" | "already";
  readonly help: string | null;
  readonly hasTarget: boolean;
};

type Transition = { readonly id: string; readonly title: string; readonly already: boolean; readonly until: number };
type StepCopyKey = keyof typeof TUTORIAL_COPY.cards;
const COPY_KEY: Readonly<Record<TutorialStepId, StepCopyKey>> = {
  greet: "greet", well: "well", well_done: "wellDone", house: "house", road: "road", arable: "arable",
  arable_limits: "arableLimits", food_chain: "foodChain", granary: "granary", zone_unlock: "zoneUnlock",
  burgage: "burgage", burgage_done: "burgageDone", wrap_up: "wrapUp",
};
const ADVISOR_KEY: Partial<Record<TutorialStepId, keyof typeof TUTORIAL_COPY.advisor>> = {
  greet: "greet", well: "well", well_done: "wellDone", house: "house", arable: "arable", granary: "granary",
  zone_unlock: "zoneUnlock", burgage_done: "burgageDone", wrap_up: "wrapUp",
};

function stepTitle(id: TutorialStepId): string { return TUTORIAL_COPY.cards[COPY_KEY[id]].title; }

/** The card button's label for an action. */
function ctaLabel(id: TutorialStepId, action: TutorialAction | null): string | null {
  if (action === null) return null;
  const copy = TUTORIAL_COPY.cards[COPY_KEY[id]] as Record<string, string>;
  if (id === "food_chain") {
    const barn = action.kind === "arm" ? action.tool === "farmstead" : action.kind === "place" && action.tool === "farmstead";
    return action.kind === "place" ? barn ? copy.placeFarmstead! : copy.placeMill! : barn ? copy.ctaFarmstead! : copy.ctaMill!;
  }
  return action.kind === "place" || action.kind === "paintZone" ? copy.place ?? copy.cta! : copy.cta!;
}

/** Whether the state is a fresh new game (nothing placed, no zone, no tick): only then may a missing record start the tutorial. */
export function isFreshGame(state: GameState): boolean {
  return state.tick === 0 && (state.zones ?? []).length === 0 && state.constructionSites.length === 0
    && (["well", "house", "granary", "farmstead", "mill"] as const).every(kind => newCount(state, kind) === 0);
}

export type TutorialController = {
  readonly enabled: boolean;
  readonly running: boolean;
  readonly access: TutorialAccess;
  readonly cards: readonly GoalCard[];
  readonly advisor: { readonly text: string; readonly key: string } | null;
  readonly banner: string | null;
  readonly log: TutorialRecord["log"];
  readonly pulse: { readonly key: string; readonly nonce: number } | null;
  readonly openRequest: { readonly category: BuildCategory; readonly nonce: number } | null;
  readonly press: (cardKey: string) => void;
  readonly lookAt: () => void;
  readonly dismissAdvisor: () => void;
  /** A new game from the welcome: `state` is the game to check for freshness, null when the caller starts a new one. */
  readonly startNewGame: (enabled: boolean, state: GameState | null) => void;
  readonly setEnabled: (enabled: boolean) => void;
};

export function useTutorialController(input: {
  readonly state: GameState;
  readonly paused: boolean;
  readonly selectedTool: PlacementTool | null;
  readonly zoneTool: ZoneBrushTool | null;
  readonly layer: ControlLayer;
  readonly setLayer: (layer: ControlLayer) => void;
  readonly nowMs: number;
  readonly onOpenDrawer: () => void;
}): TutorialController {
  const { state, nowMs } = input;
  const [record, setRecordState] = useState<TutorialRecord | null>(() => readTutorialRecord());
  // Functional updates: two writes in one handler (an acknowledgement and a pulse) must not drop each other.
  const updateRecord = useCallback((change: (record: TutorialRecord) => TutorialRecord) => setRecordState(current => {
    if (current === null) return current;
    const next = change(current); writeTutorialRecord(next); return next;
  }), []);
  const setRecord = useCallback((next: TutorialRecord) => { writeTutorialRecord(next); setRecordState(next); }, []);
  const enabled = record?.enabled === true;
  const acks = useMemo(() => new Set(record?.acks ?? []), [record]);
  const index = enabled ? currentStepIndex(state, acks) : TUTORIAL_STEP_IDS.length;
  const running = enabled && index < TUTORIAL_STEP_IDS.length;
  const access = useMemo(() => tutorialAccess(enabled, index), [enabled, index]);
  const stepId = running ? TUTORIAL_STEP_IDS[index]! : null;
  const zoneRadius = input.zoneTool?.radius ?? 2;
  const armed = { tool: input.selectedTool, zone: input.zoneTool?.target ?? null, layer: input.layer };
  const action = stepId === null ? null : stepAction(state, stepId, armed, zoneRadius);
  const target = stepId === null ? null : stepTarget(state, stepId, zoneRadius);

  // Transitions: the step that just closed shows "완료 ✓", steps the game had already met "이미 갖춰짐 ✓".
  const previousIndex = useRef(index);
  const [transitions, setTransitions] = useState<readonly Transition[]>([]);
  const [banner, setBanner] = useState<{ readonly text: string; readonly until: number } | null>(null);
  const previousAccess = useRef(access);
  useEffect(() => {
    const before = previousIndex.current;
    previousIndex.current = index;
    if (!enabled || index <= before) return;
    const closed = TUTORIAL_STEP_IDS.slice(before, index).map((id, offset) => ({
      id, title: stepTitle(id), already: offset > 0 && !acks.has(id), until: nowMs + SUCCESS_HOLD_MS * (offset + 1),
    }));
    setTransitions(current => [...current, ...closed]);
    updateRecord(current => ({ ...current, log: [...current.log, ...closed.filter(item => !current.log.some(entry => entry.id === item.id)).map(({ id, title, already }) => ({ id, title, already }))] }));
  }, [index]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const before = previousAccess.current;
    previousAccess.current = access;
    if (!enabled) return;
    if (!before.layers.zone && access.layers.zone) { setBanner({ text: TUTORIAL_COPY.zoneBanner, until: nowMs + BANNER_HOLD_MS }); return; }
    const opened = (Object.keys(access.categories) as BuildCategoryKey[]).filter(key => !before.categories[key] && access.categories[key]);
    if (opened.length > 0) setBanner({ text: TUTORIAL_COPY.unlocked(opened.map(key => TUTORIAL_COPY.categories[key]).join(" · ")), until: nowMs + BANNER_HOLD_MS });
  }, [access]); // eslint-disable-line react-hooks/exhaustive-deps
  const liveTransitions = transitions.filter(item => item.until > nowMs);
  useEffect(() => { if (liveTransitions.length !== transitions.length) setTransitions(liveTransitions); }, [nowMs]); // eslint-disable-line react-hooks/exhaustive-deps

  // Map halo of the current step (drawn by the renderer's guidance pass).
  useEffect(() => {
    setTutorialGuidanceActive(running);
    setTutorialMapTarget(running && target !== null && stepId !== null ? { ...target, label: TUTORIAL_COPY.mapLabels[stepId] ?? "" } : null);
  }, [running, stepId, target === null ? null : JSON.stringify(target)]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { setTutorialMapTarget(null); setTutorialGuidanceActive(false); }, []);

  // Menu pulse (twice, once per target) and catalogue requests.
  const [pulse, setPulse] = useState<{ key: string; nonce: number } | null>(null);
  const [openRequest, setOpenRequest] = useState<{ category: BuildCategory; nonce: number } | null>(null);
  const nonce = useRef(0);
  const requestPulse = (key: string) => {
    nonce.current += 1;
    if (record !== null && record.pulsed.includes(key)) return;
    setPulse({ key, nonce: nonce.current });
    updateRecord(current => current.pulsed.includes(key) ? current : { ...current, pulsed: [...current.pulsed, key] });
  };
  const openCategory = (category: BuildCategory) => { nonce.current += 1; setOpenRequest({ category, nonce: nonce.current }); };

  const emit = platformServices().input.emit;
  const resume = () => { if (input.paused) emit({ kind: "speed", value: 1 }); };
  const worldOfTile = (tile: TileCoordinate): WorldPoint => { const at = tileToScreen(tile.tx, tile.ty); return { x: at.sx, y: at.sy }; };
  const worldOfStroke = (point: ZoneStrokePoint): WorldPoint => { const at = tileToScreen(point.x - 0.5, point.y - 0.5); return { x: at.sx, y: at.sy }; };

  const run = (next: TutorialAction) => {
    switch (next.kind) {
      case "ack":
        updateRecord(current => ({ ...current, acks: [...current.acks, next.step] }));
        return;
      case "layer":
        input.setLayer(next.layer);
        requestPulse(`layer:${next.layer}`);
        updateRecord(current => ({ ...current, acks: [...current.acks, next.step] }));
        return;
      case "arm":
        input.setLayer("direct");
        emit({ kind: "toolSelect", toolId: next.tool });
        openCategory(buildCategory(next.tool));
        requestPulse(next.tool);
        return;
      case "armZone":
        input.setLayer(next.target === "arable" ? "direct" : "zone");
        emit({ kind: "toolSelect", toolId: `zone:${next.target}` });
        if (next.target === "arable") openCategory("trade");
        requestPulse(`zone:${next.target}`);
        return;
      case "place": {
        // A placement acts on the hovered tile (as a click does): point the hover there first (TOUCH-1 `inspect`).
        const world = worldOfTile(next.tile);
        emit({ kind: "inspect", world });
        emit({ kind: "select", world });
        return;
      }
      case "paintZone": {
        const [first, ...rest] = next.stroke.points;
        if (first === undefined) return;
        emit({ kind: "strokeBegin", toolId: "zone", world: worldOfStroke(first) });
        for (const point of rest) emit({ kind: "strokeMove", world: worldOfStroke(point) });
        const last = rest[rest.length - 1] ?? first;
        emit({ kind: "strokeEnd", world: worldOfStroke(last) });
        return;
      }
    }
  };

  // General mode (tutorial off or finished): the settlement goal and, after the tutorial, the market and chapel card.
  const general = generalCards(state, enabled, input.selectedTool);
  const press = (cardKey: string) => {
    resume();
    if (stepId !== null && cardKey === stepId && action !== null) { run(action); return; }
    if (cardKey === "settlement") { input.onOpenDrawer(); return; }
    const next = general.actions.get(cardKey);
    if (next !== undefined) run(next);
  };

  const cards: GoalCard[] = liveTransitions.slice(-1).map(item => ({
    key: `done:${item.id}`, title: item.title, why: "", progress: null, ctaLabel: null,
    status: item.already ? "already" as const : "done" as const, help: null, hasTarget: false,
  }));
  if (stepId !== null) {
    const copy = TUTORIAL_COPY.cards[COPY_KEY[stepId]];
    cards.push({ key: stepId, title: copy.title, why: copy.why, progress: stepProgress(state, stepId), ctaLabel: ctaLabel(stepId, action),
      status: "active", help: TUTORIAL_COPY.advisor[ADVISOR_KEY[stepId] ?? "greet"] ?? null, hasTarget: target !== null });
  } else cards.push(...general.cards);

  const [dismissedAdvisor, setDismissedAdvisor] = useState<string | null>(null);
  const advisorKey = stepId === null ? null : ADVISOR_KEY[stepId] ?? null;
  const advisor = advisorKey === null || dismissedAdvisor === stepId ? null : { text: TUTORIAL_COPY.advisor[advisorKey], key: stepId! };

  return {
    enabled, running, access,
    cards: cards.slice(-2),
    advisor,
    banner: banner !== null && banner.until > nowMs ? banner.text : null,
    log: record?.log ?? [],
    pulse, openRequest,
    press,
    lookAt: () => { if (target !== null) emit({ kind: "lookAt", tile: target.focus }); },
    dismissAdvisor: () => setDismissedAdvisor(stepId),
    startNewGame: (on, fresh) => {
      if (fresh !== null && !isFreshGame(fresh)) return;
      setRecord({ enabled: on, acks: [], pulsed: [], log: [] });
      previousIndex.current = 0; setTransitions([]); setDismissedAdvisor(null);
    },
    setEnabled: on => setRecord({ ...(record ?? { acks: [], pulsed: [], log: [] }), enabled: on }),
  };
}

/** Goal cards when no tutorial step is current: the settlement goal, and the market / chapel suggestion. */
function generalCards(state: GameState, tutorialRan: boolean, selectedTool: PlacementTool | null): { readonly cards: readonly GoalCard[]; readonly actions: ReadonlyMap<string, TutorialAction> } {
  const cards: GoalCard[] = []; const actions = new Map<string, TutorialAction>();
  const view = getSettlementView(state);
  const goal = view.currentGoal;
  if (goal !== null) {
    const next = goal.criteria.find(item => !item.met) ?? goal.criteria[0];
    cards.push({ key: "settlement", title: goal.title, why: next?.label ?? goal.description, progress: next === undefined ? null : { current: Math.floor(next.current), target: next.target },
      ctaLabel: TUTORIAL_COPY.generalCard.cta, status: "active", help: goal.description, hasTarget: false });
  }
  if (tutorialRan) {
    const missing = (["market", "chapel"] as const).filter(kind => placedCount(state, kind) === 0);
    const kind = missing[0];
    if (kind !== undefined) {
      const spot = suggestedBuildingSpot(state, kind);
      const nextAction: TutorialAction = selectedTool === kind && spot !== null ? { kind: "place", tool: kind, tile: spot } : { kind: "arm", tool: kind };
      actions.set("wrap", nextAction);
      cards.unshift({ key: "wrap", title: TUTORIAL_COPY.cards.wrapUp.title, why: TUTORIAL_COPY.cards.wrapUp.why,
        progress: { current: 2 - missing.length, target: 2 }, ctaLabel: nextAction.kind === "place" ? TUTORIAL_COPY.generalCard.place(TUTORIAL_COPY.buildingNames[kind]) : TUTORIAL_COPY.generalCard.arm(TUTORIAL_COPY.buildingNames[kind]),
        status: "active", help: null, hasTarget: false });
    }
  }
  return { cards, actions };
}
