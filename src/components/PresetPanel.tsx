import { useState, useEffect } from "react";
import { MacroAction, SavedMacro } from "../types/macro";

const STORAGE_KEY = "saved_macros";

const IconPlay = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
    <path d="M8 5v14l11-7z" />
  </svg>
);

const IconSave = () => (
  <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 2h8l2 2v8a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V2z" />
    <path d="M9 2v4H5V2M5 8h4" />
  </svg>
);

const IconTrash = () => (
  <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 4h10M5 4V2h4v2M11 4l-.8 8H3.8L3 4" />
  </svg>
);

export interface PresetPanelProps {
  actions: MacroAction[];
  repeat: number;
  speed: number;
  shortcut: string;
  isPlaying: boolean;
  onLoad: (preset: SavedMacro) => void;
  onPlay: () => void;
}

function validatePresets(data: unknown): SavedMacro[] {
  if (!Array.isArray(data)) return [];
  return data.filter(
    (item): item is SavedMacro =>
      typeof item === "object" &&
      item !== null &&
      typeof (item as Record<string, unknown>).id === "string" &&
      typeof (item as Record<string, unknown>).name === "string" &&
      Array.isArray((item as Record<string, unknown>).actions),
  );
}

export function PresetPanel({
  actions, repeat, speed, shortcut, isPlaying, onLoad, onPlay,
}: PresetPanelProps) {
  const [presets, setPresets] = useState<SavedMacro[]>(() => {
    try {
      return validatePresets(JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"));
    } catch {
      return [];
    }
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState("New Macro");

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
  }, [presets]);

  useEffect(() => {
    if (selectedId && !presets.find((p) => p.id === selectedId)) {
      setSelectedId(null);
    }
  }, [presets, selectedId]);

  function savePreset() {
    if (actions.length === 0) return;
    const entry: SavedMacro = {
      id: Date.now().toString(),
      name: name.trim() || "Untitled",
      actions,
      repeat,
      speed,
      shortcut,
      createdAt: Date.now(),
    };
    setPresets((prev) => [...prev, entry]);
    setSelectedId(entry.id);
  }

  function deletePreset(id: string) {
    setPresets((prev) => prev.filter((p) => p.id !== id));
  }

  const selected = presets.find((p) => p.id === selectedId) ?? null;

  return (
    <div className="preset-panel">
      <div className="label-with-icon no-margin">
        <IconSave /> Presets
        {presets.length > 0 && (
          <span className="macro-count-badge">{presets.length}</span>
        )}
      </div>

      <div className="preset-save-row">
        <input
          className="preset-name-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Preset name…"
        />
        <button
          type="button"
          className="macro-add-action-btn"
          onClick={savePreset}
          disabled={actions.length === 0}
          title="Save current actions as a preset"
        >
          + Save
        </button>
      </div>

      {presets.length === 0 ? (
        <div className="macro-empty-state padded">No saved presets yet</div>
      ) : (
        <div className="preset-body">
          <div className="preset-sidebar">
            {presets.map((p) => (
              <div
                key={p.id}
                className={`preset-sidebar-item${selectedId === p.id ? " active" : ""}`}
                onClick={() => setSelectedId(p.id)}
                title={p.name}
              >
                {p.name}
              </div>
            ))}
          </div>

          <div className="preset-detail">
            {selected ? (
              <>
                <div className="preset-detail-name">{selected.name}</div>
                <div className="preset-detail-meta">
                  {selected.actions.length} actions<br />
                  Repeat: {selected.repeat === -1 ? "∞" : selected.repeat}× · Speed: {selected.speed}×
                  {selected.shortcut && <><br />Shortcut: {selected.shortcut}</>}
                </div>
                <div className="preset-detail-actions">
                  <button
                    type="button"
                    className="preset-detail-btn"
                    onClick={() => { onLoad(selected); setTimeout(onPlay, 50); }}
                    disabled={isPlaying}
                  >
                    <IconPlay /> Play
                  </button>
                  <button
                    type="button"
                    className="preset-detail-btn load"
                    onClick={() => onLoad(selected)}
                  >
                    Load
                  </button>
                  <button
                    type="button"
                    className="preset-detail-btn del"
                    onClick={() => deletePreset(selected.id)}
                  >
                    <IconTrash />
                  </button>
                </div>
              </>
            ) : (
              <div className="preset-detail-empty">Select a preset to see details</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
