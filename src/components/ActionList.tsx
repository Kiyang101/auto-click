import { useState, useEffect, type Dispatch, type SetStateAction } from "react";
import {
  MacroAction,
  MacroActionType,
  ACTION_TYPE_LABELS,
  makeAction,
} from "../types/macro";

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

interface ActionRowProps {
  action: MacroAction;
  index: number;
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
  const isPosition = ["click", "right_click", "double_click"].includes(action.type);
  const isScroll   = action.type === "scroll";
  const isKey      = action.type === "key";
  const isText     = action.type === "type_text";
  const isWait     = action.type === "wait";
  const isNoField  = ["hold_left", "hold_right", "release_left", "release_right"].includes(action.type);

  return (
    <div
      className={`macro-action-row${isDragOver ? " drag-over" : ""}`}
      onDragOver={(e) => { e.preventDefault(); onDragOver(index); }}
      onDrop={onDrop}
    >
      <div
        className="action-drag-handle"
        draggable
        onDragStart={() => onDragStart(index)}
      >
        <IconDrag />
      </div>

      <span className="action-num">{index + 1}</span>

      <select
        className={`action-type-select action-type-select--${action.type}`}
        value={action.type}
        onChange={(e) =>
          onChange(action.id, {
            type: e.target.value as MacroActionType,
            x: 0, y: 0, key: "", text: "", direction: "down", amount: 3,
          })
        }
      >
        {(Object.entries(ACTION_TYPE_LABELS) as [MacroActionType, string][]).map(([val, lbl]) => (
          <option key={val} value={val}>{lbl}</option>
        ))}
      </select>

      {isPosition && (
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

      {isScroll && (
        <div className="action-coord-group">
          <label className="action-coord-label">X</label>
          <input className="action-num-input" type="number" value={action.x ?? 0}
            onChange={(e) => onChange(action.id, { x: parseInt(e.target.value) || 0 })} />
          <label className="action-coord-label">Y</label>
          <input className="action-num-input" type="number" value={action.y ?? 0}
            onChange={(e) => onChange(action.id, { y: parseInt(e.target.value) || 0 })} />
          <select
            className="action-dir-select"
            value={action.direction ?? "down"}
            onChange={(e) => onChange(action.id, { direction: e.target.value as "up" | "down" | "left" | "right" })}
          >
            <option value="up">↑</option>
            <option value="down">↓</option>
            <option value="left">←</option>
            <option value="right">→</option>
          </select>
          <input
            className="action-num-input action-scroll-amount"
            type="number"
            min={1}
            max={20}
            value={action.amount ?? 3}
            onChange={(e) => onChange(action.id, { amount: parseInt(e.target.value) || 1 })}
          />
        </div>
      )}

      {isKey && (
        <div className="action-coord-group">
          <label className="action-coord-label">Key</label>
          <input
            className="action-key-input"
            value={action.key ?? ""}
            placeholder="e.g. Enter"
            onKeyDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (["Control", "Meta", "Alt", "Shift"].includes(e.key)) return;
              onChange(action.id, { key: e.key });
            }}
            onChange={() => {}}
            readOnly
          />
        </div>
      )}

      {isText && (
        <div className="action-coord-group">
          <label className="action-coord-label">Text</label>
          <input
            className="action-text-input"
            value={action.text ?? ""}
            placeholder="Type text…"
            onChange={(e) => onChange(action.id, { text: e.target.value })}
          />
        </div>
      )}

      {isWait && <span className="action-wait-label">pause for →</span>}
      {isNoField && <span className="action-wait-label">at cursor</span>}

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

      <div className="action-btns-inline">
        <button type="button" className="action-icon-btn dup" title="Duplicate" onClick={() => onDuplicate(action.id)}>
          <IconDuplicate />
        </button>
        <button type="button" className="action-icon-btn del" title="Delete" onClick={() => onDelete(action.id)}>
          <IconTrash />
        </button>
      </div>
    </div>
  );
}

export interface ActionListProps {
  actions: MacroAction[];
  setActions: Dispatch<SetStateAction<MacroAction[]>>;
  isPlaying: boolean;
}

export function ActionList({ actions, setActions, isPlaying }: ActionListProps) {
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  useEffect(() => {
    const handler = () => setAddMenuOpen(false);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  function addAction(type: MacroActionType) {
    setActions((prev) => [...prev, makeAction(type)]);
    setAddMenuOpen(false);
  }

  function updateAction(id: string, patch: Partial<MacroAction>) {
    setActions((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  }

  function duplicateAction(id: string) {
    setActions((prev) => {
      const idx = prev.findIndex((a) => a.id === id);
      if (idx === -1) return prev;
      const copy = { ...prev[idx], id: Date.now().toString() + Math.random() };
      const next = [...prev];
      next.splice(idx + 1, 0, copy);
      return next;
    });
  }

  function deleteAction(id: string) {
    setActions((prev) => prev.filter((a) => a.id !== id));
  }

  function handleDrop() {
    if (draggedIndex === null || dragOverIndex === null || draggedIndex === dragOverIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }
    setActions((prev) => {
      const next = [...prev];
      const [moved] = next.splice(draggedIndex, 1);
      next.splice(dragOverIndex, 0, moved);
      return next;
    });
    setDraggedIndex(null);
    setDragOverIndex(null);
  }

  const totalDelayMs = actions.reduce((sum, a) => sum + a.delay_after, 0);
  const estimatedSec = (totalDelayMs / 1000).toFixed(1);

  return (
    <>
      <div className="macro-section-header">
        <div className="label-with-icon no-margin">
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M1 4h12M1 8h12M1 12h12" />
          </svg>
          Actions
          {actions.length > 0 && (
            <span className="macro-count-badge">{actions.length}</span>
          )}
          {actions.length > 0 && (
            <span className="macro-count-badge dim">~{estimatedSec}s</span>
          )}
        </div>

        <div className="macro-add-action-wrap">
          <button
            type="button"
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
                  className={`macro-add-menu-item macro-add-menu-item--${t}`}
                  onClick={() => addAction(t)}
                >
                  {ACTION_TYPE_LABELS[t]}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div
        className="macro-action-list"
        onDragLeave={() => setDragOverIndex(null)}
      >
        {actions.length === 0 ? (
          <div className="macro-empty-state">Click Add to add an action</div>
        ) : (
          actions.map((action, index) => (
            <ActionRow
              key={action.id}
              action={action}
              index={index}
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
    </>
  );
}
