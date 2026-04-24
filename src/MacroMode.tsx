import { useState, useEffect, useRef } from "react";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { listen } from "@tauri-apps/api/event";
import { ShortcutBox } from "./components/ShortcutBox";
import {
  MacroAction,
  MacroActionType,
  SavedMacro,
  ACTION_TYPE_LABELS,
  SPEED_OPTIONS,
  makeAction,
} from "./types/macro";

const isTauri =
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

const STORAGE_KEY = "saved_macros";

// ─── small icon helpers ───────────────────────────────────────────────────────
const IconDrag = () => (
  <svg width="12" height="16" viewBox="0 0 12 16" fill="currentColor">
    <circle cx="4" cy="4" r="1.5" /><circle cx="8" cy="4" r="1.5" />
    <circle cx="4" cy="8" r="1.5" /><circle cx="8" cy="8" r="1.5" />
    <circle cx="4" cy="12" r="1.5" /><circle cx="8" cy="12" r="1.5" />
  </svg>
);
const IconPlus = () => (
  <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
    <path d="M7 2v10M2 7h10" />
  </svg>
);
const IconDuplicate = () => (
  <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="4" width="8" height="8" rx="1.5" />
    <path d="M2 10V2h8" />
  </svg>
);
const IconTrash = () => (
  <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 4h10M5 4V2h4v2M11 4l-.8 8H3.8L3 4" />
  </svg>
);
const IconPlay = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M8 5v14l11-7z" />
  </svg>
);
const IconStop = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <rect x="6" y="6" width="12" height="12" rx="2" />
  </svg>
);
const IconKeyboard = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M6 12h.01M18 12h.01M10 12h.01M14 12h.01M7 16h10" />
  </svg>
);
const IconSave = () => (
  <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 2h8l2 2v8a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V2z" />
    <path d="M9 2v4H5V2M5 8h4" />
  </svg>
);

// ─── type-badge colour map ─────────────────────────────────────────────────────
const TYPE_COLORS: Record<MacroActionType, { bg: string; color: string }> = {
  click:        { bg: "rgba(59,130,246,0.15)",  color: "#60a5fa" },
  right_click:  { bg: "rgba(236,72,153,0.15)",  color: "#f472b6" },
  double_click: { bg: "rgba(139,92,246,0.15)",  color: "#a78bfa" },
  scroll:       { bg: "rgba(16,185,129,0.15)",  color: "#34d399" },
  wait:         { bg: "rgba(245,158,11,0.15)",  color: "#fbbf24" },
  key:          { bg: "rgba(168,85,247,0.15)",  color: "#c084fc" },
};

// ─── single action row ────────────────────────────────────────────────────────
interface ActionRowProps {
  action: MacroAction;
  index: number;
  total: number;
  onChange: (id: string, patch: Partial<MacroAction>) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onDragStart: (index: number) => void;
  onDragOver: (index: number) => void;
  onDrop: () => void;
  isDragOver: boolean;
}

