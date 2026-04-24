import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { PointOverlay } from "./PointOverlay";
import { MacroRecorder } from "./MacroRecorder";

const urlParams  = new URLSearchParams(window.location.search);
const pointId    = urlParams.get("point");
const isRecorder = urlParams.get("recorder") === "1";

// Set transparent background before React renders so WebView2 on Windows
// never paints a white frame.
if (isRecorder) {
  document.documentElement.style.background = "transparent";
  document.body.style.cssText = "margin:0;background:transparent;";
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    {isRecorder ? (
      <MacroRecorder />
    ) : pointId ? (
      <PointOverlay id={pointId} />
    ) : (
      <App />
    )}
  </React.StrictMode>
);
