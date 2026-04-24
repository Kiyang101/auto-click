import { type Dispatch, type SetStateAction } from "react";
import { ShortcutBox } from "./components/ShortcutBox";
import { ActionList } from "./components/ActionList";
import { PresetPanel } from "./components/PresetPanel";
import {
  MacroAction,
  SavedMacro,
  SPEED_OPTIONS,
} from "./types/macro";

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

export interface MacroModeProps {
  actions: MacroAction[];
  setActions: Dispatch<SetStateAction<MacroAction[]>>;
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
  function adjustRepeat(delta: number) {
    if (repeat === -1 && delta > 0) { setRepeat(1); return; }
    if (repeat === 1 && delta < 0) { setRepeat(-1); return; }
    if (repeat !== -1) setRepeat(Math.max(1, repeat + delta));
  }

  function handleLoad(preset: SavedMacro) {
    setActions(preset.actions);
    setRepeat(preset.repeat);
    setSpeed(preset.speed);
  }

  return (
    <div className="macro-mode">
      <ActionList actions={actions} setActions={setActions} isPlaying={isPlaying} />

      {/* ── playback settings ── */}
      <div className="macro-settings-row">
        <div className="macro-setting-box">
          <div className="macro-setting-label">REPEAT</div>
          <div className="macro-stepper">
            <button type="button" className="stepper-btn" onClick={() => adjustRepeat(-1)}>−</button>
            <div className="stepper-val">
              <div className="stepper-num">{repeat === -1 ? "∞" : repeat}</div>
              <div className="stepper-unit">TIMES</div>
            </div>
            <button type="button" className="stepper-btn" onClick={() => adjustRepeat(1)}>+</button>
          </div>
        </div>

        <div className="macro-setting-box">
          <div className="macro-setting-label">SPEED</div>
          <div className="macro-speed-pills">
            {SPEED_OPTIONS.map((s) => (
              <button
                type="button"
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
      <div className="input-group macro-shortcut-group">
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
      <div className="macro-play-row">
        <button
          type="button"
          className="action-button"
          onClick={onPlay}
          disabled={isPlaying || actions.length === 0}
        >
          <IconPlay /> PLAY MACRO
        </button>
        <button
          type="button"
          className="action-button stop"
          onClick={onStop}
          disabled={!isPlaying}
        >
          <IconStop /> STOP
        </button>
      </div>

      {/* ── presets ── */}
      <PresetPanel
        actions={actions}
        repeat={repeat}
        speed={speed}
        shortcut={shortcut}
        isPlaying={isPlaying}
        onLoad={handleLoad}
        onPlay={onPlay}
      />
    </div>
  );
}
