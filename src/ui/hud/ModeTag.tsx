import { useEffect, useId, useState } from "react";

import { SealMark } from "../brand/SealMark";
import { Tooltip } from "../kit";
import { UiIcon } from "../UiIcon";
import { HUD_ART, HudArt } from "./hudArt";
import { HUD_COPY } from "./hudCopy.ko";

/** The widths where the tag is its picture alone (the stylesheet's own break: 1100 px and narrower). */
const NARROW = "(max-width: 1100px)";

function useNarrow(): boolean {
  const [narrow, setNarrow] = useState(() => typeof window !== "undefined" && window.matchMedia(NARROW).matches);
  useEffect(() => {
    const query = window.matchMedia(NARROW);
    const change = () => setNarrow(query.matches);
    query.addEventListener("change", change);
    return () => query.removeEventListener("change", change);
  }, []);
  return narrow;
}

/**
 * WEL-D1 (user 2026-10-11): which mode the game is in, at the status pill's head — "영주 모드" / "직접 짓기" in words from
 * 1101 px wide; at 1100 and narrower its picture only (the seal for lord mode, the build dock's tools for building), the
 * whole words in its name and in a tooltip shown on a pointer's move over it, keyboard focus and a press (not on a pointer
 * resting there or focus the page moved). A tag, not a button: the pill's cells (its buttons) keep their order.
 */
export function ModeTag({ lord }: { readonly lord: boolean }) {
  const narrow = useNarrow();
  const [tip, setTip] = useState(false);
  const tipId = useId();
  const words = HUD_COPY.mode[lord ? "lord" : "build"];
  const shown = narrow && tip;
  return (
    <span className="status-pill-mode" data-mode={lord ? "lord" : "build"} role="img" aria-label={words} tabIndex={narrow ? 0 : -1}
      aria-describedby={shown ? tipId : undefined} onPointerMove={() => setTip(true)} onPointerLeave={() => setTip(false)}
      onFocus={event => { if (event.currentTarget.matches(":focus-visible")) setTip(true); }} onBlur={() => setTip(false)}
      onPointerDown={() => setTip(open => !open)}>
      <span className="status-pill-mode-icon" aria-hidden="true">
        {lord ? <SealMark size={32} />
          : <HudArt id={HUD_ART.build} width={32} className="ui-icon" fallback={<UiIcon sheet="category" cell="living" size={32} />} />}
      </span>
      <span className="status-pill-mode-words" aria-hidden="true">{words}</span>
      {shown ? <Tooltip id={tipId} className="status-pill-mode-tip">{words}</Tooltip> : null}
    </span>
  );
}
