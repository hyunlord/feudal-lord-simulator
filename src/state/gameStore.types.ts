import type { Dispatch, ReactNode } from "react";

import type { BuildingKind } from "../content/buildingConfig";
import type { GameSpeed, GameState } from "../engine/engine.types";
import type { TileCoordinate } from "../world/grid";
import type { PalisadePath } from "../world/palisadeGeometry";

export interface GameProviderProps {
  children: ReactNode;
}

export type GameAction = import("../engine/autoplayFoodTransient").FoodTransientMetadata & import("../engine/autoplayMaterialTypes").MaterialPlacementMetadata & GameCommand;
type GameCommand =
  | { readonly type: "set_building_operation"; readonly buildingId: string; readonly paused: boolean }
  | { readonly type: "record_autoplay_food_confirmation" }
  | { readonly type: "restart_settlement" }
  /** ARCH-1 (MA-6): and the land and its seed (absent = the riverside town, seed 1). */
  | { readonly type: "start_new_game"; readonly scenarioId: string; readonly archetypeId?: string; readonly seed?: number; readonly mode?: "lord" | "sandbox"; readonly house?: { readonly name: string; readonly arms: string } }
  // LM-E1 (TA-6): the lord's conditions in lord mode — the estate's policy, a subsidy on a kind (0 withdraws), the market dues.
  | { readonly type: "set_estate_policy"; readonly policy: import("../engine/townAgency.types").EstatePolicy }
  | { readonly type: "set_project_subsidy"; readonly kind: import("../content/buildingConfig").BuildingKind; readonly amount: number }
  | { readonly type: "set_market_dues"; readonly permille: number }
  // LM-E2 (ES-7): the lord's suits — file a claim, bring evidence, win a patron, enforce a judgment's possession.
  | { readonly type: "file_suit"; readonly claimId: string }
  | { readonly type: "add_suit_evidence"; readonly suitId: string; readonly evidence: import("../engine/estates.types").Evidence["kind"] }
  | { readonly type: "seek_suit_patron"; readonly suitId: string; readonly factionId: string }
  | { readonly type: "enforce_possession"; readonly suitId: string }
  // LM-E3 (NG-7, NG-5, NG-6, NG-8): a marriage offer, the answer to its counter, a promise kept, the will-change answer.
  | { readonly type: "propose_marriage"; readonly terms: readonly import("../engine/diplomacy.types").Term[]; readonly groomId?: string }
  | { readonly type: "answer_counter"; readonly negotiationId: string; readonly accept: boolean }
  | { readonly type: "keep_promise"; readonly promiseId: string }
  | { readonly type: "answer_will_change"; readonly choice: "favour" | "support_promise" | "let_it_be" }
  // LM-E4 (SW-2, SW-4…SW-6): the off-map estates' oversight.
  | { readonly type: "set_estate_oversight"; readonly estateId: string; readonly mode: import("../engine/stewardship.types").OversightMode; readonly stewardId?: string }
  | { readonly type: "set_exception_rules"; readonly rules: import("../engine/stewardship.types").ExceptionRules }
  | { readonly type: "answer_estate_petition"; readonly petitionId: string; readonly grant: boolean }
  | { readonly type: "answer_registry_offer"; readonly occurrenceId: string; readonly choiceId: string }
  | { readonly type: "set_audit_mode"; readonly estateId: string; readonly mode: "accounts" | "visit" }
  | { readonly type: "answer_audit"; readonly auditId: string; readonly choice: "punish" | "replace" | "tolerate"; readonly replacementId?: string }
  /** QA032: the player saw the chapter's page (the screens open it once; kept in the save). */
  | { readonly type: "mark_chapter_page_seen"; readonly chapter: number }
  /** ARCH-1b (MA-11): drain the fen's still water around a tile (`drainagePlan` says what it takes). */
  | { readonly type: "drain_fen"; readonly tx: number; readonly ty: number }
  | { readonly type: "order_timber"; readonly amount: number }
  | { readonly type: "load_saved_state"; readonly state: GameState }
  | { readonly type: "merge_houses"; readonly sourceBuildingId: string; readonly targetBuildingId: string }
  | {
      readonly type: "commit_simulation_state";
      readonly previousState: GameState;
      readonly nextState: GameState;
    }
  | {
      readonly type: "place_building";
      readonly kind: BuildingKind;
      readonly tx: number;
      readonly ty: number;
      readonly autoplayFoodObservation?: boolean;
    }
  | {
      readonly type: "place_road_line";
      readonly start: TileCoordinate;
      readonly destination: TileCoordinate;
    }
  | {
      readonly type: "remove_road";
      readonly tx: number;
      readonly ty: number;
    }
  | {
      readonly type: "demolish_house";
      readonly buildingId: string;
    }
  | {
      /** F0-B EV-6: rebuild a burnt house from stage 2. */
      readonly type: "rebuild_house";
      readonly buildingId: string;
    }
  | {
      /** F0-C1 FC-2: the lord's answer to the Great Famine. */
      readonly type: "famine_response";
      readonly choice: import("../content/chapterConfig").FamineResponseChoice;
    }
  | {
      /** C4 (AL-2): the crop a farmstead sows next (its strips already sown keep theirs). */
      readonly type: "set_farmstead_crop";
      readonly buildingId: string;
      readonly crop: import("../content/buildingConfig").FieldCrop;
    }
  | {
      /** F0-C1 FC-3: the lord's answer to a petition. */
      readonly type: "petition_response";
      readonly petitionId: string;
      readonly response: import("../content/chapterConfig").PetitionResponse;
    }
  | {
      readonly type: "cancel_construction";
      readonly siteId: string;
    }
  | {
      readonly type: "confirm_palisade_proclamation";
      readonly candidatePath: PalisadePath;
    }
  | { readonly type: "confirm_stone_town_proclamation" }
  /** WALL-2 WX-1: widen the palisade to a ring that holds the old one (only the new length is built). */
  | { readonly type: "expand_palisade"; readonly candidatePath: PalisadePath }
  /** Spec Z-5: paint a zone stroke (new zone, or merged into touching zones of the same kind). */
  | { readonly type: "zone_paint"; readonly kind: import("../zones/zone.types").ZoneKind; readonly stroke: import("../zones/zone.types").ZoneStroke }
  /** Spec Z-6: remove the stroke's cells from every zone. */
  | { readonly type: "zone_erase"; readonly stroke: import("../zones/zone.types").ZoneStroke }
  /** Spec Z-7. */
  | { readonly type: "zone_remove"; readonly id: string }
  /** Spec Z-17: undo the last zone_paint / zone_erase. */
  | { readonly type: "zone_undo_stroke" }
  | { readonly type: "set_wall_construction_priority"; readonly priority: import("../engine/constructionReserve").WallConstructionPriority };

/** The walkers and sites of the frame before, for the canvas's interpolation. */
export type PreviousRenderState = Pick<GameState, "constructionSites" | "walkers">;

/**
 * CODE-1c: the store outside React. The provider does not re-render on a tick; components read what they need with
 * `useGameUiSelector` (the UI channel) and the canvas and per-tick observers read every change through `subscribe`.
 */
export interface GameStoreApi {
  /** The simulation's state (plain: the screen adds the presentation walkers, `render/presentation`). */
  readonly getState: () => GameState;
  readonly getPreviousRenderState: () => PreviousRenderState;
  readonly getSpeed: () => GameSpeed;
  /** Every change: each committed tick, each action, each speed change. */
  readonly subscribe: (listener: () => void) => () => void;
  /** The state the UI shows: actions at once, committed ticks at most every UI_REFRESH_MS (the last one kept). */
  readonly getUiState: () => GameState;
  readonly subscribeUi: (listener: () => void) => () => void;
  readonly interpolationAlpha: () => number;
  readonly dispatch: Dispatch<GameAction>;
  readonly setSpeed: (speed: GameSpeed) => void;
}
