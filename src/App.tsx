import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { register, unregisterAll } from "@tauri-apps/plugin-global-shortcut";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { emit } from "@tauri-apps/api/event";
import {
  IconPlay,
  IconStop,
  IconPlus,
  IconEye,
  IconEyeOff,
  IconClock,
  IconKeyboard,
} from "./components/Icons";
import { TimeSelector } from "./components/TimeSelector";
import { ShortcutBox } from "./components/ShortcutBox";
import { PointItem } from "./components/PointItem";
import { MacroMode } from "./MacroMode";
import { MacroAction } from "./types/macro";
import "./App.css";
import "./Point.css";

const isTauri =
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

interface Point {
  id: string;
  interval: number;
}

function App() {
  const [mode, setMode] = useState<"single" | "multi" | "macro">("single");
  const [intervalMs, setIntervalMs] = useState<number>(100);

  const [isClickingSingle, setIsClickingSingle] = useState<boolean>(false);
  const [isClickingMulti, setIsClickingMulti] = useState<boolean>(false);
  const isClicking = isClickingSingle || isClickingMulti;

  const [hasPermission, setHasPermission] = useState<boolean>(true);

  const [singleShortcut, setSingleShortcut] = useState<string>(
    () => localStorage.getItem("singleShortcut") || "Control+Shift+A",
  );
  const [multiShortcut, setMultiShortcut] = useState<string>(
    () => localStorage.getItem("multiShortcut") || "Control+Shift+S",
  );
  const [macroShortcut, setMacroShortcut] = useState<string>(
    () => localStorage.getItem("macroShortcut") || "Control+Shift+M",
  );

  const [recordingTarget, setRecordingTarget] = useState<
    "single" | "multi" | "macro" | null
  >(null);

  const [points, setPoints] = useState<Point[]>([]);
  const [pointsVisible, setPointsVisible] = useState(true);
  const pointListRef = useRef<HTMLDivElement>(null);

  // ── macro state ────────────────────────────────────────────────────────────
  const [macroActions, setMacroActions] = useState<MacroAction[]>([]);
  const [macroRepeat, setMacroRepeat] = useState<number>(-1);
  const [macroSpeed, setMacroSpeed] = useState<number>(1.0);
  const [isPlayingMacro, setIsPlayingMacro] = useState<boolean>(false);

  // stateRef keeps shortcut handlers in sync with latest state
  const stateRef = useRef({
    isClickingSingle,
    isClickingMulti,
    intervalMs,
    points,
    isPlayingMacro,
    macroActions,
    macroRepeat,
    macroSpeed,
  });

  useEffect(() => {
    stateRef.current = {
      isClickingSingle,
      isClickingMulti,
      intervalMs,
      points,
      isPlayingMacro,
      macroActions,
      macroRepeat,
      macroSpeed,
    };
    const syncIndices = async () => {
      await emit("update-indices", {
        mapping: points.reduce(
          (acc, p, idx) => ({ ...acc, [p.id]: idx + 1 }),
          {},
        ),
      });
    };
    syncIndices();

    if (pointListRef.current) {
      pointListRef.current.scrollTop = pointListRef.current.scrollHeight;
    }
  }, [
    isClickingSingle,
    isClickingMulti,
    intervalMs,
    points,
    isPlayingMacro,
    macroActions,
    macroRepeat,
    macroSpeed,
  ]);

  useEffect(() => {
    if (isTauri) checkPermission();
  }, []);

  // ── global shortcut registration ───────────────────────────────────────────
  useEffect(() => {
    if (!isTauri) return;

    async function setupShortcuts() {
      try {
        await unregisterAll();
        if (recordingTarget !== null) return;

        // Single
        if (singleShortcut) {
          await register(singleShortcut, async (event) => {
            if (event.state === "Pressed") {
              const cur = stateRef.current;
              if (cur.isClickingSingle) {
                await invoke("stop_clicking");
                setIsClickingSingle(false);
              } else if (!cur.isClickingMulti && !cur.isPlayingMacro) {
                try {
                  await invoke("start_clicking", { intervalMs: cur.intervalMs });
                  setIsClickingSingle(true);
                } catch (error) {
                  console.error(error);
                }
              }
            }
          });
          localStorage.setItem("singleShortcut", singleShortcut);
        }

        // Multi
        if (multiShortcut && multiShortcut !== singleShortcut) {
          await register(multiShortcut, async (event) => {
            if (event.state === "Pressed") {
              const cur = stateRef.current;
              if (cur.isClickingMulti) {
                await invoke("stop_clicking");
                for (const p of cur.points) {
                  const win = await WebviewWindow.getByLabel(`point-${p.id}`);
                  if (win) await win.setIgnoreCursorEvents(false);
                }
                setIsClickingMulti(false);
              } else if (!cur.isClickingSingle && !cur.isPlayingMacro) {
                try {
                  const pointsConfig = await Promise.all(
                    cur.points.map(async (p) => {
                      const win = await WebviewWindow.getByLabel(`point-${p.id}`);
                      if (win) {
                        await win.setIgnoreCursorEvents(true);
                        const pos = await win.innerPosition();
                        const size = await win.innerSize();
                        const factor = await win.scaleFactor();
                        const isMac = navigator.userAgent.includes("Mac");
                        const x = isMac
                          ? (pos.x + size.width / 2) / factor
                          : pos.x + size.width / 2;
                        const y = isMac
                          ? (pos.y + size.height / 2) / factor
                          : pos.y + size.height / 2;
                        return { id: p.id, x: Math.round(x), y: Math.round(y), interval: p.interval };
                      }
                      return null;
                    }),
                  );
                  const validPoints = pointsConfig.filter((p) => p !== null);
                  if (validPoints.length > 0) {
                    await invoke("start_multi_clicking", { points: validPoints });
                    setIsClickingMulti(true);
                  }
                } catch (error) {
                  console.error(error);
                }
              }
            }
          });
          localStorage.setItem("multiShortcut", multiShortcut);
        }

        // Macro
        if (
          macroShortcut &&
          macroShortcut !== singleShortcut &&
          macroShortcut !== multiShortcut
        ) {
          await register(macroShortcut, async (event) => {
            if (event.state === "Pressed") {
              const cur = stateRef.current;
              if (cur.isPlayingMacro) {
                await invoke("stop_macro");
                setIsPlayingMacro(false);
              } else if (
                !cur.isClickingSingle &&
                !cur.isClickingMulti &&
                cur.macroActions.length > 0
              ) {
                try {
                  await invoke("play_macro", {
                    actions: cur.macroActions,
                    repeat: cur.macroRepeat,
                    speed: cur.macroSpeed,
                  });
                  setIsPlayingMacro(true);
                } catch (error) {
                  console.error(error);
                }
              }
            }
          });
          localStorage.setItem("macroShortcut", macroShortcut);
        }
      } catch (err) {
        console.error(err);
      }
    }

    setupShortcuts();
    return () => {
      if (isTauri) unregisterAll().catch(console.error);
    };
  }, [singleShortcut, multiShortcut, macroShortcut, recordingTarget]);

  async function checkPermission() {
    try {
      const permission = await invoke<boolean>("check_permissions");
      setHasPermission(permission);
    } catch (e) {
      console.error(e);
    }
  }

  async function startClicking(targetMode: "single" | "multi") {
    if (!isTauri) return;
    try {
      if (targetMode === "single") {
        await invoke("start_clicking", { intervalMs });
        setIsClickingSingle(true);
      } else {
        const pointsConfig = await Promise.all(
          points.map(async (p) => {
            const win = await WebviewWindow.getByLabel(`point-${p.id}`);
            if (win) {
              await win.setIgnoreCursorEvents(true);
              const pos = await win.innerPosition();
              const size = await win.innerSize();
              const factor = await win.scaleFactor();
              const isMac = navigator.userAgent.includes("Mac");
              const x = isMac
                ? (pos.x + size.width / 2) / factor
                : pos.x + size.width / 2;
              const y = isMac
                ? (pos.y + size.height / 2) / factor
                : pos.y + size.height / 2;
              return { id: p.id, x: Math.round(x), y: Math.round(y), interval: p.interval };
            }
            return null;
          }),
        );
        const validPoints = pointsConfig.filter((p) => p !== null);
        if (validPoints.length === 0) return;
        await invoke("start_multi_clicking", { points: validPoints });
        setIsClickingMulti(true);
      }
    } catch (error) {
      console.error(error);
    }
  }

  async function stopClicking() {
    if (!isTauri) return;
    try {
      await invoke("stop_clicking");
      for (const p of points) {
        const win = await WebviewWindow.getByLabel(`point-${p.id}`);
        if (win) await win.setIgnoreCursorEvents(false);
      }
      setIsClickingSingle(false);
      setIsClickingMulti(false);
    } catch (error) {
      console.error(error);
    }
  }

  // ── macro play / stop ──────────────────────────────────────────────────────
  async function playMacro() {
    if (!isTauri || macroActions.length === 0) return;
    try {
      await invoke("play_macro", {
        actions: macroActions,
        repeat: macroRepeat,
        speed: macroSpeed,
      });
      setIsPlayingMacro(true);
    } catch (error) {
      console.error(error);
    }
  }

  async function stopMacro() {
    if (!isTauri) return;
    try {
      await invoke("stop_macro");
    } catch (error) {
      console.error(error);
    }
    setIsPlayingMacro(false);
  }

  // ── multi-point helpers ────────────────────────────────────────────────────
  async function addPoint() {
    if (!isTauri) return;
    const id = Date.now().toString();
    const label = (points.length + 1).toString();
    const webview = new WebviewWindow(`point-${id}`, {
      url: `index.html?point=${id}&label=${label}`,
      title: `Point ${id}`,
      width: 50,
      height: 50,
      transparent: true,
      decorations: false,
      alwaysOnTop: true,
      resizable: false,
      skipTaskbar: true,
      center: true,
    });
    webview.once("tauri://created", function () {
      setPoints((prev) => [...prev, { id, interval: 100 }]);
    });
  }

  async function removePoint(id: string) {
    if (!isTauri) return;
    const win = await WebviewWindow.getByLabel(`point-${id}`);
    if (win) await win.close();
    setPoints((prev) => prev.filter((p) => p.id !== id));
  }

  async function togglePointsVisibility() {
    if (!isTauri) return;
    const newVisible = !pointsVisible;
    for (const p of points) {
      const win = await WebviewWindow.getByLabel(`point-${p.id}`);
      if (win) {
        if (newVisible) await win.show();
        else await win.hide();
      }
    }
    setPointsVisible(newVisible);
  }

  const isAnyActive = isClicking || isPlayingMacro;

  return (
    <main className="container">
      <div className={`card${mode === "macro" ? " card--macro" : ""}`}>
        <h1>AUTO CLICKER PRO</h1>

        {!hasPermission && isTauri && (
          <div className="permission-warning">
            ⚠️ Accessibility permission required
          </div>
        )}

        <div className="tabs">
          <div
            className={`tab ${mode === "single" ? "active" : ""}`}
            onClick={() => setMode("single")}
          >
            Single
          </div>
          <div
            className={`tab ${mode === "multi" ? "active" : ""}`}
            onClick={() => setMode("multi")}
          >
            Multiple
          </div>
          <div
            className={`tab ${mode === "macro" ? "active" : ""}`}
            onClick={() => setMode("macro")}
          >
            Macro
          </div>
        </div>

        {/* ── Single ── */}
        {mode === "single" && (
          <div className="mode-content">
            <div className="input-group">
              <div className="label-with-icon">
                <IconClock /> Click Interval
              </div>
              <TimeSelector
                value={intervalMs}
                onChange={setIntervalMs}
                disabled={isClicking}
              />
            </div>
            <div className="input-group">
              <div className="label-with-icon">
                <IconKeyboard /> Start/Stop Shortcut
              </div>
              <ShortcutBox
                shortcut={singleShortcut}
                isRecording={recordingTarget === "single"}
                onStartRecording={() => setRecordingTarget("single")}
                onSetShortcut={(s) => {
                  setSingleShortcut(s);
                  setRecordingTarget(null);
                }}
                onCancelRecording={() => setRecordingTarget(null)}
              />
            </div>
          </div>
        )}

        {/* ── Multiple ── */}
        {mode === "multi" && (
          <div className="mode-content">
            <div className="secondary-actions">
              <button
                className="add-point-btn"
                onClick={addPoint}
                disabled={isClicking}
              >
                <IconPlus /> Add Target
              </button>
              <button
                className="icon-btn"
                onClick={togglePointsVisibility}
                title="Toggle Visibility"
              >
                {pointsVisible ? <IconEye /> : <IconEyeOff />}
              </button>
            </div>

            <div className="point-list" ref={pointListRef}>
              {points.length === 0 && (
                <div className="empty-list-text">No targets added.</div>
              )}
              {points.map((p, index) => (
                <PointItem
                  key={p.id}
                  id={p.id}
                  index={index}
                  interval={p.interval}
                  isClicking={isClicking}
                  onRemove={removePoint}
                  onIntervalChange={(newVal) => {
                    setPoints((prev) =>
                      prev.map((item, i) =>
                        i === index ? { ...item, interval: newVal } : item,
                      ),
                    );
                  }}
                />
              ))}
            </div>

            <div className="input-group">
              <div className="label-with-icon">
                <IconKeyboard /> Multi Start/Stop
              </div>
              <ShortcutBox
                shortcut={multiShortcut}
                isRecording={recordingTarget === "multi"}
                onStartRecording={() => setRecordingTarget("multi")}
                onSetShortcut={(s) => {
                  setMultiShortcut(s);
                  setRecordingTarget(null);
                }}
                onCancelRecording={() => setRecordingTarget(null)}
              />
            </div>
          </div>
        )}

        {/* ── Macro ── */}
        {mode === "macro" && (
          <MacroMode
            actions={macroActions}
            setActions={setMacroActions}
            repeat={macroRepeat}
            setRepeat={setMacroRepeat}
            speed={macroSpeed}
            setSpeed={setMacroSpeed}
            shortcut={macroShortcut}
            isRecordingShortcut={recordingTarget === "macro"}
            onStartRecordingShortcut={() => setRecordingTarget("macro")}
            onSetShortcut={(s) => {
              setMacroShortcut(s);
              setRecordingTarget(null);
            }}
            onCancelRecordingShortcut={() => setRecordingTarget(null)}
            isPlaying={isPlayingMacro}
            onPlay={playMacro}
            onStop={stopMacro}
          />
        )}

        {/* ── action buttons: single / multi only ── */}
        {mode !== "macro" && (
          <div className="action-buttons">
            <button
              onClick={() => startClicking(mode as "single" | "multi")}
              disabled={mode === "single" ? isClickingSingle : isClickingMulti}
              className="action-button"
              style={{
                opacity: (mode === "single" ? isClickingSingle : isClickingMulti) ? 0.5 : 1,
                cursor: (mode === "single" ? isClickingSingle : isClickingMulti) ? "not-allowed" : "pointer",
              }}
            >
              <IconPlay /> START {mode.toUpperCase()}
            </button>

            <button
              onClick={stopClicking}
              disabled={mode === "single" ? !isClickingSingle : !isClickingMulti}
              className="action-button stop"
              style={{
                opacity: (mode === "single" ? !isClickingSingle : !isClickingMulti) ? 0.5 : 1,
                cursor: (mode === "single" ? !isClickingSingle : !isClickingMulti) ? "not-allowed" : "pointer",
              }}
            >
              <IconStop /> STOP CLICKING
            </button>
          </div>
        )}

        <div className="status-bar">
          <div className={`indicator ${isAnyActive ? "active" : ""}`} />
          <span>
            {isPlayingMacro
              ? "MACRO ACTIVE"
              : isClicking
              ? "SYSTEM ACTIVE"
              : "SYSTEM IDLE"}
          </span>
        </div>
      </div>
    </main>
  );
}

export default App;