function ActionRow({
  action, index, onChange, onDuplicate, onDelete,
  onDragStart, onDragOver, onDrop, isDragOver,
}: ActionRowProps) {
  const col = TYPE_COLORS[action.type];
  const isPosition = ["click", "right_click", "double_click", "scroll"].includes(action.type);
  const isKey = action.type === "key";
  const isScroll = action.type === "scroll";
  const isWait = action.type === "wait";

  return (
    <div
      className={`macro-action-row${isDragOver ? " drag-over" : ""}`}
      onDragOver={(e) => { e.preventDefault(); onDragOver(index); }}
      onDrop={onDrop}
    >
      {/* drag handle */}
      <div
        className="action-drag-handle"
        draggable
        onDragStart={() => onDragStart(index)}
      >
        <IconDrag />
      </div>

      {/* number */}
      <span className="action-num">{index + 1}</span>

      {/* type selector */}
      <select
        className="action-type-select"
        value={action.type}
        style={{ background: col.bg, color: col.color, borderColor: "transparent" }}
        onChange={(e) =>
          onChange(action.id, { type: e.target.value as MacroActionType, x: 0, y: 0, key: "", direction: "down", amount: 3 })
        }
      >
        {(Object.entries(ACTION_TYPE_LABELS) as [MacroActionType, string][]).map(([val, lbl]) => (
          <option key={val} value={val}>{lbl}</option>
        ))}
      </select>

      {/* position fields */}
      {isPosition && !isScroll && (
        <div className="action-coord-group">
          <label className="action-coord-label">X</label>
          <input
            className="action-num-input"
            type="number"
            value={action.x ?? 0}
            onChange={(e) => onChange(action.id, { x: parseInt(e.target.value) || 0 })}
          />
          <label className="action-coord-label">Y</label>
          <input
            className="action-num-input"
            type="number"
            value={action.y ?? 0}
            onChange={(e) => onChange(action.id, { y: parseInt(e.target.value) || 0 })}
          />
        </div>
      )}

      {/* scroll fields */}
      {isScroll && (
        <div className="action-coord-group">
          <label className="action-coord-label">X</label>
          <input className="action-num-input" type="number" value={action.x ?? 0}
            onChange={(e) => onChange(action.id, { x: parseInt(e.target.value) || 0 })} />
          <label className="action-coord-label">Y</label>
          <input className="action-num-input" type="number" value={action.y ?? 0}
            onChange={(e) => onChange(action.id, { y: parseInt(e.target.value) || 0 })} />
          <select className="action-dir-select"
            value={action.direction ?? "down"}
            onChange={(e) => onChange(action.id, { direction: e.target.value as any })}>
            <option value="up">↑</option>
            <option value="down">↓</option>
            <option value="left">←</option>
            <option value="right">→</option>
          </select>
          <input className="action-num-input" style={{ width: 36 }} type="number" min={1} max={20}
            value={action.amount ?? 3}
            onChange={(e) => onChange(action.id, { amount: parseInt(e.target.value) || 1 })} />
        </div>
      )}

      {/* key field */}
      {isKey && (
        <div className="action-coord-group">
          <label className="action-coord-label">Key</label>
          <input
            className="action-key-input"
            value={action.key ?? ""}
            placeholder="e.g. Enter, Tab, a"
            onKeyDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (["Control", "Meta", "Alt", "Shift"].includes(e.key)) return;
              onChange(action.id, { key: e.key });
            }}
            onChange={() => {}} // controlled via onKeyDown
            readOnly
          />
        </div>
      )}

      {/* wait — no extra fields, delay_after is the duration */}
      {isWait && (
        <span className="action-wait-label">pause for →</span>
      )}

      {/* delay */}
      <div className="action-delay-group">
        <label className="action-coord-label">{isWait ? "ms" : "⏱"}</label>
        <input
          className="action-num-input action-delay-input"
          type="number"
          min={0}
          step={50}
          value={action.delay_after}
          onChange={(e) => onChange(action.id, { delay_after: parseInt(e.target.value) || 0 })}
        />
        {!isWait && <span className="action-unit">ms</span>}
      </div>

      {/* action buttons */}
      <div className="action-btns-inline">
        <button className="action-icon-btn dup" title="Duplicate" onClick={() => onDuplicate(action.id)}>
          <IconDuplicate />
        </button>
        <button className="action-icon-btn del" title="Delete" onClick={() => onDelete(action.id)}>
          <IconTrash />
        </button>
      </div>
    </div>
  );
}

// ─── MacroMode ─────────────────────────────────────────────────────────────────
export interface MacroModeProps {
  actions: MacroAction[];
  setActions: (a: MacroAction[]) => void;
  repeat: number;
  setRepeat: (r: number) => void;
  speed: number;
  setSpeed: (s: number) => void;
  shortcut: string;
  isRecordingShortcut: boolean;
  onStartRecordingShortcut: () => void;
  onSetShortcut: (s: string) => void;
  onCancelRecordingShortcut: () => void;
  isPlaying: boolean;
  onPlay: () => void;
  onStop: () => void;
}

