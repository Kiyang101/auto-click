# Macro Editor Redesign

**Date:** 2026-04-24  
**Branch:** Feature-Macro  
**Status:** Approved

## Summary

Remove the transparent-overlay macro recorder. Replace it with a fully manual, custom-action editor built around dense action rows, a sidebar+detail preset panel, and five new action types. Build targets Windows first; new types implemented via `enigo`.

---

## Scope

**In scope:**
- Delete `MacroRecorder.tsx` and all recorder plumbing
- Add 5 new action types: `type_text`, `hold_left`, `hold_right`, `release_left`, `release_right`
- Split `MacroMode.tsx` into three focused components
- Redesign action list (dense rows, improved)
- Redesign preset panel (sidebar + detail)
- Update Rust `MacroAction` enum and `play_macro` handler

**Out of scope:**
- macOS CGEvent implementation for hold/release (deferred)
- Import/export of presets to file
- Undo/redo

---

## 1. Data Model (`src/types/macro.ts`)

### New action types

```ts
export type MacroActionType =
  | "click" | "right_click" | "double_click"
  | "scroll" | "wait" | "key"
  | "type_text"
  | "hold_left" | "hold_right"
  | "release_left" | "release_right";
```

### Updated `MacroAction` interface

One new optional field added:

```ts
export interface MacroAction {
  id: string;
  type: MacroActionType;
  x?: number;          // click / right_click / double_click / scroll
  y?: number;
  direction?: ScrollDirection;  // scroll only
  amount?: number;              // scroll only
  key?: string;                 // key only
  text?: string;                // type_text only
  delay_after: number;          // ms; for "wait" this IS the duration
}
```

Hold and release types use no position fields — they act at the current cursor position.

### Updated labels

```ts
export const ACTION_TYPE_LABELS: Record<MacroActionType, string> = {
  click: "L-CLICK",
  right_click: "R-CLICK",
  double_click: "DBL-CLICK",
  scroll: "SCROLL",
  wait: "WAIT",
  key: "KEY",
  type_text: "TYPE TEXT",
  hold_left: "HOLD-L",
  hold_right: "HOLD-R",
  release_left: "REL-L",
  release_right: "REL-R",
};
```

### Updated `makeAction()`

- `type_text` → `{ text: "", delay_after: 100 }`
- `hold_left`, `hold_right`, `release_left`, `release_right` → `{ delay_after: 0 }`

### Fix `setActions` type

`MacroModeProps.setActions` typed as `React.Dispatch<React.SetStateAction<MacroAction[]>>` (previously `(a: MacroAction[]) => void`, which blocked functional updaters).

---

## 2. Component Structure

### `src/MacroMode.tsx` — thin coordinator (~150 lines)

**Owns state:** `actions`, `repeat`, `speed`, `shortcut`, `isPlaying`, shortcut-recording flags.

**Removed entirely:** `isRecording`, `recorderWindowRef`, `unlistenRecordRef`, `unlistenStopRef`, `startRecording()`, `stopRecording()`, all `listen()` calls, `WebviewWindow` import, macro name field.

**Renders:**
1. `<ActionList actions={actions} setActions={setActions} isPlaying={isPlaying} />`
2. Playback settings (repeat stepper, speed pills)
3. Shortcut box
4. Play / Stop buttons
5. `<PresetPanel ... />`

### `src/components/ActionList.tsx` — action editor (~250 lines)

**Props:**
```ts
interface ActionListProps {
  actions: MacroAction[];
  setActions: React.Dispatch<React.SetStateAction<MacroAction[]>>;
  isPlaying: boolean;
}
```

**Contains `ActionRow`** as an inner component (not exported). Row layout: drag handle · index · type-badge select · type-specific fields · delay input · duplicate button · delete button.

**Type-specific fields per row:**

| Type | Fields shown |
|---|---|
| click, right_click, double_click | X, Y inputs |
| scroll | X, Y inputs · direction select · amount input |
| key | Key capture input (readOnly, captures on keydown) |
| type_text | Text input (free-form string) |
| wait | No extra fields (delay_after is the duration) |
| hold_left, hold_right, release_left, release_right | No fields (acts at current cursor) |

**Add button:** Dropdown listing all 11 types. Clicking a type appends a new action with `makeAction(type)`.

**Drag-to-reorder:** Preserved from current implementation.

**Estimated duration badge:** Shown in the section header (sum of all `delay_after` values).

### `src/components/PresetPanel.tsx` — sidebar + detail (~200 lines)

