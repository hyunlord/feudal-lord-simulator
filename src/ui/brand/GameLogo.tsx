import { useId, useMemo } from "react";
import { LOGO_ART, type BrandTone } from "./brandArt.generated";
import { BRAND_COPY } from "./brandCopy.ko";
import { brandIdPrefix, brandNodes } from "./brandSvg";

export type GameLogoLanguage = "ko" | "en";
export type GameLogoLayout = "horizontal" | "vertical";
export type GameLogoProps = {
  readonly language?: GameLogoLanguage;
  readonly layout?: GameLogoLayout;
  /** on-light: oak lettering for a light ground; on-dark: parchment lettering for a dark one. */
  readonly tone: BrandTone;
  /** The drawn width in CSS px; the height follows the kit's proportions (horizontal 1200×280, vertical 720×640). */
  readonly width: number;
  readonly className?: string;
};

/** LM-R3 (TITLE-1): the game's logo — the wax seal and the Korean or English wordmark — from the kit's outlined SVGs. */
export function GameLogo({ language = "ko", layout = "horizontal", tone, width, className }: GameLogoProps) {
  const art = LOGO_ART[`${language}-${layout}`];
  const prefix = brandIdPrefix(useId());
  const children = useMemo(() => brandNodes(art.body, tone, prefix), [art, tone, prefix]);
  return (
    <svg className={className === undefined ? "game-logo" : `game-logo ${className}`} viewBox={`0 0 ${art.width} ${art.height}`}
      width={width} height={Math.round(width * art.height / art.width * 100) / 100} role="img" aria-label={BRAND_COPY.logoLabel}
      focusable="false" data-logo={`${language}-${layout}-${tone}`}>
      {children}
    </svg>
  );
}
