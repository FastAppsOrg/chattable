console.log("[AppKit] main.tsx loading...");

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/design-system.css";
import "./index.css";
import "./styles/responsive.css";
import App from "./App.tsx";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./auth/AuthProvider.tsx";
import { ThemeProvider } from "./contexts/ThemeContext.tsx";
import { VibetorchInspector } from "@vibetorch/inspector";

console.log("[AppKit] main.tsx imports loaded");

// Detect Electron environment
if (window.electron?.isElectron) {
  console.log("[AppKit] Running in Electron mode");
  console.log("[AppKit] Platform:", window.electron.platform);
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ThemeProvider>
          <App />
          <VibetorchInspector />
        </ThemeProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
