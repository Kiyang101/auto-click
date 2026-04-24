import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { PointOverlay } from "./PointOverlay";

const urlParams = new URLSearchParams(window.location.search);
const pointId   = urlParams.get("point");

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    {pointId ? (
      <PointOverlay id={pointId} />
    ) : (
      <App />
    )}
  </React.StrictMode>
);
