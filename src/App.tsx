import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { register, unregisterAll } from "@tauri-apps/plugin-global-shortcut";
import "./App.css";

function App() {
  const [intervalMs, setIntervalMs] = useState<number>(1000);
  const [isClicking, setIsClicking] = useState<boolean>(false);
  const [hasPermission, setHasPermission] = useState<boolean>(true);
  
  // Custom shortcut state
  const [shortcut, setShortcut] = useState<string>(() => localStorage.getItem("shortcut") || "CommandOrControl+Shift+A");
  const [isRecording, setIsRecording] = useState<boolean>(false);

  // Use a ref to access the latest state within the shortcut handler
  const stateRef = useRef({ isClicking, intervalMs });

  useEffect(() => {
    stateRef.current = { isClicking, intervalMs };
  }, [isClicking, intervalMs]);

  useEffect(() => {
    checkPermission();
  }, []);

  useEffect(() => {
    async function setupShortcut() {
      try {
        await unregisterAll(); 
        
        if (!shortcut) return;

        await register(shortcut, async (event) => {
          if (event.state === "Pressed") {
            const { isClicking: currentIsClicking, intervalMs: currentInterval } = stateRef.current;
            
            if (currentIsClicking) {
              await invoke("stop_clicking");
              setIsClicking(false);
            } else {
              try {
                await invoke("start_clicking", { intervalMs: currentInterval });
                setIsClicking(true);
              } catch (error) {
                console.error("Failed to start clicking:", error);
              }
            }
          }
        });
        localStorage.setItem("shortcut", shortcut);
      } catch (err) {
        console.error("Failed to register shortcut:", err);
      }
    }

    setupShortcut();

    return () => {
      // Cleanup on unmount or shortcut change
      unregisterAll().catch(console.error);
    };
  }, [shortcut]);

  async function checkPermission() {
    const permission = await invoke<boolean>("check_permissions");
    setHasPermission(permission);
  }

  async function toggleClicking() {
    if (isClicking) {
      await invoke("stop_clicking");
      setIsClicking(false);
    } else {
      try {
        await invoke("start_clicking", { intervalMs });
        setIsClicking(true);
      } catch (error) {
        console.error("Failed to start clicking:", error);
      }
    }
  }

  const handleShortcutRecord = (e: React.KeyboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (!isRecording) return;

    const keys: string[] = [];
    if (e.metaKey) keys.push("Command");
    if (e.ctrlKey) keys.push("Control");
    if (e.altKey) keys.push("Alt");
    if (e.shiftKey) keys.push("Shift");

    const key = e.key;
    const isModifier = ["Control", "Meta", "Shift", "Alt"].includes(key);

    if (!isModifier) {
      let keyName = key.toUpperCase();
      
      // Map common special keys
      const keyMap: Record<string, string> = {
        " ": "Space",
        "ARROWUP": "Up",
        "ARROWDOWN": "Down",
        "ARROWLEFT": "Left",
        "ARROWRIGHT": "Right"
      };
      
      if (keyMap[keyName]) {
        keyName = keyMap[keyName];
      }

      keys.push(keyName);
      const newShortcut = keys.join("+");
      setShortcut(newShortcut);
      setIsRecording(false);
      (e.target as HTMLInputElement).blur();
    }
  };

  return (
    <main className="container">
      <div className="card">
        <h1>Auto Clicker</h1>
        
        {!hasPermission && (
          <div style={{ color: "#ef4444", marginBottom: "1rem", fontSize: "0.875rem" }}>
            ⚠️ Please grant Accessibility permissions in System Settings.
          </div>
        )}

        <div className="input-group">
          <label htmlFor="shortcut">Toggle Shortcut</label>
          <input
            id="shortcut"
            type="text"
            readOnly
            value={isRecording ? "Recording... (Press any key combo)" : shortcut.replace("CommandOrControl", "Cmd/Ctrl")}
            onClick={() => setIsRecording(true)}
            onKeyDown={handleShortcutRecord}
            onBlur={() => setIsRecording(false)}
            style={{ 
              cursor: "pointer", 
              textAlign: "center", 
              fontWeight: "bold",
              borderColor: isRecording ? "#3b82f6" : undefined,
              backgroundColor: isRecording ? "#eff6ff" : undefined
            }}
          />
        </div>

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

        <button 
          onClick={toggleClicking} 
          className={isClicking ? "stop" : ""}
        >
          {isClicking ? "Stop Clicking" : "Start Clicking"}
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
