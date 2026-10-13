import { Button } from "../../kit";
import { GROWTH_COPY } from "./growthCopy.ko";
import type { GrowthLeverAction, GrowthView } from "./growthMark";

/**
 * LS1-3 (lord-screen-v1.md): the growth panel at the head of the population slot (the pill's population cell opens it) —
 * the cause in one line (the main one, P-C3), since when, and the lord's lever: one button to its command's existing
 * screen, or the plain sentence that he has none (no button made up). While the town still grows it is what holds the
 * next step, headed so, with no "since" (LS1-6: not a stop, A4).
 */
export function GrowthPanel({ view, onLever }: { readonly view: GrowthView; readonly onLever: (action: GrowthLeverAction) => void }) {
  const { lever } = view;
  const heading = view.mark === null ? GROWTH_COPY.panel.next : view.mark.label;
  return (
    <section className="growth-panel" aria-label={heading} data-growth-reason={view.block.reason} data-growth-stop={view.mark === null ? "no" : "yes"}>
      <h3>{heading}</h3>
      <p className="growth-panel-reason">{view.reason}</p>
      {view.since === null ? null : <p className="growth-panel-since">{view.since}</p>}
      <p className="growth-panel-lever">{lever.line}</p>
      {lever.button !== null && lever.action !== null
        ? <Button type="button" className="growth-panel-act" variant="secondary" onPress={() => { if (lever.action !== null) onLever(lever.action); }}>{lever.button}</Button> : null}
    </section>
  );
}
