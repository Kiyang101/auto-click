import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { register, unregisterAll } from "@tauri-apps/plugin-global-shortcut";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { emit } from "@tauri-apps/api/event";
import { PointOverlay } from "./PointOverlay";
import "./App.css";
import "./Point.css";

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

interface Point {
  id: string;
  interval: number;
}

// --- Icons ---
const IconPlay = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>;
const IconStop = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>;
const IconPlus = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
const IconEye = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>;
const IconEyeOff = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>;
const IconClock = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;
const IconKeyboard = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M6 8h.01"/><path d="M10 8h.01"/><path d="M14 8h.01"/><path d="M18 8h.01"/><path d="M6 12h.01"/><path d="M18 12h.01"/><path d="M10 12h.01"/><path d="M14 12h.01"/><path d="M7 16h10"/></svg>;
const IconTarget = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/><line x1="12" y1="2" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="2" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="22" y2="12"/></svg>;

const TimeSelector = ({ value, onChange, disabled }: { value: number; onChange: (val: number) => void; disabled?: boolean }) => {
  const h = Math.floor(value / 3600000);
  const m = Math.floor((value % 3600000) / 60000);
  const s = Math.floor((value % 60000) / 1000);
  const ms = value % 1000;

  const update = (newH: number, newM: number, newS: number, newMs: number) => {
    const total = (newH * 3600000) + (newM * 60000) + (newS * 1000) + newMs;
    onChange(Math.max(1, total));
  };

  return (
    <div className="time-selector">
      <div className="time-field">
        <input type="number" value={h} onChange={e => update(parseInt(e.target.value) || 0, m, s, ms)} disabled={disabled} min={0} />
        <label>HRS</label>
      </div>
      <div className="time-field">
        <input type="number" value={m} onChange={e => update(h, parseInt(e.target.value) || 0, s, ms)} disabled={disabled} min={0} max={59} />
        <label>MIN</label>
      </div>
      <div className="time-field">
        <input type="number" value={s} onChange={e => update(h, m, parseInt(e.target.value) || 0, ms)} disabled={disabled} min={0} max={59} />
        <label>SEC</label>
      </div>
      <div className="time-field">
        <input type="number" value={ms} onChange={e => update(h, m, s, parseInt(e.target.value) || 0)} disabled={disabled} min={0} max={999} />
        <label>MS</label>
      </div>
    </div>
  );
};

