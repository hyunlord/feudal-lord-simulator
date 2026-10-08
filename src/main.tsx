import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App";
import { GameProvider } from "./state/gameStore";
import "./styles/global.css";
import "./styles/buildMenu.css";
import "./styles/resourceBar.css";
import "./styles/uiConsole.css";
import "./styles/uiBoundaries.css";
import "./styles/inspector.css";
import "./styles/settlement.css";
import "./styles/tutorial.css";
import "./styles/alertStack.css";
import "./styles/uiInspector.css";
import "./styles/hudShell.css";
import "./styles/lmr1Hud.css";
import "./styles/stuckGoods.css";
import "./styles/chronicle.css";
import "./styles/legacy.css";
import "./styles/lordCards.css";
import "./styles/decisionCard.css";
import "./styles/results.css";
// LM-R3: the lord slice's opening page and its end.
import "./styles/slice.css";
import "./styles/registryCard.css";
import "./styles/lordMode.css";
// LM-R2: the lord screen host and its four areas' screens (lord mode only).
import "./styles/lordScreen.css";
import "./styles/lordNegotiation.css";
import "./styles/lordLedger.css";
import "./styles/lordEstates.css";
import "./styles/lordRegion.css";
// DEC-CARD (Astra's lord-mode play): the way back to town, the treasury by estate, a recurring card's "since last time".
import "./styles/lordAdvice.css";
// DEC-CARD-2: the steward's season report and the standing policies.
import "./styles/lordSteward.css";
// LM-R3: the welcome's logo and mode options, the house choice.
import "./styles/welcomeHouse.css";
// UX-2: bundled OFL fonts (body sans 400/700, titles and the steward serif 600) and the UI art skin, loaded last.
import "@fontsource/noto-sans-kr/400.css";
import "@fontsource/noto-sans-kr/700.css";
import "@fontsource/noto-serif-kr/600.css";
import "./styles/uiSkin.css";
// UI-KIT-1: the shared controls and frames, after the skin tokens.
import "./styles/uiKit.css";
// LM-R1: the Wave 38 control pictures, loaded once; a failure swaps the P0 pictures back (src/ui/wave38Art.ts).
import { preloadWave38Art } from "./ui/wave38Art";
import { BRAND_COPY } from "./ui/brand/brandCopy.ko";

preloadWave38Art();
// LM-R3 (TITLE-1): the window title; index.html carries the same (scripts/brandArt.ts writes it from the copy).
document.title = BRAND_COPY.windowTitle;

const rootElement = document.getElementById("root");

if (rootElement === null) {
  throw new Error("Root element not found");
}

// UI-KIT-1: /dev/ui-kit is the kit gallery (a developer screen, loaded only there), not the game.
const galleryPath = new URL("dev/ui-kit", new URL(import.meta.env.BASE_URL, window.location.origin)).pathname;
if (window.location.pathname.replace(/\/$/, "") === galleryPath) {
  void import("./ui/kit/UiKitGallery").then(({ UiKitGallery }) => createRoot(rootElement).render(<StrictMode><UiKitGallery /></StrictMode>));
} else {
  createRoot(rootElement).render(
    <StrictMode>
      <GameProvider>
        <App />
      </GameProvider>
    </StrictMode>,
  );
}
