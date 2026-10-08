import type { ReactElement } from "react";
import { Button, Disclosure } from "../../kit";
import { STEWARD_COPY as COPY } from "./stewardCopy.ko";
import type { StewardSeasonView } from "./seasonStewardModel";

// DEC-CARD-2 (the user's order 2026-10-08): the season card's "청지기가 처리한 일" (lord mode only): the count by
// standing policy, the money and the factions those answers moved, each handled matter as a drill-in (what it was, the
// policy used, the result, and [이 종류의 방침을 정한다] to that kind on the lord screen's 상시 방침), what he brought
// to the lord and why, what lapsed. The drill-in is the kit's disclosure (the summary is the control).
export function SeasonStewardSection({ view, onPolicy }: {
  readonly view: StewardSeasonView;
  /** Open the lord screen's standing policies on a kind (the card closes first); none: no way there from here. */
  readonly onPolicy?: ((kind: string) => void) | undefined;
}): ReactElement {
  return (
    <section className="season-steward" aria-label={COPY.sectionLabel} data-steward-items={String(view.items.length)}>
      <h3>{COPY.heading}</h3>
      {view.none === null ? null : <p className="season-steward-line">{view.none}</p>}
      {view.handled === null ? null : <p className="season-steward-line">{view.handled}</p>}
      {view.money === null ? null : <p className="season-steward-line">{view.money}</p>}
      {view.relations.map(line => <p key={line} className="season-steward-line season-steward-relation">{line}</p>)}
      {view.items.length === 0 ? null : <ul className="season-steward-items">
        {view.items.map(item => (
          <li key={item.id} data-steward-item={item.id} data-kind={item.kind ?? undefined}>
            <Disclosure className="season-steward-item" summaryClassName="season-steward-summary" variant="surface" summary={item.summary}>
              <dl className="season-steward-detail">
                <dt>{COPY.whatHeading}</dt><dd>{item.where}</dd><dd>{item.what}</dd>
                <dt>{COPY.policyHeading}</dt><dd>{item.policy}</dd>
                <dt>{COPY.resultHeading}</dt>{item.results.map((line, index) => <dd key={index}>{line}</dd>)}
              </dl>
              {onPolicy === undefined || item.kind === null ? null : <Button type="button" className="season-steward-policy" variant="secondary" size="md"
                data-steward-policy={item.kind} onPress={() => { if (item.kind !== null) onPolicy(item.kind); }}>{COPY.toPolicy}</Button>}
            </Disclosure>
          </li>))}
      </ul>}
      {view.brought.length === 0 ? null : <>
        <h4>{COPY.broughtHeading}</h4>
        <ul className="season-steward-brought">{view.brought.map((line, index) => <li key={index}>{line}</li>)}</ul>
      </>}
      {view.lapsed === null ? null : <p className="season-steward-line">{view.lapsed}</p>}
    </section>
  );
}