export function MacroMode({
  actions, setActions,
  repeat, setRepeat,
  speed, setSpeed,
  shortcut,
  isRecordingShortcut, onStartRecordingShortcut, onSetShortcut, onCancelRecordingShortcut,
  isPlaying, onPlay, onStop,
}: MacroModeProps) {
  const [macroName, setMacroName] = useState("New Macro");
  const [isRecording, setIsRecording] = useState(false);
  const [savedMacros, setSavedMacros] = useState<SavedMacro[]>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); }
    catch { return []; }
  });
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const recorderWindowRef = useRef<WebviewWindow | null>(null);
  const unlistenRecordRef = useRef<(() => void) | null>(null);
  const unlistenStopRef = useRef<(() => void) | null>(null);

  // Persist saved macros to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(savedMacros));
  }, [savedMacros]);

  // Close add-menu when clicking outside
  useEffect(() => {
    const handler = () => setAddMenuOpen(false);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  // ── recording ──────────────────────────────────────────────────────────────
  async function startRecording() {
    if (!isTauri || isRecording) return;
    setIsRecording(true);

    // Listen for actions coming from the overlay
    const unlisten1 = await listen<Omit<MacroAction, "id">>(
      "macro-record-action",
      (event) => {
        const incoming = event.payload;
        const action: MacroAction = {
          ...incoming,
          id: Date.now().toString() + Math.random().toString(36).slice(2),
        };
        setActions([...actions, action]);
      },
    );

    // Listen for overlay closed
    const unlisten2 = await listen("macro-record-stop", () => {
      stopRecording(false);
    });

    unlistenRecordRef.current = unlisten1;
    unlistenStopRef.current = unlisten2;

    // Open the transparent recording overlay
    const recWin = new WebviewWindow("macro-recorder", {
      url: "index.html?recorder=1",
      width: window.screen.width || 1440,
      height: window.screen.height || 900,
      x: 0,
      y: 0,
      transparent: true,
      decorations: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      focus: true,
    });

    recorderWindowRef.current = recWin;

    recWin.once("tauri://error", () => stopRecording(true));
  }

  function stopRecording(closeWindow = true) {
    setIsRecording(false);
    unlistenRecordRef.current?.();
    unlistenStopRef.current?.();
    unlistenRecordRef.current = null;
    unlistenStopRef.current = null;
    if (closeWindow) {
      recorderWindowRef.current?.close().catch(() => {});
      recorderWindowRef.current = null;
    }
  }

  // Clean up on unmount
  useEffect(() => () => stopRecording(true), []);

  // ── action list management ─────────────────────────────────────────────────
  function addAction(type: MacroActionType) {
    setActions([...actions, makeAction(type)]);
    setAddMenuOpen(false);
  }

  function updateAction(id: string, patch: Partial<MacroAction>) {
    setActions(actions.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  }

  function duplicateAction(id: string) {
    const idx = actions.findIndex((a) => a.id === id);
    if (idx === -1) return;
    const copy = { ...actions[idx], id: Date.now().toString() + Math.random() };
    const next = [...actions];
    next.splice(idx + 1, 0, copy);
    setActions(next);
  }

  function deleteAction(id: string) {
    setActions(actions.filter((a) => a.id !== id));
  }

  function handleDrop() {
    if (draggedIndex === null || dragOverIndex === null || draggedIndex === dragOverIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }
    const next = [...actions];
    const [moved] = next.splice(draggedIndex, 1);
    next.splice(dragOverIndex, 0, moved);
    setActions(next);
    setDraggedIndex(null);
    setDragOverIndex(null);
  }

  // ── repeat helpers ─────────────────────────────────────────────────────────
  function adjustRepeat(delta: number) {
    if (repeat === -1 && delta > 0) { setRepeat(1); return; }
    if (repeat === 1 && delta < 0) { setRepeat(-1); return; }
    if (repeat !== -1) setRepeat(Math.max(1, repeat + delta));
  }

  // ── save / load ────────────────────────────────────────────────────────────
  function saveMacro() {
    const entry: SavedMacro = {
      id: Date.now().toString(),
      name: macroName.trim() || "Untitled",
      actions,
      repeat,
      speed,
      shortcut,
      createdAt: Date.now(),
    };
    setSavedMacros((prev) => [...prev, entry]);
  }

  function loadMacro(macro: SavedMacro) {
    setMacroName(macro.name);
    setActions(macro.actions);
    setRepeat(macro.repeat);
    setSpeed(macro.speed);
  }

  function deleteSavedMacro(id: string) {
    setSavedMacros((prev) => prev.filter((m) => m.id !== id));
  }

  // ─────────────────────────────────────────────────────────────────────────────
  const totalDelayMs = actions.reduce((sum, a) => sum + a.delay_after, 0);
  const estimatedSec = ((totalDelayMs / speed) / 1000).toFixed(1);

  return (
    <div className="macro-mode">
      {/* ── name + record ── */}
      <div className="macro-name-row">
        <input
          className="macro-name-input"
          value={macroName}
          onChange={(e) => setMacroName(e.target.value)}
          placeholder="Macro name…"
          disabled={isPlaying}
        />
        <button
          className={`macro-rec-btn${isRecording ? " recording" : ""}`}
          onClick={() => (isRecording ? stopRecording(true) : startRecording())}
          disabled={isPlaying || !isTauri}
          title={isTauri ? undefined : "Recording requires the desktop app"}
        >
          <div className="rec-dot" />
          {isRecording ? "STOP" : "REC"}
        </button>
      </div>

      {/* ── action list header ── */}
      <div className="macro-section-header">
        <div className="label-with-icon" style={{ margin: 0 }}>
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M1 4h12M1 8h12M1 12h12" />
          </svg>
          Actions
          {actions.length > 0 && (
            <span className="macro-count-badge">{actions.length}</span>
          )}
          {actions.length > 0 && (
            <span className="macro-count-badge" style={{ opacity: 0.6, fontSize: "0.6rem" }}>
              ~{estimatedSec}s
            </span>
          )}
        </div>

        {/* add-action dropdown */}
        <div style={{ position: "relative" }}>
          <button
            className="macro-add-action-btn"
            onClick={(e) => { e.stopPropagation(); setAddMenuOpen((o) => !o); }}
            disabled={isPlaying}
          >
            <IconPlus /> Add
          </button>
          {addMenuOpen && (
            <div className="macro-add-menu" onClick={(e) => e.stopPropagation()}>
              {(Object.keys(ACTION_TYPE_LABELS) as MacroActionType[]).map((t) => (
                <div
                  key={t}
                  className="macro-add-menu-item"
                  style={{ color: TYPE_COLORS[t].color }}
                  onClick={() => addAction(t)}
                >
                  {ACTION_TYPE_LABELS[t]}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── action list ── */}
      <div
        className="macro-action-list"
        onDragLeave={() => setDragOverIndex(null)}
      >
        {actions.length === 0 ? (
          <div className="macro-empty-state">
            Press REC to record actions, or click Add to add manually
          </div>
        ) : (
          actions.map((action, index) => (
            <ActionRow
              key={action.id}
              action={action}
              index={index}
              total={actions.length}
              onChange={updateAction}
              onDuplicate={duplicateAction}
              onDelete={deleteAction}
              onDragStart={setDraggedIndex}
              onDragOver={setDragOverIndex}
              onDrop={handleDrop}
              isDragOver={dragOverIndex === index && draggedIndex !== index}
            />
          ))
        )}
      </div>

      {/* ── playback settings ── */}
      <div className="macro-settings-row">
        {/* repeat */}
        <div className="macro-setting-box">
          <div className="macro-setting-label">REPEAT</div>
          <div className="macro-stepper">
            <button className="stepper-btn" onClick={() => adjustRepeat(-1)}>−</button>
            <div className="stepper-val">
              <div className="stepper-num">{repeat === -1 ? "∞" : repeat}</div>
              <div className="stepper-unit">TIMES</div>
            </div>
            <button className="stepper-btn" onClick={() => adjustRepeat(1)}>+</button>
          </div>
        </div>

        {/* speed */}
        <div className="macro-setting-box">
          <div className="macro-setting-label">SPEED</div>
          <div className="macro-speed-pills">
            {SPEED_OPTIONS.map((s) => (
              <button
                key={s}
                className={`speed-pill${speed === s ? " active" : ""}`}
                onClick={() => setSpeed(s)}
              >
                {s}×
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── shortcut ── */}
      <div className="input-group" style={{ gap: "0.4rem" }}>
        <div className="label-with-icon">
          <IconKeyboard /> Shortcut
        </div>
        <ShortcutBox
          shortcut={shortcut}
          isRecording={isRecordingShortcut}
          onStartRecording={onStartRecordingShortcut}
          onSetShortcut={onSetShortcut}
          onCancelRecording={onCancelRecordingShortcut}
        />
      </div>

      {/* ── play / stop ── */}
      <div style={{ display: "flex", gap: "0.75rem" }}>
        <button
          className="action-button"
          onClick={onPlay}
          disabled={isPlaying || actions.length === 0}
          style={{ opacity: isPlaying || actions.length === 0 ? 0.5 : 1 }}
        >
          <IconPlay /> PLAY MACRO
        </button>
        <button
          className="action-button stop"
          onClick={onStop}
          disabled={!isPlaying}
          style={{ opacity: !isPlaying ? 0.5 : 1 }}
        >
          <IconStop /> STOP
        </button>
      </div>

      {/* ── saved macros ── */}
      <div className="macro-saved-section">
        <div className="macro-section-header">
          <div className="label-with-icon" style={{ margin: 0 }}>
            <IconSave /> Saved macros
            {savedMacros.length > 0 && (
              <span className="macro-count-badge">{savedMacros.length}</span>
            )}
          </div>
          <button
            className="macro-save-btn"
            onClick={saveMacro}
            disabled={actions.length === 0}
            title="Save current actions as a macro"
          >
            + Save
          </button>
        </div>

        {savedMacros.length === 0 ? (
          <div className="macro-empty-state" style={{ padding: "0.6rem" }}>
            No saved macros yet
          </div>
        ) : (
          <div className="macro-saved-list">
            {savedMacros.map((m) => (
              <div key={m.id} className="macro-saved-item">
                <div className="macro-saved-info" onClick={() => loadMacro(m)}>
                  <div className="macro-saved-name">{m.name}</div>
                  <div className="macro-saved-meta">
                    {m.actions.length} actions · {m.repeat === -1 ? "∞" : m.repeat}× ·{" "}
                    {m.speed}× speed
                  </div>
                </div>
                <div className="macro-saved-btns">
                  <button
                    className="macro-saved-play"
                    title="Load and play"
                    onClick={() => { loadMacro(m); setTimeout(onPlay, 50); }}
                    disabled={isPlaying}
                  >
                    <IconPlay />
                  </button>
                  <button
                    className="macro-saved-del"
                    title="Delete"
                    onClick={() => deleteSavedMacro(m.id)}
                  >
                    <IconTrash />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
