// LM-R3 stub (lmr3-start's branch only): the props of lmr3-brand's GameLogo, which replaces this file at merge. It draws
// the game's name as text in the kit's serif so the welcome's layout can be measured until the outlined logo lands.
import { KO_UI } from "../../content/locale.ko";

export type GameLogoProps = {
  readonly language: "ko" | "en";
  readonly layout: "horizontal" | "vertical";
  readonly tone: "on-light" | "on-dark";
  /** The logo's width in px (the height follows the kit's aspect: horizontal 1200×280, vertical 720×640). */
  readonly width: number;
  readonly className?: string | undefined;
};

export function GameLogo({ layout, width, className }: GameLogoProps) {
  const height = Math.round(layout === "horizontal" ? width * 280 / 1200 : width * 640 / 720);
  return <span className={className} role="img" aria-label={KO_UI.appName}
    style={{ display: "inline-grid", placeItems: "center", width, height, fontFamily: "var(--ui-font-serif)", fontSize: Math.min(Math.round(height * 0.6), Math.floor(width / (KO_UI.appName.length + 1))), whiteSpace: "nowrap" }}>
    <span aria-hidden="true">{KO_UI.appName}</span>
  </span>;
}
