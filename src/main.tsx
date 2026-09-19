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
