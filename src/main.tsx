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
import "./styles/stuckGoods.css";
import "./styles/chronicle.css";
import "./styles/legacy.css";
import "./styles/lordCards.css";
import "./styles/lordMode.css";
// UX-2: bundled OFL fonts (body sans 400/700, titles and the steward serif 600) and the UI art skin, loaded last.
import "@fontsource/noto-sans-kr/400.css";
import "@fontsource/noto-sans-kr/700.css";
import "@fontsource/noto-serif-kr/600.css";
import "./styles/uiSkin.css";
// UI-KIT-1: the shared controls and frames, after the skin tokens.
import "./styles/uiKit.css";

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