function App() {
  const urlParams = new URLSearchParams(window.location.search);
  const pointId = urlParams.get('point');

  if (pointId) {
    return <PointOverlay id={pointId} />;
  }

  const [mode, setMode] = useState<"single" | "multi">("single");
  const [intervalMs, setIntervalMs] = useState<number>(100);
  const [isClicking, setIsClicking] = useState<boolean>(false);
  const [hasPermission, setHasPermission] = useState<boolean>(true);

  const [singleShortcut, setSingleShortcut] = useState<string>(() => localStorage.getItem("singleShortcut") || "Control+Shift+A");
  const [multiShortcut, setMultiShortcut] = useState<string>(() => localStorage.getItem("multiShortcut") || "Control+Shift+S");

  const [recordingTarget, setRecordingTarget] = useState<"single" | "multi" | null>(null);

  const [points, setPoints] = useState<Point[]>([]);
  const [pointsVisible, setPointsVisible] = useState(true);
  const pointListRef = useRef<HTMLDivElement>(null);

  const stateRef = useRef({ isClicking, intervalMs, points });

  useEffect(() => {
    stateRef.current = { isClicking, intervalMs, points };
    const syncIndices = async () => {
      await emit('update-indices', {
        mapping: points.reduce((acc, p, idx) => ({ ...acc, [p.id]: idx + 1 }), {})
      });
    };
    syncIndices();

    if (pointListRef.current) {
      pointListRef.current.scrollTop = pointListRef.current.scrollHeight;
    }
  }, [isClicking, intervalMs, points]);

  useEffect(() => {
    if (isTauri) checkPermission();
  }, []);

  useEffect(() => {
    if (!isTauri) return;

    async function setupShortcuts() {
      try {
        await unregisterAll();
        if (recordingTarget !== null) return;

        if (singleShortcut) {
          await register(singleShortcut, async (event) => {
            if (event.state === "Pressed") {
              const current = stateRef.current;
              if (current.isClicking) {
                await invoke("stop_clicking");
                setIsClicking(false);
              } else {
                try {
                  await invoke("start_clicking", { intervalMs: current.intervalMs });
                  setIsClicking(true);
                } catch (error) { console.error(error); }
              }
            }
          });
          localStorage.setItem("singleShortcut", singleShortcut);
        }

        if (multiShortcut && multiShortcut !== singleShortcut) {
          await register(multiShortcut, async (event) => {
            if (event.state === "Pressed") {
              const current = stateRef.current;
              if (current.isClicking) {
                await invoke("stop_clicking");
                for (const p of current.points) {
                  const win = await WebviewWindow.getByLabel(`point-${p.id}`);
                  if (win) await win.setIgnoreCursorEvents(false);
                }
                setIsClicking(false);
              } else {
                try {
                  const pointsConfig = await Promise.all(
                    current.points.map(async (p) => {
                      const win = await WebviewWindow.getByLabel(`point-${p.id}`);
                      if (win) {
                        await win.setIgnoreCursorEvents(true);
                        const pos = await win.innerPosition();
                        const size = await win.innerSize();
                        const factor = await win.scaleFactor();
                        const isMac = navigator.userAgent.includes("Mac");
                        const x = isMac ? (pos.x + size.width / 2) / factor : (pos.x + size.width / 2);
                        const y = isMac ? (pos.y + size.height / 2) / factor : (pos.y + size.height / 2);
                        return { id: p.id, x: Math.round(x), y: Math.round(y), interval: p.interval };
                      }
                      return null;
                    })
                  );
                  const validPoints = pointsConfig.filter(p => p !== null);
                  if (validPoints.length > 0) {
                    await invoke("start_multi_clicking", { points: validPoints });
                    setIsClicking(true);
                  }
                } catch (error) { console.error(error); }
              }
            }
          });
          localStorage.setItem("multiShortcut", multiShortcut);
        }
      } catch (err) { console.error(err); }
    }

    setupShortcuts();
    return () => { if (isTauri) unregisterAll().catch(console.error); };
  }, [singleShortcut, multiShortcut, recordingTarget]);

  async function checkPermission() {
    try {
      const permission = await invoke<boolean>("check_permissions");
      setHasPermission(permission);
    } catch (e) { console.error(e); }
  }

  async function toggleClicking(targetMode: "single" | "multi") {
    if (!isTauri) return;

    if (isClicking) {
      await invoke("stop_clicking");
      for (const p of points) {
        const win = await WebviewWindow.getByLabel(`point-${p.id}`);
        if (win) await win.setIgnoreCursorEvents(false);
      }
      setIsClicking(false);
    } else {
      try {
        if (targetMode === "single") {
          await invoke("start_clicking", { intervalMs });
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
                const x = isMac ? (pos.x + size.width / 2) / factor : (pos.x + size.width / 2);
                const y = isMac ? (pos.y + size.height / 2) / factor : (pos.y + size.height / 2);
                return { id: p.id, x: Math.round(x), y: Math.round(y), interval: p.interval };
              }
              return null;
            })
          );
          const validPoints = pointsConfig.filter(p => p !== null);
          if (validPoints.length === 0) return;
          await invoke("start_multi_clicking", { points: validPoints });
        }
        setIsClicking(true);
      } catch (error) { console.error(error); }
    }
  }

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
      center: true
    });

    webview.once('tauri://created', function () {
      setPoints([...points, { id, interval: 100 }]);
    });
  }

  async function removePoint(id: string) {
    if (!isTauri) return;
    const win = await WebviewWindow.getByLabel(`point-${id}`);
    if (win) await win.close();
    setPoints(points.filter(p => p.id !== id));
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

  const handleShortcutRecord = (e: React.KeyboardEvent<HTMLDivElement>, target: "single" | "multi") => {
    e.preventDefault();
    if (recordingTarget !== target) return;

    const keys: string[] = [];
    if (e.metaKey) keys.push("Command");
    if (e.ctrlKey) keys.push("Control");
    if (e.altKey) keys.push("Alt");
    if (e.shiftKey) keys.push("Shift");

    const key = e.key;
    const isModifier = ["Control", "Meta", "Shift", "Alt"].includes(key);

    if (!isModifier) {
      let keyName = key.toUpperCase();
      const keyMap: Record<string, string> = { " ": "Space", "ARROWUP": "Up", "ARROWDOWN": "Down", "ARROWLEFT": "Left", "ARROWRIGHT": "Right" };
      if (keyMap[keyName]) keyName = keyMap[keyName];

      keys.push(keyName);
      const newShortcut = keys.join("+");

      if (target === "single") setSingleShortcut(newShortcut);
      else setMultiShortcut(newShortcut);

      setRecordingTarget(null);
    }
  };

  return (
    <main className="container">
      <div className="card">
        <h1>AUTO CLICKER PRO</h1>

        {!hasPermission && isTauri && (
          <div style={{ color: "var(--accent-rose)", marginBottom: "0.5rem", fontSize: "0.7rem", textAlign: "center", fontWeight: 600 }}>
            ⚠️ Accessibility permission required
          </div>
        )}

        <div className="tabs">
          <div className={`tab ${mode === 'single' ? 'active' : ''}`} onClick={() => setMode('single')}>Single</div>
          <div className={`tab ${mode === 'multi' ? 'active' : ''}`} onClick={() => setMode('multi')}>Multiple</div>
        </div>

        {mode === 'single' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div className="input-group">
              <div className="label-with-icon"><IconClock /> Click Interval</div>
              <TimeSelector value={intervalMs} onChange={setIntervalMs} disabled={isClicking} />
            </div>
            <div className="input-group">
              <div className="label-with-icon"><IconKeyboard /> Start/Stop Shortcut</div>
              <div
                className={`shortcut-box ${recordingTarget === "single" ? "recording" : ""}`}
                onClick={() => setRecordingTarget("single")}
                tabIndex={0}
                onKeyDown={(e) => handleShortcutRecord(e, "single")}
                onBlur={() => setRecordingTarget(null)}
              >
                {recordingTarget === "single" ? (
                  <span style={{ color: 'var(--accent-rose)', fontWeight: 700, fontSize: '0.8rem' }}>RECORDING...</span>
                ) : (
                  <div className="keys">
                    {singleShortcut.replace("CommandOrControl", "Ctrl").split("+").map((key, i) => (
                      <kbd key={i}>{key}</kbd>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div className="secondary-actions">
              <button className="add-point-btn" onClick={addPoint} disabled={isClicking}>
                <IconPlus /> Add Target
              </button>
              <button className="icon-btn" onClick={togglePointsVisibility} title="Toggle Visibility">
                {pointsVisible ? <IconEye /> : <IconEyeOff />}
              </button>
            </div>

            <div className="point-list" ref={pointListRef}>
              {points.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center', padding: '1rem' }}>No targets added.</div>}
              {points.map((p, index) => (
                <div
                  key={p.id}
                  className="point-item"
                  onMouseEnter={() => emit('highlight-point', { id: p.id, active: true })}
                  onMouseLeave={() => emit('highlight-point', { id: p.id, active: false })}
                >
                  <div className="point-item-header">
                    <span><IconTarget /> Target {index + 1}</span>
                    <button className="delete-btn" onClick={() => removePoint(p.id)} disabled={isClicking}>DELETE</button>
                  </div>
                  <TimeSelector
                    value={p.interval}
                    onChange={(newVal) => {
                      const newPoints = [...points];
                      newPoints[index].interval = newVal;
                      setPoints(newPoints);
                    }}
                    disabled={isClicking}
                  />
                </div>
              ))}
            </div>

            <div className="input-group">
              <div className="label-with-icon"><IconKeyboard /> Multi Start/Stop</div>
              <div
                className={`shortcut-box ${recordingTarget === "multi" ? "recording" : ""}`}
                onClick={() => setRecordingTarget("multi")}
                tabIndex={0}
                onKeyDown={(e) => handleShortcutRecord(e, "multi")}
                onBlur={() => setRecordingTarget(null)}
              >
                {recordingTarget === "multi" ? (
                  <span style={{ color: 'var(--accent-rose)', fontWeight: 700, fontSize: '0.8rem' }}>RECORDING...</span>
                ) : (
                  <div className="keys">
                    {multiShortcut.replace("CommandOrControl", "Ctrl").split("+").map((key, i) => (
                      <kbd key={i}>{key}</kbd>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <button onClick={() => toggleClicking(mode)} className={`action-button ${isClicking ? "stop" : ""}`}>
          {isClicking ? <><IconStop /> STOP CLICKING</> : <><IconPlay /> START {mode.toUpperCase()}</>}
        </button>

        <div className="status-bar">
          <div className={`indicator ${isClicking ? "active" : ""}`}></div>
          <span>{isClicking ? "SYSTEM ACTIVE" : "SYSTEM IDLE"}</span>
        </div>
      </div>
    </main>
  );
}

export default App;
