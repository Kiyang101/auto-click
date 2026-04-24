# Macro Editor Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the macro recorder overlay, add 5 new action types, split MacroMode into focused components, and redesign the preset panel with a sidebar+detail layout.

**Architecture:** MacroMode.tsx becomes a thin coordinator (~150 lines) that owns state and wires two new components: ActionList.tsx (action row editor with drag-to-reorder) and PresetPanel.tsx (sidebar+detail preset manager). All action manipulation logic moves into ActionList; all preset persistence moves into PresetPanel.

**Tech Stack:** React 18 + TypeScript (Tauri v2), Rust (`enigo` crate for new input types), `localStorage` for preset persistence.

**Spec:** `docs/superpowers/specs/2026-04-24-macro-editor-redesign.md`

---

## File Map

| Status | File | Change |
|--------|------|--------|
| MODIFY | `src/types/macro.ts` | Add 5 new types + `text` field + updated labels/makeAction |
| MODIFY | `src-tauri/src/lib.rs` | New enum variants, delay_after arms, helper fns, match arms |
| MODIFY | `src/App.css` | New type-badge CSS, preset panel layout, action-text-input |
| CREATE | `src/components/ActionList.tsx` | Full action editor component with ActionRow |
| CREATE | `src/components/PresetPanel.tsx` | Sidebar+detail preset manager |
| MODIFY | `src/MacroMode.tsx` | Full rewrite: thin coordinator, fixed setActions type |
| MODIFY | `src/main.tsx` | Remove MacroRecorder route |
| DELETE | `src/MacroRecorder.tsx` | Remove entirely |

---

## Task 1: Update data types

**Files:**
- Modify: `src/types/macro.ts` (full rewrite — file is small)

- [ ] **Step 1: Replace the contents of `src/types/macro.ts`**

```ts
export type MacroActionType =
  | "click"
  | "right_click"
  | "double_click"
  | "scroll"
  | "wait"
  | "key"
  | "type_text"
  | "hold_left"
  | "hold_right"
  | "release_left"
  | "release_right";

export type ScrollDirection = "up" | "down" | "left" | "right";

export interface MacroAction {
  id: string;
  type: MacroActionType;
  x?: number;
  y?: number;
  direction?: ScrollDirection;
  amount?: number;
  key?: string;
  text?: string;
  delay_after: number;
}

export interface SavedMacro {
  id: string;
  name: string;
  actions: MacroAction[];
  repeat: number;
  speed: number;
  shortcut: string;
  createdAt: number;
}

export const ACTION_TYPE_LABELS: Record<MacroActionType, string> = {
  click:         "L-CLICK",
  right_click:   "R-CLICK",
  double_click:  "DBL-CLICK",
  scroll:        "SCROLL",
  wait:          "WAIT",
  key:           "KEY",
  type_text:     "TYPE TEXT",
  hold_left:     "HOLD-L",
  hold_right:    "HOLD-R",
  release_left:  "REL-L",
  release_right: "REL-R",
};

export const SPEED_OPTIONS = [0.25, 0.5, 1.0, 2.0, 5.0];

export function makeAction(type: MacroActionType): MacroAction {
  const base = { id: Date.now().toString() + Math.random(), delay_after: 100 };
  switch (type) {
    case "click":
    case "right_click":
    case "double_click":
      return { ...base, type, x: 0, y: 0 };
    case "scroll":
      return { ...base, type, x: 0, y: 0, direction: "down", amount: 3 };
    case "key":
      return { ...base, type, key: "" };
    case "wait":
      return { ...base, type, delay_after: 500 };
    case "type_text":
      return { ...base, type, text: "" };
    case "hold_left":
    case "hold_right":
    case "release_left":
    case "release_right":
      return { ...base, type, delay_after: 0 };
  }
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: errors only in MacroMode.tsx (setActions type mismatch + missing new ACTION_TYPE_LABELS keys) — those are fixed in later tasks. Zero errors from types/macro.ts itself.

- [ ] **Step 3: Commit**

```bash
git add src/types/macro.ts
git commit -m "feat: add 5 new macro action types to data model"
```

---

## Task 2: Update Rust backend

**Files:**
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Add 5 new variants to the `MacroAction` enum**

Find this block in `lib.rs`:

```rust
#[derive(serde::Deserialize, Debug, Clone)]
#[serde(tag = "type", rename_all = "snake_case")]
enum MacroAction {
    Click       { x: f64, y: f64, delay_after: u64 },
    RightClick  { x: f64, y: f64, delay_after: u64 },
    DoubleClick { x: f64, y: f64, delay_after: u64 },
    Scroll      { x: f64, y: f64, direction: String, amount: i32, delay_after: u64 },
    Wait        { delay_after: u64 },
    Key         { key: String, delay_after: u64 },
}
```

Replace it with:

```rust
#[derive(serde::Deserialize, Debug, Clone)]
#[serde(tag = "type", rename_all = "snake_case")]
enum MacroAction {
    Click        { x: f64, y: f64, delay_after: u64 },
    RightClick   { x: f64, y: f64, delay_after: u64 },
    DoubleClick  { x: f64, y: f64, delay_after: u64 },
    Scroll       { x: f64, y: f64, direction: String, amount: i32, delay_after: u64 },
    Wait         { delay_after: u64 },
    Key          { key: String, delay_after: u64 },
    TypeText     { text: String, delay_after: u64 },
    HoldLeft     { delay_after: u64 },
    HoldRight    { delay_after: u64 },
    ReleaseLeft  { delay_after: u64 },
    ReleaseRight { delay_after: u64 },
}
```

- [ ] **Step 2: Extend the `delay_after()` method**

Find this block:

```rust
impl MacroAction {
    fn delay_after(&self) -> u64 {
        match self {
            MacroAction::Click       { delay_after, .. } => *delay_after,
            MacroAction::RightClick  { delay_after, .. } => *delay_after,
            MacroAction::DoubleClick { delay_after, .. } => *delay_after,
            MacroAction::Scroll      { delay_after, .. } => *delay_after,
            MacroAction::Wait        { delay_after }     => *delay_after,
            MacroAction::Key         { delay_after, .. } => *delay_after,
        }
    }
}
```

Replace with:

```rust
impl MacroAction {
    fn delay_after(&self) -> u64 {
        match self {
            MacroAction::Click        { delay_after, .. } => *delay_after,
            MacroAction::RightClick   { delay_after, .. } => *delay_after,
            MacroAction::DoubleClick  { delay_after, .. } => *delay_after,
            MacroAction::Scroll       { delay_after, .. } => *delay_after,
            MacroAction::Wait         { delay_after }     => *delay_after,
            MacroAction::Key          { delay_after, .. } => *delay_after,
            MacroAction::TypeText     { delay_after, .. } => *delay_after,
            MacroAction::HoldLeft     { delay_after }     => *delay_after,
            MacroAction::HoldRight    { delay_after }     => *delay_after,
            MacroAction::ReleaseLeft  { delay_after }     => *delay_after,
            MacroAction::ReleaseRight { delay_after }     => *delay_after,
        }
    }
}
```

- [ ] **Step 3: Add helper functions for the new action types**

Add these functions after the `press_key` function (around line 172 in the original file):

```rust
// ─── Type text helper (enigo on all platforms) ────────────────────────────────

