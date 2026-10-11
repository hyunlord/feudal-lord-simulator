import { useId, useState } from "react";

import { SealMark } from "../brand/SealMark";
import { Tooltip } from "../kit";
import { UiIcon } from "../UiIcon";
import { HUD_ART, HudArt } from "./hudArt";
import { HUD_COPY } from "./hudCopy.ko";

/**
 * WEL-D1 (user 2026-10-11): which mode the game is in, at the status pill's head — "영주 모드" / "직접 짓기" in words from
 * 1101 px wide; at 1024 and narrower its picture only (the seal for lord mode, the build dock's tools for building), the
 * whole words in its name and in a tooltip shown on hover, focus and press. A tag, not a button: the pill's cells (its
 * buttons) keep their order for every script that picks them.
 */
export function ModeTag({ lord }: { readonly lord: boolean }) {
  const [tip, setTip] = useState(false);
  const tipId = useId();
  const words = HUD_COPY.mode[lord ? "lord" : "build"];
  return (
    <span className="status-pill-mode" data-mode={lord ? "lord" : "build"} role="img" aria-label={words} tabIndex={0}
      aria-describedby={tip ? tipId : undefined} onMouseEnter={() => setTip(true)} onMouseLeave={() => setTip(false)}
      onFocus={() => setTip(true)} onBlur={() => setTip(false)} onPointerDown={() => setTip(open => !open)}>
      <span className="status-pill-mode-icon" aria-hidden="true">
        {lord ? <SealMark size={32} />
          : <HudArt id={HUD_ART.build} width={32} className="ui-icon" fallback={<UiIcon sheet="category" cell="living" size={32} />} />}
      </span>
      <span className="status-pill-mode-words" aria-hidden="true">{words}</span>
      {tip ? <Tooltip id={tipId} className="status-pill-mode-tip">{words}</Tooltip> : null}
    </span>
  );
}
