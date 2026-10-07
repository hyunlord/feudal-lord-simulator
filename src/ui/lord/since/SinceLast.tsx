import type { ReactElement } from "react";

import { SINCE_LAST_COPY as COPY } from "./sinceLastCopy.ko";
import type { SinceLastView } from "./sinceLastModel";

// DEC-CARD A4: the recurring card's "지난번 같은 일 이후" block (text only), under the card's "why it came".
export function SinceLast({ view }: { readonly view: SinceLastView | null }): ReactElement | null {
  if (view === null) return null;
  return <section className="since-last" aria-label={COPY.regionLabel} data-since-last={String(view.lines.length)}>
    <h3>{view.heading}</h3>
    <ul>{view.lines.map(line => <li key={line}>{line}</li>)}</ul>
  </section>;
}
