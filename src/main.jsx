// main.jsx – App entry point: PWA registration + providers
import React from "react";
import ReactDOM from "react-dom/client";
import { LabProvider } from "./LabContext";
import SaaSOrchestrator, { DemoShell } from "./SaaSOrchestrator";
import "./index.css";

// ── QA Health Monitor (only in dev/test) ────────────────────────────────────
if (import.meta.env.DEV || import.meta.env.MODE === 'test') {
  import("./qaMonitor.js");
}

// ── Initialize Trusted Types (DOM XSS mitigation) ────────────────────────────
import "./trusted-types.js";

// ── Register Service Worker (PWA) ─────────────────────────────────────────────
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => console.log("SW registered:", reg.scope))
      .catch((err) => console.warn("SW registration failed:", err));
  });
}

const isDemo = window.location.pathname === "/demo" ||
  new URLSearchParams(window.location.search).get("demo") === "1";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <LabProvider>
      {isDemo ? <DemoShell /> : <SaaSOrchestrator />}
    </LabProvider>
  </React.StrictMode>
);
