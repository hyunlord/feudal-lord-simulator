import { useEffect, useRef, useState } from "react";

import { INTENT_ORDER } from "../../input/intentBus";
import { platformServices } from "../../platform/platform";
import { usePresentationPreference } from "../../render/PresentationToggle";
import { setPresentationPreference } from "../../render/presentationPreferences";
import { pickTile } from "../../render/picking";
import type { GameStoreApi } from "../../state/gameStore.types";
import { Button } from "../kit";
import { QA_OVERLAY_COPY as COPY } from "./qaOverlayCopy.ko";
import { qaOverlayLines, qaOverlayText, qaReading, type QaLine, type QaTile } from "./qaOverlayModel";
import { qaProbe } from "./qaProbe";

// NAT-2 QA tool: the QA info overlay (settings → developer, key `), bottom left over the layer switch. A React box that
// reads the map's refs four times a second while it is shown (qaProbe, the store's getters); nothing in the draw path,
// no recorder (unlike the proof port). Off, it renders nothing and subscribes to nothing.
const READ_MS = 250;
const COPIED_MS = 1_500;

export function QaOverlay({ store }: { readonly store: Pick<GameStoreApi, "getState" | "getSpeed"> }) {
  const shown = usePresentationPreference("qaOverlay");
  return shown ? <QaOverlayBox store={store} /> : null;
}

function QaOverlayBox({ store }: { readonly store: Pick<GameStoreApi, "getState" | "getSpeed"> }) {
  const click = useRef<QaTile | null>(null);
  const [lines, setLines] = useState<readonly QaLine[]>([]);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    // Before the map's handler (which may consume the press): the tile under the click, nothing handled.
    const unsubscribe = platformServices().input.subscribe(intent => {
      if (intent.kind === "select") click.current = pickTile(intent.world);
      return undefined;
    }, INTENT_ORDER.world - 1);
    const read = () => {
      const probe = qaProbe();
      if (probe === null) return;
      const next = qaOverlayLines(qaReading(store.getState(), { speed: store.getSpeed(), camera: probe.camera(), viewport: probe.viewport(), click: click.current,
        selection: probe.selection() }));
      setLines(current => current.length === next.length && current.every((entry, index) => entry.value === next[index]!.value) ? current : next);
    };
    read();
    const timer = window.setInterval(read, READ_MS);
    return () => { window.clearInterval(timer); unsubscribe(); };
  }, [store]);
  const clipboard = typeof navigator === "undefined" ? undefined : navigator.clipboard;
  return (
    <section className="qa-overlay" aria-label={COPY.region} data-testid="qa-overlay">
      <dl className="qa-overlay-lines">
        {lines.map(entry => <div key={entry.key} className="qa-overlay-line" data-qa={entry.key}><dt>{entry.label}</dt><dd>{entry.value}</dd></div>)}
      </dl>
      <div className="qa-overlay-actions">
        {clipboard === undefined ? null : <Button type="button" className="qa-overlay-copy" aria-label={COPY.copyLabel} variant="secondary"
          onPress={() => { void clipboard.writeText(qaOverlayText(lines)).then(() => { setCopied(true); window.setTimeout(() => setCopied(false), COPIED_MS); }, () => setCopied(false)); }}>{copied ? COPY.copied : COPY.copy}</Button>}
        <Button type="button" className="qa-overlay-close" aria-label={COPY.close} variant="icon" onPress={() => setPresentationPreference("qaOverlay", false)}>{COPY.closeMark}</Button>
      </div>
    </section>
  );
}
