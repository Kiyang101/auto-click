import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { register, unregisterAll } from "@tauri-apps/plugin-global-shortcut";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { PointOverlay } from "./PointOverlay";
import "./App.css";
import "./Point.css";

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

interface Point {
  id: string;
  interval: number;
}

function App() {
  const urlParams = new URLSearchParams(window.location.search);
  const pointId = urlParams.get('point');

  if (pointId) {
    return <PointOverlay id={pointId} />;
  }

  const [mode, setMode] = useState<"single" | "multi">("single");
  const [intervalMs, setIntervalMs] = useState<number>(1000);
  const [isClicking, setIsClicking] = useState<boolean>(false);
  const [hasPermission, setHasPermission] = useState<boolean>(true);
  
  // Separate shortcuts
  const [singleShortcut, setSingleShortcut] = useState<string>(() => localStorage.getItem("singleShortcut") || "CommandOrControl+Shift+A");
  const [multiShortcut, setMultiShortcut] = useState<string>(() => localStorage.getItem("multiShortcut") || "CommandOrControl+Shift+S");
  
  const [recordingTarget, setRecordingTarget] = useState<"single" | "multi" | null>(null);

  const [points, setPoints] = useState<Point[]>([]);
  const [pointsVisible, setPointsVisible] = useState(true);

  const stateRef = useRef({ isClicking, intervalMs, points });

  useEffect(() => {
    stateRef.current = { isClicking, intervalMs, points };
  }, [isClicking, intervalMs, points]);

  useEffect(() => {
    if (isTauri) checkPermission();
  }, []);

  useEffect(() => {
    if (!isTauri) return;

    async function setupShortcuts() {
      try {
        await unregisterAll(); 
        
        // If we are currently recording a new shortcut, DO NOT register the old ones
        // This prevents the clicker from starting while the user is typing
        if (recordingTarget !== null) {
          return;
        }
        
        // Register Single Shortcut
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
                } catch (error) {
                  console.error("Failed single click:", error);
                }
              }
            }
          });
          localStorage.setItem("singleShortcut", singleShortcut);
        }

        // Register Multi Shortcut
        if (multiShortcut && multiShortcut !== singleShortcut) {
          await register(multiShortcut, async (event) => {
            if (event.state === "Pressed") {
              const current = stateRef.current;
              if (current.isClicking) {
                await invoke("stop_clicking");
                // Restore clickability to targets
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
                        const pos = await win.outerPosition();
                        const factor = await win.scaleFactor();
                        // Convert physical pixels to logical points to fix the warping bug on Retina displays
                        const logicalX = pos.x / factor;
                        const logicalY = pos.y / factor;
                        return { id: p.id, x: Math.round(logicalX + 25), y: Math.round(logicalY + 25), interval: p.interval };
                      }
                      return null;
                    })
                  );
                  const validPoints = pointsConfig.filter(p => p !== null);
                  if (validPoints.length > 0) {
                    await invoke("start_multi_clicking", { points: validPoints });
                    setIsClicking(true);
                  }
                } catch (error) {
                  console.error("Failed multi click:", error);
                }
              }
            }
          });
          localStorage.setItem("multiShortcut", multiShortcut);
        }
      } catch (err) {
        console.error("Failed to register shortcuts:", err);
      }
    }

    setupShortcuts();

    return () => {
      if (isTauri) unregisterAll().catch(console.error);
    };
  }, [singleShortcut, multiShortcut]);

  async function checkPermission() {
    try {
      const permission = await invoke<boolean>("check_permissions");
      setHasPermission(permission);
    } catch (e) {
      console.error(e);
    }
  }

  async function toggleClicking(targetMode: "single" | "multi") {
    if (!isTauri) return;

    if (isClicking) {
      await invoke("stop_clicking");
      // Restore clickability to targets
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
           // Make targets click-through so the simulated clicks hit what is UNDER them
           const pointsConfig = await Promise.all(
             points.map(async (p) => {
               const win = await WebviewWindow.getByLabel(`point-${p.id}`);
               if (win) {
                 await win.setIgnoreCursorEvents(true);
                 const pos = await win.outerPosition();
                 const factor = await win.scaleFactor();
                 // Convert physical pixels to logical points to fix the warping bug on Retina displays
                 const logicalX = pos.x / factor;
                 const logicalY = pos.y / factor;
                 return { id: p.id, x: Math.round(logicalX + 25), y: Math.round(logicalY + 25), interval: p.interval };
               }
               return null;
             })
           );
           const validPoints = pointsConfig.filter(p => p !== null);
           if (validPoints.length === 0) {
              console.warn("No valid targets to click.");
              return;
           }
           await invoke("start_multi_clicking", { points: validPoints });
        }
        setIsClicking(true);
      } catch (error) {
        console.error(error);
      }
    }
  }

  async function addPoint() {
    if (!isTauri) return;
    const id = Date.now().toString();
    
    const webview = new WebviewWindow(`point-${id}`, {
      url: `index.html?point=${id}`,
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
      setPoints([...points, { id, interval: 1000 }]);
    });
  }

  async function removePoint(id: string) {
    if (!isTauri) return;
    const win = await WebviewWindow.getByLabel(`point-${id}`);
    if (win) {
      await win.close();
    }
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

  const handleShortcutRecord = (e: React.KeyboardEvent<HTMLInputElement>, target: "single" | "multi") => {
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
      (e.target as HTMLInputElement).blur();
    }
  };

  return (
    <main className="container">
      <div className="card" style={{ maxWidth: mode === 'multi' ? '500px' : '400px' }}>
        <h1>Auto Clicker</h1>
        
        {!hasPermission && isTauri && (
          <div style={{ color: "#ef4444", marginBottom: "1rem", fontSize: "0.875rem" }}>
            ⚠️ Please grant Accessibility permissions in System Settings.
          </div>
        )}

        <div className="tabs">
          <div className={`tab ${mode === 'single' ? 'active' : ''}`} onClick={() => setMode('single')}>Single Target</div>
          <div className={`tab ${mode === 'multi' ? 'active' : ''}`} onClick={() => setMode('multi')}>Multiple Targets</div>
        </div>

        {mode === 'single' ? (
          <div>
            <div className="input-group">
              <label htmlFor="interval">Click Interval (ms)</label>
              <input
                id="interval"
                type="number"
                value={intervalMs}
                onChange={(e) => setIntervalMs(Math.max(10, parseInt(e.target.value) || 0))}
                disabled={isClicking}
              />
            </div>
            <div className="input-group">
              <label htmlFor="single-shortcut">Single Mode Shortcut</label>
              <input
                id="single-shortcut"
                type="text"
                readOnly
                value={recordingTarget === "single" ? "Recording..." : singleShortcut.replace("CommandOrControl", "Cmd/Ctrl")}
                onClick={() => setRecordingTarget("single")}
                onKeyDown={(e) => handleShortcutRecord(e, "single")}
                onBlur={() => setRecordingTarget(null)}
                style={{ cursor: "pointer", textAlign: "center", fontWeight: "bold", borderColor: recordingTarget === "single" ? "#3b82f6" : undefined }}
              />
            </div>
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="add-point-btn" onClick={addPoint} disabled={isClicking}>+ Add Target</button>
              <button className="hide-btn" onClick={togglePointsVisibility}>
                {pointsVisible ? 'Hide Targets' : 'Show Targets'}
              </button>
            </div>
            
            <div className="point-list">
              {points.length === 0 && <div style={{ color: '#94a3b8', fontSize: '0.875rem', textAlign: 'center' }}>No targets added.</div>}
              {points.map((p, index) => (
                <div key={p.id} className="point-item">
                  <span>Target {index + 1}</span>
                  <div>
                    <label style={{ display: 'inline', marginRight: '0.5rem', fontWeight: 'normal' }}>Interval (ms):</label>
                    <input 
                      type="number" 
                      value={p.interval} 
                      disabled={isClicking}
                      onChange={(e) => {
                        const newPoints = [...points];
                        newPoints[index].interval = Math.max(10, parseInt(e.target.value) || 0);
                        setPoints(newPoints);
                      }}
                    />
                    <button style={{ width: 'auto', padding: '0.25rem 0.5rem', marginLeft: '0.5rem', backgroundColor: '#ef4444' }} onClick={() => removePoint(p.id)} disabled={isClicking}>X</button>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="input-group">
              <label htmlFor="multi-shortcut">Multi Mode Shortcut</label>
              <input
                id="multi-shortcut"
                type="text"
                readOnly
                value={recordingTarget === "multi" ? "Recording..." : multiShortcut.replace("CommandOrControl", "Cmd/Ctrl")}
                onClick={() => setRecordingTarget("multi")}
                onKeyDown={(e) => handleShortcutRecord(e, "multi")}
                onBlur={() => setRecordingTarget(null)}
                style={{ cursor: "pointer", textAlign: "center", fontWeight: "bold", borderColor: recordingTarget === "multi" ? "#3b82f6" : undefined }}
              />
            </div>
          </div>
        )}

        <button onClick={() => toggleClicking(mode)} className={isClicking ? "stop" : ""}>
          {isClicking ? "Stop Clicking" : `Start ${mode === 'single' ? 'Single' : 'Multi'}`}
        </button>

        <div className="status">
          <div className={`dot ${isClicking ? "active" : ""}`}></div>
          <span>{isClicking ? "Clicking Active" : "Idle"}</span>
        </div>
      </div>
    </main>
  );
}

export default App;
