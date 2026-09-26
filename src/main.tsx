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
// UX-2: bundled OFL fonts (body sans 400/700, titles and the steward serif 600) and the UI art skin, loaded last.
import "@fontsource/noto-sans-kr/400.css";
import "@fontsource/noto-sans-kr/700.css";
import "@fontsource/noto-serif-kr/600.css";
import "./styles/uiSkin.css";

const rootElement = document.getElementById("root");

if (rootElement === null) {
  throw new Error("Root element not found");
}

createRoot(rootElement).render(
  <StrictMode>
    <GameProvider>
      <App />
    </GameProvider>
  </StrictMode>,
);
