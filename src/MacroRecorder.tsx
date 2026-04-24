/**
 * MacroRecorder — transparent fullscreen overlay window.
 *
 * Opened as a separate Tauri WebviewWindow when the user presses REC.
 * Captures left-clicks and key-presses and emits them as "macro-record-action"
 * events to the main window.  Press ESC or the floating "Done" button to finish.
 *
 * Position note: because the window is created at (x:0, y:0) and is fullscreen,
 * clientX / clientY already equal absolute screen coordinates in logical pixels.
 * We add window.screenX / window.screenY as an extra safety offset so the maths
 * stays correct even if Tauri positions the window slightly off-origin (e.g. macOS
 * menu bar).
 */

import { useEffect, useRef, useState } from "react";
import { emit } from "@tauri-apps/api/event";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { MacroAction } from "./types/macro";

export function MacroRecorder() {
  const [count, setCount] = useState(0);
  // Cached DPI scale factor — fetched once on mount.
  // macOS Core Graphics uses logical points so no scaling needed there;
  // Windows/Linux enigo.move_mouse expects physical pixels.
  const scaleRef = useRef(1);
  const isMac = navigator.userAgent.includes("Mac");

  useEffect(() => {
    // Reinforce transparent background (belt-and-suspenders alongside main.tsx).
    document.documentElement.style.background = "transparent";
    document.body.style.cssText = "margin:0;background:transparent;";

    getCurrentWebviewWindow()
      .scaleFactor()
      .then((sf) => { scaleRef.current = sf; });

    const handleClick = async (e: MouseEvent) => {
      // Prevent event from interfering with the recording indicator itself
      const target = e.target as HTMLElement;
      if (target.closest("#macro-recorder-hud")) return;

      e.preventDefault();
      e.stopPropagation();

      // clientX/Y are CSS logical pixels; screenX/Y give the window's logical
      // origin (non-zero on macOS due to the menu bar offset).
      const logX = e.clientX + (window.screenX || 0);
      const logY = e.clientY + (window.screenY || 0);
      // macOS: Core Graphics already works in logical points → no conversion.
      // Windows/Linux: enigo SendInput needs physical pixels → multiply by DPI scale.
      const absX = Math.round(isMac ? logX : logX * scaleRef.current);
      const absY = Math.round(isMac ? logY : logY * scaleRef.current);

      const action: Omit<MacroAction, "id"> = {
        type: "click",
        x: absX,
        y: absY,
        delay_after: 100,
      };

      await emit("macro-record-action", action);
      setCount((c) => c + 1);
    };

    const handleKeyDown = async (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        await closeRecorder();
        return;
      }

      const isModifier = ["Control", "Meta", "Shift", "Alt"].includes(e.key);
      if (isModifier) return;

      const action: Omit<MacroAction, "id"> = {
        type: "key",
        key: e.key,
        delay_after: 100,
      };

      await emit("macro-record-action", action);
      setCount((c) => c + 1);
    };

    document.addEventListener("click", handleClick, { capture: true });
    document.addEventListener("keydown", handleKeyDown, { capture: true });

    return () => {
      document.removeEventListener("click", handleClick, { capture: true });
      document.removeEventListener("keydown", handleKeyDown, { capture: true });
    };
  }, []);

  async function closeRecorder() {
    await emit("macro-record-stop", {});
    const win = getCurrentWebviewWindow();
    await win.close();
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        // Very-slightly non-zero opacity so the window registers as a click target
        background: "rgba(0,0,0,0.01)",
        cursor: "crosshair",
      }}
    >
      {/* Floating HUD — not transparent so the user can read it */}
      <div
        id="macro-recorder-hud"
        style={{
          position: "absolute",
          top: 16,
          left: "50%",
          transform: "translateX(-50%)",
          background: "rgba(20, 20, 30, 0.92)",
          backdropFilter: "blur(12px)",
          border: "1px solid rgba(239,68,68,0.5)",
          borderRadius: 12,
          padding: "10px 18px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          color: "#fff",
          fontFamily: "system-ui, -apple-system, sans-serif",
          fontSize: 13,
          fontWeight: 700,
          userSelect: "none",
          zIndex: 9999,
          boxShadow: "0 4px 24px rgba(0,0,0,0.6)",
          cursor: "default",
          whiteSpace: "nowrap",
        }}
      >
        {/* Pulsing red dot */}
        <div
          style={{
            width: 9,
            height: 9,
            borderRadius: "50%",
            background: "#ef4444",
            flexShrink: 0,
            animation: "pulse-rec 1.2s ease-in-out infinite",
          }}
        />
        <span style={{ color: "#ef4444" }}>RECORDING</span>
        <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 11 }}>
          {count} action{count !== 1 ? "s" : ""}
        </span>
        <span
          style={{
            marginLeft: 4,
            color: "rgba(255,255,255,0.35)",
            fontSize: 11,
          }}
        >
          Click to capture · ESC to finish
        </span>

        {/* Done button */}
        <button
          onClick={closeRecorder}
          style={{
            marginLeft: 8,
            background: "rgba(239,68,68,0.15)",
            border: "1px solid rgba(239,68,68,0.4)",
            borderRadius: 7,
            color: "#ef4444",
            fontSize: 11,
            fontWeight: 800,
            padding: "4px 12px",
            cursor: "pointer",
            letterSpacing: "0.5px",
          }}
        >
          DONE
        </button>
      </div>

      <style>{`
        @keyframes pulse-rec {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.85); }
        }
      `}</style>
    </div>
  );
}
