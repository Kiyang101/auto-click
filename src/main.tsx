import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

const urlParams = new URLSearchParams(window.location.search);
if (urlParams.has('point')) {
  document.body.classList.add('point-overlay');
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