fn type_text_str(text: &str) {
    use enigo::{Enigo, Keyboard, Settings};
    let Ok(mut enigo) = Enigo::new(&Settings::default()) else { return };
    let _ = enigo.text(text);
}

// ─── Mouse hold / release helpers ────────────────────────────────────────────

#[cfg(not(target_os = "macos"))]
fn hold_mouse_left() {
    use enigo::{Button, Direction, Enigo, Mouse, Settings};
    let Ok(mut enigo) = Enigo::new(&Settings::default()) else { return };
    let _ = enigo.button(Button::Left, Direction::Press);
}

#[cfg(not(target_os = "macos"))]
fn hold_mouse_right() {
    use enigo::{Button, Direction, Enigo, Mouse, Settings};
    let Ok(mut enigo) = Enigo::new(&Settings::default()) else { return };
    let _ = enigo.button(Button::Right, Direction::Press);
}

#[cfg(not(target_os = "macos"))]
fn release_mouse_left() {
    use enigo::{Button, Direction, Enigo, Mouse, Settings};
    let Ok(mut enigo) = Enigo::new(&Settings::default()) else { return };
    let _ = enigo.button(Button::Left, Direction::Release);
}

#[cfg(not(target_os = "macos"))]
fn release_mouse_right() {
    use enigo::{Button, Direction, Enigo, Mouse, Settings};
    let Ok(mut enigo) = Enigo::new(&Settings::default()) else { return };
    let _ = enigo.button(Button::Right, Direction::Release);
}

#[cfg(target_os = "macos")]
fn hold_mouse_left() {}
#[cfg(target_os = "macos")]
fn hold_mouse_right() {}
#[cfg(target_os = "macos")]
fn release_mouse_left() {}
#[cfg(target_os = "macos")]
fn release_mouse_right() {}
```

- [ ] **Step 4: Add 5 new match arms inside `play_macro`**

Inside the `play_macro` function, find this match block (the match inside the `_lock` scope):

```rust
match action {
    MacroAction::Click { x, y, .. } => {
        post_click_at(*x, *y);
    }
    // ... existing arms ...
    MacroAction::Wait { .. } => {
        // delay handled below
    }
}
```

Add these 5 arms at the end of the match (before the closing `}`):

```rust
                        MacroAction::TypeText { text, .. } => {
                            type_text_str(text);
                        }
                        MacroAction::HoldLeft { .. } => {
                            hold_mouse_left();
                        }
                        MacroAction::HoldRight { .. } => {
                            hold_mouse_right();
                        }
                        MacroAction::ReleaseLeft { .. } => {
                            release_mouse_left();
                        }
                        MacroAction::ReleaseRight { .. } => {
                            release_mouse_right();
                        }
