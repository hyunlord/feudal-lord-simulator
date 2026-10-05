import type { ReactElement } from "react";

import type { GameState } from "../../engine/engine.types";
import { platformServices } from "../../platform/platform";
import { Button } from "../kit";
import { UiIcon } from "../UiIcon";
import { FOOD_BREAKDOWN_COPY as COPY } from "./foodBreakdownCopy.ko";
import { foodBreakdown } from "./foodBreakdownModel";

// LM-R1 (playtest 2026-10-02 #5): the food cell's popover under the status pill — the five parts of the food number and
// the most urgent place, one press away (the camera goes there and its card opens).

export function FoodBreakdownPanel({ state, onInspect, onOpenLedger, onClose }: {
  readonly state: GameState; readonly onInspect: (buildingId: string) => void; readonly onOpenLedger: () => void; readonly onClose: () => void;
}): ReactElement {
  const model = foodBreakdown(state);
  const urgent = model.urgent;
  const target = urgent?.target ?? null;
  return (
    <section className="food-breakdown" data-frame="light" aria-label={COPY.region} data-starving={model.starving}>
      <dl className="food-breakdown-rows">
        {model.rows.map(row => <div key={row.key} className="food-breakdown-row" data-food-row={row.key} data-urgent={row.urgent ? "true" : undefined}>
          <dt>{row.term}</dt><dd>{row.value}</dd></div>)}
      </dl>
      {model.starving === 0 ? null : <p className="food-breakdown-note">{COPY.starvingNote}</p>}
      <div className="food-breakdown-actions">
        {urgent === null || target === null ? null : <Button type="button" className="food-breakdown-go" data-food-go={urgent.key} aria-label={COPY.goLabel(urgent.term)}
          onPress={() => { platformServices().input.emit({ kind: "lookAt", tile: target.tile }); onInspect(target.buildingId); onClose(); }}
          variant="primary"><UiIcon sheet="action" cell="look" />{COPY.go}</Button>}
        <Button type="button" className="food-breakdown-ledger" onPress={() => { onClose(); onOpenLedger(); }} variant="secondary">
          <UiIcon sheet="action" cell="log" />{COPY.ledger}</Button>
        <Button type="button" className="food-breakdown-close" aria-label={COPY.close} onPress={() => onClose()} variant="icon">
          <UiIcon sheet="prediction" cell="block" /></Button>
      </div>
    </section>
  );
}
