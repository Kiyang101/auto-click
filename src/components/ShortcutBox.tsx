import React from "react";

interface ShortcutBoxProps {
  shortcut: string;
  isRecording: boolean;
  onStartRecording: () => void;
  onSetShortcut: (shortcut: string) => void;
  onCancelRecording: () => void;
}

export const ShortcutBox = ({
  shortcut,
  isRecording,
  onStartRecording,
  onSetShortcut,
  onCancelRecording,
}: ShortcutBoxProps) => {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
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
      const keyMap: Record<string, string> = {
        " ": "Space",
        ARROWUP: "Up",
        ARROWDOWN: "Down",
        ARROWLEFT: "Left",
        ARROWRIGHT: "Right",
      };
      if (keyMap[keyName]) keyName = keyMap[keyName];

      keys.push(keyName);
      const newShortcut = keys.join("+");
      onSetShortcut(newShortcut);
    }
  };

  return (
    <div
      className={`shortcut-box ${isRecording ? "recording" : ""}`}
      onClick={onStartRecording}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onBlur={onCancelRecording}
    >
      {isRecording ? (
        <span
          style={{
            color: "var(--accent-rose)",
            fontWeight: 700,
            fontSize: "0.8rem",
          }}
        >
          RECORDING...
        </span>
      ) : (
        <div className="keys">
          {shortcut
            .replace("CommandOrControl", "Ctrl")
            .split("+")
            .map((key, i) => (
              <kbd key={i}>{key}</kbd>
            ))}
        </div>
      )}
    </div>
  );
};