```

- [ ] **Step 5: Verify Rust compiles**

```bash
cd src-tauri && cargo check 2>&1
```

Expected: `Finished` with zero errors. Warnings about unused variables are fine.

- [ ] **Step 6: Commit**

```bash
cd ..
git add src-tauri/src/lib.rs
git commit -m "feat: add TypeText, HoldLeft/Right, ReleaseLeft/Right to Rust backend"
```

---

## Task 3: Add CSS for new types and preset panel

**Files:**
- Modify: `src/App.css` (append new rules at end of file)

- [ ] **Step 1: Add CSS for new action type badge colors in the add-menu dropdown**

Append to the end of `src/App.css`:

```css
/* ── new action type colors (add-menu items) ── */
.macro-add-menu-item--type_text   { color: #38bdf8; }
.macro-add-menu-item--hold_left   { color: #fb923c; }
.macro-add-menu-item--hold_right  { color: #f97316; }
.macro-add-menu-item--release_left  { color: #86efac; }
.macro-add-menu-item--release_right { color: #4ade80; }

/* ── new action type colors (row type-select) ── */
.action-type-select--click        { background: rgba(59,130,246,0.15);   color: #60a5fa; border-color: transparent; }
.action-type-select--right_click  { background: rgba(236,72,153,0.15);   color: #f472b6; border-color: transparent; }
.action-type-select--double_click { background: rgba(139,92,246,0.15);   color: #a78bfa; border-color: transparent; }
.action-type-select--scroll       { background: rgba(16,185,129,0.15);   color: #34d399; border-color: transparent; }
.action-type-select--wait         { background: rgba(245,158,11,0.15);   color: #fbbf24; border-color: transparent; }
.action-type-select--key          { background: rgba(168,85,247,0.15);   color: #c084fc; border-color: transparent; }
.action-type-select--type_text    { background: rgba(56,189,248,0.15);   color: #38bdf8; border-color: transparent; }
.action-type-select--hold_left    { background: rgba(251,146,60,0.15);   color: #fb923c; border-color: transparent; }
.action-type-select--hold_right   { background: rgba(249,115,22,0.15);   color: #f97316; border-color: transparent; }
.action-type-select--release_left { background: rgba(134,239,172,0.15);  color: #86efac; border-color: transparent; }
.action-type-select--release_right{ background: rgba(74,222,128,0.15);   color: #4ade80; border-color: transparent; }

/* ── text action input ── */
.action-text-input {
  flex: 1;
  min-width: 80px;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 0.35rem;
  color: #e2e8f0;
  font-size: 0.72rem;
  padding: 2px 6px;
  height: 22px;
}

/* ── scroll amount field fixed width ── */
.action-scroll-amount {
  width: 36px;
}

/* ── preset panel ── */
.preset-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.preset-save-row {
  display: flex;
  gap: 6px;
}

.preset-name-input {
  flex: 1;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 0.5rem;
  color: #e2e8f0;
  font-size: 0.8rem;
  padding: 0.35rem 0.6rem;
  outline: none;
}
.preset-name-input:focus { border-color: rgba(59,130,246,0.4); }

.preset-body {
  display: flex;
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 0.75rem;
  overflow: hidden;
  min-height: 140px;
}

.preset-sidebar {
  width: 110px;
  flex-shrink: 0;
  border-right: 1px solid rgba(255,255,255,0.07);
  overflow-y: auto;
  padding: 4px;
}

.preset-sidebar-item {
  padding: 5px 8px;
  border-radius: 6px;
  font-size: 0.72rem;
  color: #94a3b8;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: all 0.12s;
  margin-bottom: 2px;
}
.preset-sidebar-item:hover { background: rgba(255,255,255,0.05); color: #e2e8f0; }
.preset-sidebar-item.active { background: rgba(59,130,246,0.15); color: #60a5fa; font-weight: 700; }

.preset-detail {
  flex: 1;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.preset-detail-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  font-size: 0.72rem;
  text-align: center;
}

.preset-detail-name {
  font-size: 0.88rem;
  font-weight: 700;
  color: #e2e8f0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.preset-detail-meta {
  font-size: 0.7rem;
  color: #64748b;
  line-height: 1.7;
}

.preset-detail-actions {
  display: flex;
  gap: 5px;
  margin-top: auto;
}

.preset-detail-btn {
  flex: 1;
  background: rgba(59,130,246,0.1);
  border: 1px solid rgba(59,130,246,0.2);
  border-radius: 0.45rem;
  color: #60a5fa;
  font-size: 0.7rem;
  font-weight: 700;
  padding: 4px 0;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  transition: all 0.12s;
}
.preset-detail-btn:hover { background: rgba(59,130,246,0.2); }
.preset-detail-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.preset-detail-btn.load {
  background: rgba(255,255,255,0.05);
  border-color: rgba(255,255,255,0.1);
  color: #94a3b8;
}
.preset-detail-btn.load:hover { background: rgba(255,255,255,0.1); color: #e2e8f0; }

.preset-detail-btn.del {
  flex: 0 0 28px;
  background: rgba(239,68,68,0.08);
  border-color: rgba(239,68,68,0.15);
  color: #f87171;
}
.preset-detail-btn.del:hover { background: rgba(239,68,68,0.18); }
```

- [ ] **Step 2: Commit**

```bash
git add src/App.css
git commit -m "feat: add CSS for new action types and preset panel"
```

---

## Task 4: Create ActionList component

**Files:**
- Create: `src/components/ActionList.tsx`

- [ ] **Step 1: Create `src/components/ActionList.tsx` with full contents**

```tsx
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
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: zero errors from `ActionList.tsx`. Remaining errors are in `MacroMode.tsx` (fixed in Task 6).

- [ ] **Step 3: Commit**

```bash
git add src/components/ActionList.tsx
git commit -m "feat: create ActionList component with 11 action types"
```

---

## Task 5: Create PresetPanel component

**Files:**
- Create: `src/components/PresetPanel.tsx`

- [ ] **Step 1: Create `src/components/PresetPanel.tsx` with full contents**

```tsx
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

export function PresetPanel({
  actions, repeat, speed, shortcut, isPlaying, onLoad, onPlay,
}: PresetPanelProps) {
  const [presets, setPresets] = useState<SavedMacro[]>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); }
    catch { return []; }
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
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: zero new errors from `PresetPanel.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/components/PresetPanel.tsx
git commit -m "feat: create PresetPanel component with sidebar+detail layout"
```

---

## Task 6: Rewrite MacroMode.tsx as thin coordinator

**Files:**
- Modify: `src/MacroMode.tsx` (full replacement)

- [ ] **Step 1: Replace the entire contents of `src/MacroMode.tsx`**

```tsx
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
```

- [ ] **Step 2: Type-check — expect zero errors**

```bash
npx tsc --noEmit
```

Expected: zero TypeScript errors across the entire project.

- [ ] **Step 3: Commit**

```bash
git add src/MacroMode.tsx
git commit -m "refactor: rewrite MacroMode as thin coordinator, remove recorder"
```

---

## Task 7: Remove MacroRecorder from entry point and delete the file

**Files:**
- Modify: `src/main.tsx`
- Delete: `src/MacroRecorder.tsx`

- [ ] **Step 1: Replace `src/main.tsx` with recorder route removed**

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { PointOverlay } from "./PointOverlay";

const urlParams = new URLSearchParams(window.location.search);
const pointId   = urlParams.get("point");

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    {pointId ? (
      <PointOverlay id={pointId} />
    ) : (
      <App />
    )}
  </React.StrictMode>
);
```

- [ ] **Step 2: Delete `src/MacroRecorder.tsx`**

```bash
rm src/MacroRecorder.tsx
```

- [ ] **Step 3: Type-check — expect zero errors**

```bash
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 4: Verify dev server starts cleanly**

```bash
npm run dev 2>&1 | head -20
```

Expected: Vite dev server starts without errors. Open the URL shown and verify the Macro tab shows the new action editor and preset panel.

- [ ] **Step 5: Commit**

```bash
git add src/main.tsx
git rm src/MacroRecorder.tsx
git commit -m "chore: remove MacroRecorder component and entry-point route"
```

---

## Self-Review Checklist

After all tasks, verify:

- [ ] `npx tsc --noEmit` — zero errors
- [ ] Macro tab shows action list with dense rows and "Add" dropdown listing all 11 types
- [ ] Adding a TYPE TEXT action shows a text input field
- [ ] Adding HOLD-L, HOLD-R, REL-L, REL-R shows only a delay field and "at cursor" label
- [ ] Drag-to-reorder still works on action rows
- [ ] Preset panel shows sidebar on left + detail on right
- [ ] Saving a preset adds it to sidebar and auto-selects it
- [ ] Load copies preset's actions/repeat/speed into editor
- [ ] Play loads then triggers playback
- [ ] Delete removes preset; detail pane shows empty state
- [ ] `cargo check` in `src-tauri/` — zero errors
