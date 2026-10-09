import type { ReactElement } from "react";

import type { TileCoordinate } from "../../../world/grid";
import { Button } from "../../kit";
import { UiIcon } from "../../UiIcon";
import type { LordWallPlanView } from "./lordWall";
import { LORD_WALL_COPY as COPY } from "./lordWallCopy.ko";

// GROW-BLOCK: the era console's palisade plan in lord mode, opened by its primary ("마을의 목책 계획"). Secondaries only:
// a lever's way to where the lord sets it (명령 › 방향, 명령 › 장려 구역) and [위치로] on a home a wall would cut off.
// Each press names its command (the console's caller runs it: R4). The model is lordWall.ts.

export type WallPlanCommands = Readonly<{
  /** 명령 › 방향: the policy and the subsidies (the ledger's lord tab). */
  onConditions?: (() => void) | undefined;
  /** 명령 › 장려 구역: the zone layer. */
  onZones?: (() => void) | undefined;
  /** The camera to a tile (the cards' [위치로]). */
  onLookAt?: ((tile: TileCoordinate) => void) | undefined;
}>;

export function WallPlan({ plan, commands }: { readonly plan: LordWallPlanView; readonly commands: WallPlanCommands }): ReactElement {
  const goTo = (place: "conditions" | "zone") => place === "conditions" ? commands.onConditions : commands.onZones;
  const failure = plan.failure;
  const homeTile = failure?.homeTile ?? null;
  const lookAt = commands.onLookAt;
  return (
    <section id="wall-plan" className="wall-plan" aria-label={COPY.plan} data-wall-plan-stage={plan.stage}>
      {plan.conditions.length === 0 ? null : <ul className="wall-plan-list" aria-label={COPY.conditionsLabel}>
        {plan.conditions.map(condition => {
          const place = condition.lever?.place ?? null;
          const go = place === null ? undefined : goTo(place);
          return <li key={condition.key} data-wall-plan-condition={condition.key}>
            <strong>{condition.progress}</strong>
            <span>{condition.project}</span>
            {condition.lever === null ? null : <span>{condition.lever.line}</span>}
            {place === null || go === undefined ? null
              : <Button type="button" className="wall-plan-go" variant="secondary" data-wall-plan-go={place} onPress={() => go()}>{COPY.go[place]}</Button>}
          </li>;
        })}
      </ul>}
      {plan.sites.length === 0 ? null : <ul className="wall-plan-list" aria-label={COPY.sitesLabel}>
        {plan.sites.map((site, index) => <li key={index} data-wall-plan-site={index}>{site}</li>)}
      </ul>}
      {plan.abandoned.length === 0 ? null : <div className="wall-plan-abandoned">
        <h4>{COPY.abandonedLabel}</h4>
        <ul className="wall-plan-list">{plan.abandoned.map((line, index) => <li key={index}>{line}</li>)}</ul>
      </div>}
      {failure === null ? null : <div className="wall-plan-failure" data-wall-plan-failure="true">
        <p><strong>{failure.why}</strong></p>
        {failure.homes === null ? null : <p>{failure.homes}</p>}
        {homeTile === null || lookAt === undefined ? null
          : <Button type="button" className="wall-plan-go" variant="secondary" data-wall-plan-look="home" onPress={() => lookAt(homeTile)}>
            <UiIcon sheet="action" cell="look" />{COPY.lookAtHome}</Button>}
        <p>{failure.attempts}</p>
        <p>{failure.retry}</p>
      </div>}
    </section>
  );
}
