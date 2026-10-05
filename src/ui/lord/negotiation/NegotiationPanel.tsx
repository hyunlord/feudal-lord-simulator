import type { ReactElement } from "react";
import { LORD_SCREEN_COPY } from "../screen/lordScreenCopy.ko";
import type { LordNavGate, LordPanelProps } from "../screen/lordScreenTypes";

// LM-R2 (negotiation area): the lord screen's "marriage" menu item. The scaffold's stub — the area agent replaces the panel and
// the gate (return null once the screen is built; a state-dependent reason when it cannot open).

export const negotiationGate: LordNavGate = () => LORD_SCREEN_COPY.soon;

export function NegotiationPanel(_props: LordPanelProps): ReactElement {
  return <p className="lord-screen-soon">{LORD_SCREEN_COPY.soon}</p>;
}
