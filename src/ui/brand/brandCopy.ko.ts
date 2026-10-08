import { KO_UI } from "../../content/locale.ko";

// LM-R3 (TITLE-1): the game's name. The English name appears only here: the logo's label and the window title carry
// both names (tests/phase11PublishedUi.test.ts allows "Charter & Kin" in this file alone).
export const BRAND_COPY = {
  name: KO_UI.appName,
  logoLabel: `${KO_UI.appName} (Charter & Kin)`,
  windowTitle: `${KO_UI.appName} · Charter & Kin`,
  /** index.html's description (scripts/brandArt.ts writes it there). */
  description: "중세 영지의 영주가 되어 특허장과 판결로 마을이 자랄 조건을 만들고, 가문을 대대로 잇는 경영 시뮬레이션.",
} as const;