**Props:**
```ts
interface PresetPanelProps {
  actions: MacroAction[];
  repeat: number;
  speed: number;
  shortcut: string;
  isPlaying: boolean;
  onLoad: (preset: SavedMacro) => void;
  onPlay: () => void;
}
```

**Layout:** Two-column inside a container — left sidebar (preset names) + right detail pane.

**Left sidebar:**
- Scrollable list of saved preset names
- Clicking a name selects it (highlights in sidebar, shows detail on right)
- Save row at top: a text input for the preset name (local state inside `PresetPanel`, default "New Macro") + a Save button. Saves current `actions`/`repeat`/`speed`/`shortcut` under that name. `macroName` no longer lives in `MacroMode` — it moves here as PresetPanel-local state.

**Right detail pane (selected preset):**
- Name, action count, repeat, speed, shortcut
- **Load** button: calls `onLoad(preset)` — copies actions/repeat/speed/shortcut into editor
- **Play** button: calls `onLoad(preset)` then `onPlay()` after 50ms
- **Delete** button: removes preset from list
- Empty state when nothing selected: "Select a preset to see details"

**Persistence:** `localStorage` key `saved_macros` unchanged.

---

## 3. Rust Backend (`src-tauri/src/lib.rs`)

### New `MacroAction` variants (Windows / non-macOS branch)

```rust
#[serde(tag = "type", rename_all = "snake_case")]
pub enum MacroAction {
    // ... existing variants ...
    TypeText { text: String, delay_after: u64 },
    HoldLeft  { delay_after: u64 },
    HoldRight { delay_after: u64 },
    ReleaseLeft  { delay_after: u64 },
    ReleaseRight { delay_after: u64 },
}
```

### `play_macro` new match arms (Windows via `enigo`)

```rust
MacroAction::TypeText { text, delay_after } => {
    enigo.text(&text)?;
    thread::sleep(Duration::from_millis(delay_after));
}
MacroAction::HoldLeft { delay_after } => {
    enigo.button(Button::Left, Direction::Press)?;
    thread::sleep(Duration::from_millis(delay_after));
}
MacroAction::HoldRight { delay_after } => {
    enigo.button(Button::Right, Direction::Press)?;
    thread::sleep(Duration::from_millis(delay_after));
}
MacroAction::ReleaseLeft { delay_after } => {
    enigo.button(Button::Left, Direction::Release)?;
    thread::sleep(Duration::from_millis(delay_after));
}
MacroAction::ReleaseRight { delay_after } => {
    enigo.button(Button::Right, Direction::Release)?;
    thread::sleep(Duration::from_millis(delay_after));
}
```

macOS `#[cfg(target_os = "macos")]` block: add matching arms that return `Ok(())` (no-op stubs) so the app compiles on macOS. CGEvent implementation deferred.

---

## 4. Deletions

| File | Action |
|---|---|
| `src/MacroRecorder.tsx` | Delete entirely |
| `src/MacroMode.tsx` — `isRecording` state | Remove |
| `src/MacroMode.tsx` — `recorderWindowRef`, unlisten refs | Remove |
| `src/MacroMode.tsx` — `startRecording()`, `stopRecording()` | Remove |
| `src/MacroMode.tsx` — `listen()` imports, `WebviewWindow` import | Remove if unused |
| `src/MacroMode.tsx` — REC button + macro name input at top | Remove |
| `src/main.tsx` — `MacroRecorder` route (`?recorder=1`) | Remove |

---

## 5. CSS (`src/App.css`)

- Add `.preset-panel` layout styles (flexbox, sidebar width, detail pane)
- Add `.preset-sidebar-item`, `.preset-sidebar-item.active`
- Add `.preset-detail` section styles
- Add type-badge colours for 5 new types (`type_text`, `hold_left`, `hold_right`, `release_left`, `release_right`)
- `action-key-input` reused for type-text field (or a new `.action-text-input` with wider width)

---

## 6. Build Order

1. `src/types/macro.ts` — new types, updated labels, makeAction, fix setActions type
2. `src-tauri/src/lib.rs` — new enum variants + match arms
3. `src/components/ActionList.tsx` — new file
4. `src/components/PresetPanel.tsx` — new file
5. `src/MacroMode.tsx` — strip recorder, wire ActionList + PresetPanel
6. `src/main.tsx` — remove MacroRecorder route
7. Delete `src/MacroRecorder.tsx`
8. `src/App.css` — new styles
