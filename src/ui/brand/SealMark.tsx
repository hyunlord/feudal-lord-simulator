import { useId, useMemo } from "react";
import { SEAL_ICON_ART, type BrandTone } from "./brandArt.generated";
import { brandIdPrefix, brandNodes } from "./brandSvg";

export type SealDetail = 32 | 64 | 256;
export type SealMarkProps = {
  /** The drawn size in CSS px. */
  readonly size: number;
  /** The kit's icon form: 32 drops the minor leaf veins (for small sizes), 64 and 256 are the standard seal. Default by size. */
  readonly detail?: SealDetail;
  readonly tone?: BrandTone;
  /** Said to assistive technology; without it the seal is decoration (aria-hidden). */
  readonly label?: string;
  readonly className?: string;
};

/** LM-R3: the game's wax seal (the brand kit's icons/seal-*.svg), the favicon's mark, for small places in the UI. */
export function SealMark({ size, detail = size <= 48 ? 32 : size <= 128 ? 64 : 256, tone = "on-light", label, className }: SealMarkProps) {
  const art = SEAL_ICON_ART[detail];
  const prefix = brandIdPrefix(useId());
  const children = useMemo(() => brandNodes(art.body, tone, prefix), [art, tone, prefix]);
  return (
    <svg className={className === undefined ? "seal-mark" : `seal-mark ${className}`} viewBox={`0 0 ${art.width} ${art.height}`}
      width={size} height={size} focusable="false" data-seal={detail}
      {...(label === undefined ? { "aria-hidden": true } : { role: "img", "aria-label": label })}>
      {children}
    </svg>
  );
}
