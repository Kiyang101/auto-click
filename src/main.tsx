import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { PointOverlay } from "./PointOverlay";
import { MacroRecorder } from "./MacroRecorder";

const urlParams  = new URLSearchParams(window.location.search);
const pointId    = urlParams.get("point");
const isRecorder = urlParams.get("recorder") === "1";

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
