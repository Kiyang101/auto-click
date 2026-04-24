# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
npm install            # install JS dependencies (Rust deps are resolved by cargo automatically)
npm run tauri dev      # start dev server with hot-reload (frontend + Rust backend)

# Production build
npm run tauri build    # compile release binary + installer

# Frontend only (no Tauri shell, useful for quick UI iteration in browser)
npm run dev

# Type-check frontend
npx tsc --noEmit
```

There is no dedicated test runner. Rust unit tests would run with `cargo test` inside `src-tauri/`.

## Architecture

This is a **Tauri v2** desktop app. The single `index.html` / `main.tsx` entry point serves three distinct UI contexts, selected by URL query params at window creation time:

| Query param | Component rendered | Purpose |
|---|---|---|
| *(none)* | `<App>` | Main control panel |
| `?point=<id>` | `<PointOverlay id>` | Draggable target crosshair overlay |
| `?recorder=1` | `<MacroRecorder>` | Fullscreen transparent recording overlay |

### Multi-window design

- **Main window** (`main`) — React control panel (`App.tsx`). Creates child windows via `WebviewWindow`.
- **Point overlays** (`point-<id>`) — 50×50 transparent, always-on-top windows. Each is a draggable crosshair marker (`PointOverlay.tsx`). The main window resolves their screen coordinates via `win.innerPosition()` + `win.scaleFactor()` at click-start time (macOS requires dividing by scale factor; other platforms do not).
- **Macro recorder** (`macro-recorder`) — fullscreen transparent overlay (`MacroRecorder.tsx`) that captures clicks/keypresses and emits `macro-record-action` events to the main window. `rgba(0,0,0,0.01)` background is intentional — fully transparent windows don't receive click events.

### Tauri IPC

Frontend → Backend: `invoke()` calls Rust commands exposed in `lib.rs`:
- `start_clicking(intervalMs)` — single-point clicking at cursor position
- `start_multi_clicking(points[])` — parallel per-point click loops
- `stop_clicking()` — stops both single and multi
- `play_macro(actions, repeat, speed)` — executes a `MacroAction` sequence in a background thread
- `stop_macro()` — signals the macro loop to exit

Backend → Frontend: Tauri events via `emit`/`listen`:
- `update-indices` — main window → point overlays, syncs displayed index numbers
- `highlight-point` — main window → point overlays, visual feedback
- `macro-record-action` — recorder overlay → main window, streams captured actions
- `macro-record-stop` — recorder overlay → main window, signals recording end

### Rust state (`AppState`)

Three `Arc<AtomicBool>` flags enforce mutual exclusion between modes:
- `is_clicking` — single mode active
- `multi_clicking` — multi mode active
- `is_macro` — macro playback active

A shared `Arc<Mutex<()>>` (`click_lock`) serialises the actual input events so simultaneous multi-point threads don't interleave clicks.

### Platform differences (Rust)

macOS uses `core-graphics` directly (`CGEvent` + `CGWarpMouseCursorPosition`) to post clicks without moving the visible cursor. All other platforms use the `enigo` crate, which does move the cursor.

### Global shortcuts

Registered via `@tauri-apps/plugin-global-shortcut`. Shortcuts are stored in `localStorage` (`singleShortcut`, `multiShortcut`, `macroShortcut`) and re-registered on every change. A `stateRef` pattern (`useRef` mirroring state) lets shortcut callbacks read current state without stale closures.

### Macro data

`MacroAction` type is defined in `src/types/macro.ts` and mirrors the Rust `MacroAction` enum in `lib.rs` (serialised with `#[serde(tag = "type", rename_all = "snake_case")]`). Saved macros persist in `localStorage` under `saved_macros`. The `delay_after` field doubles as the pause duration for `Wait` actions.

### Tauri capabilities

`src-tauri/capabilities/default.json` — main window only (`core:default`, `opener:default`).  
`src-tauri/capabilities/desktop.json` — all windows (`*`): window management, webview creation, global shortcut APIs.
