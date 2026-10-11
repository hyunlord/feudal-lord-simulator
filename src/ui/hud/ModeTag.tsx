import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";

import { SealMark } from "../brand/SealMark";
import { Tooltip } from "../kit";
import { UiIcon } from "../UiIcon";
import { HUD_ART, HudArt } from "./hudArt";
import { HUD_COPY } from "./hudCopy.ko";

/** The room the pill keeps from the speed seals (the audit's gap). */
export const MODE_TAG_GAP_PX = 8;

/**
 * WEL-D1 (user 2026-10-11: "자리가 모자라면 꼬리표가 가장 먼저 숨는다"): whether the tag has room — the pill (with the tag when
 * it shows, without it when hidden) and the gap before the speed seals. The pill's other cells never shrink or wrap.
 */
export function modeTagFits(input: { readonly pillRight: number; readonly tagWidth: number; readonly sealsLeft: number; readonly shown: boolean }): boolean {
  const right = input.shown ? input.pillRight : input.pillRight + input.tagWidth;
  return right + MODE_TAG_GAP_PX <= input.sealsLeft;
}

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
  // No room before the speed seals (a long translation, extreme numbers at 1024): the tag hides first; the pill's name
  // still says the mode. Re-read as the pill's numbers or the window change.
  const ref = useRef<HTMLSpanElement | null>(null);
  const width = useRef(0);
  const [room, setRoom] = useState(true);
  useLayoutEffect(() => {
    const tag = ref.current; const pill = tag?.closest(".status-pill");
    if (tag === null || pill === null || pill === undefined) return undefined;
    const check = () => {
      const seals = document.querySelector(".hud-time-cluster");
      if (seals === null) return;
      if (!tag.hidden) width.current = tag.getBoundingClientRect().width;
      setRoom(modeTagFits({ pillRight: pill.getBoundingClientRect().right, tagWidth: width.current, sealsLeft: seals.getBoundingClientRect().left, shown: !tag.hidden }));
    };
    check();
    const observer = new ResizeObserver(check);
    observer.observe(pill);
    window.addEventListener("resize", check);
    return () => { observer.disconnect(); window.removeEventListener("resize", check); };
  }, [narrow]);
  const tipId = useId();
  const words = HUD_COPY.mode[lord ? "lord" : "build"];
  const shown = narrow && tip;
  return (
    <span ref={ref} hidden={!room} className="status-pill-mode" data-mode={lord ? "lord" : "build"} role="img" aria-label={words} tabIndex={narrow && room ? 0 : -1}
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
