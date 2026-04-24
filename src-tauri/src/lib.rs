use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{Manager, State};

#[cfg(target_os = "macos")]
use core_graphics::event::{CGEvent, CGEventTapLocation, CGMouseButton, CGEventType};
#[cfg(target_os = "macos")]
use core_graphics::event_source::{CGEventSource, CGEventSourceStateID};
#[cfg(target_os = "macos")]
use core_graphics::geometry::CGPoint;

// ─── App state ────────────────────────────────────────────────────────────────

struct AppState {
    is_clicking:    Arc<AtomicBool>,
    multi_clicking: Arc<AtomicBool>,
    is_macro:       Arc<AtomicBool>,
    click_lock:     Arc<Mutex<()>>,
}

// ─── Existing data types ──────────────────────────────────────────────────────

#[derive(serde::Deserialize, Debug, Clone)]
struct PointConfig {
    #[allow(dead_code)]
    id: String,
    x: i32,
    y: i32,
    interval: u64,
}

// ─── Macro action enum ────────────────────────────────────────────────────────
//
// Serialised from the frontend as `{ "type": "click", "x": 100, "y": 200, "delay_after": 50 }`.
// The `#[serde(tag = "type")]` attribute uses the "type" field as the enum discriminant.

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

// ─── Low-level click helpers ──────────────────────────────────────────────────

#[cfg(target_os = "macos")]
fn post_click_at(x: f64, y: f64) {
    if let Ok(source) = CGEventSource::new(CGEventSourceStateID::HIDSystemState) {
        let current_pos = CGEvent::new(source.clone())
            .map(|e| e.location())
            .unwrap_or_else(|_| CGPoint::new(x, y));

        let target = CGPoint::new(x, y);
        let down = CGEvent::new_mouse_event(source.clone(), CGEventType::LeftMouseDown,  target, CGMouseButton::Left);
        let up   = CGEvent::new_mouse_event(source.clone(), CGEventType::LeftMouseUp,    target, CGMouseButton::Left);
        if let (Ok(d), Ok(u)) = (down, up) {
            d.post(CGEventTapLocation::HID);
            u.post(CGEventTapLocation::HID);
            unsafe { core_graphics::display::CGWarpMouseCursorPosition(current_pos); }
        }
    }
}

#[cfg(target_os = "macos")]
fn post_right_click_at(x: f64, y: f64) {
    if let Ok(source) = CGEventSource::new(CGEventSourceStateID::HIDSystemState) {
        let current_pos = CGEvent::new(source.clone())
            .map(|e| e.location())
            .unwrap_or_else(|_| CGPoint::new(x, y));

        let target = CGPoint::new(x, y);
        let down = CGEvent::new_mouse_event(source.clone(), CGEventType::RightMouseDown, target, CGMouseButton::Right);
        let up   = CGEvent::new_mouse_event(source.clone(), CGEventType::RightMouseUp,   target, CGMouseButton::Right);
        if let (Ok(d), Ok(u)) = (down, up) {
            d.post(CGEventTapLocation::HID);
            u.post(CGEventTapLocation::HID);
            unsafe { core_graphics::display::CGWarpMouseCursorPosition(current_pos); }
        }
    }
}

#[cfg(not(target_os = "macos"))]
fn post_click_at(x: f64, y: f64) {
    use enigo::{Button, Coordinate, Direction, Enigo, Mouse, Settings};
    let Ok(mut enigo) = Enigo::new(&Settings::default()) else { return };
    if let Ok(cur) = enigo.location() {
        let _ = enigo.move_mouse(x as i32, y as i32, Coordinate::Abs);
        let _ = enigo.button(Button::Left, Direction::Press);
        let _ = enigo.button(Button::Left, Direction::Release);
        let _ = enigo.move_mouse(cur.0, cur.1, Coordinate::Abs);
    } else {
        let _ = enigo.move_mouse(x as i32, y as i32, Coordinate::Abs);
        let _ = enigo.button(Button::Left, Direction::Click);
    }
}

#[cfg(not(target_os = "macos"))]
fn post_right_click_at(x: f64, y: f64) {
    use enigo::{Button, Coordinate, Direction, Enigo, Mouse, Settings};
    let Ok(mut enigo) = Enigo::new(&Settings::default()) else { return };
    if let Ok(cur) = enigo.location() {
        let _ = enigo.move_mouse(x as i32, y as i32, Coordinate::Abs);
        let _ = enigo.button(Button::Right, Direction::Press);
        let _ = enigo.button(Button::Right, Direction::Release);
        let _ = enigo.move_mouse(cur.0, cur.1, Coordinate::Abs);
    } else {
        let _ = enigo.move_mouse(x as i32, y as i32, Coordinate::Abs);
        let _ = enigo.button(Button::Right, Direction::Click);
    }
}

fn post_double_click_at(x: f64, y: f64) {
    post_click_at(x, y);
    std::thread::sleep(Duration::from_millis(60));
    post_click_at(x, y);
}

// ─── Key press helper (enigo on all platforms) ────────────────────────────────

fn press_key(key_str: &str) {
    use enigo::{Direction, Enigo, Key, Keyboard, Settings};
    let Ok(mut enigo) = Enigo::new(&Settings::default()) else { return };

    let key: Option<Key> = match key_str {
        "Enter" | "Return"      => Some(Key::Return),
        "Tab"                   => Some(Key::Tab),
        " " | "Space"           => Some(Key::Space),
        "Backspace"             => Some(Key::Backspace),
        "Escape" | "Esc"        => Some(Key::Escape),
        "Delete"                => Some(Key::Delete),
        "ArrowUp"    | "Up"     => Some(Key::UpArrow),
        "ArrowDown"  | "Down"   => Some(Key::DownArrow),
        "ArrowLeft"  | "Left"   => Some(Key::LeftArrow),
        "ArrowRight" | "Right"  => Some(Key::RightArrow),
        "Home"                  => Some(Key::Home),
        "End"                   => Some(Key::End),
        "PageUp"                => Some(Key::PageUp),
        "PageDown"              => Some(Key::PageDown),
        "F1"  => Some(Key::F1),  "F2"  => Some(Key::F2),
        "F3"  => Some(Key::F3),  "F4"  => Some(Key::F4),
        "F5"  => Some(Key::F5),  "F6"  => Some(Key::F6),
        "F7"  => Some(Key::F7),  "F8"  => Some(Key::F8),
        "F9"  => Some(Key::F9),  "F10" => Some(Key::F10),
        "F11" => Some(Key::F11), "F12" => Some(Key::F12),
        s if s.chars().count() == 1 => {
            Some(Key::Unicode(s.chars().next().unwrap()))
        }
        _ => None,
    };

    if let Some(k) = key {
        let _ = enigo.key(k, Direction::Click);
    }
}

// ─── Existing commands ────────────────────────────────────────────────────────

#[tauri::command]
fn start_clicking(state: State<'_, AppState>, interval_ms: u64) -> Result<(), String> {
    if state.is_clicking.load(Ordering::SeqCst)
        || state.multi_clicking.load(Ordering::SeqCst)
        || state.is_macro.load(Ordering::SeqCst)
    {
        return Ok(());
    }

    state.is_clicking.store(true, Ordering::SeqCst);
    let is_clicking = Arc::clone(&state.is_clicking);
    let click_lock  = Arc::clone(&state.click_lock);

    std::thread::spawn(move || {
        #[cfg(not(target_os = "macos"))]
        {
            use enigo::{Button, Coordinate, Direction, Enigo, Mouse, Settings};
            let Ok(mut enigo) = Enigo::new(&Settings::default()) else { return };
            while is_clicking.load(Ordering::SeqCst) {
                if let Ok(pos) = enigo.location() {
                    let _lock = click_lock.lock().unwrap();
                    let _ = enigo.button(Button::Left, Direction::Press);
                    let _ = enigo.button(Button::Left, Direction::Release);
                    let _ = enigo.move_mouse(pos.0, pos.1, Coordinate::Abs);
                } else {
                    let _lock = click_lock.lock().unwrap();
                    let _ = enigo.button(Button::Left, Direction::Click);
                }
                std::thread::sleep(Duration::from_millis(interval_ms));
            }
        }
        #[cfg(target_os = "macos")]
        while is_clicking.load(Ordering::SeqCst) {
            if let Ok(source) = CGEventSource::new(CGEventSourceStateID::HIDSystemState) {
                if let Ok(event) = CGEvent::new(source) {
                    let pos = event.location();
                    let _lock = click_lock.lock().unwrap();
                    post_click_at(pos.x, pos.y);
                }
            }
            std::thread::sleep(Duration::from_millis(interval_ms));
        }
    });

    Ok(())
}

#[tauri::command]
fn start_multi_clicking(state: State<'_, AppState>, points: Vec<PointConfig>) -> Result<(), String> {
    if state.is_clicking.load(Ordering::SeqCst)
        || state.multi_clicking.load(Ordering::SeqCst)
        || state.is_macro.load(Ordering::SeqCst)
    {
        return Ok(());
    }

    state.multi_clicking.store(true, Ordering::SeqCst);

    for point in points {
        let multi_clicking = Arc::clone(&state.multi_clicking);
        let click_lock     = Arc::clone(&state.click_lock);
        std::thread::spawn(move || {
            while multi_clicking.load(Ordering::SeqCst) {
                {
                    let _lock = click_lock.lock().unwrap();
                    post_click_at(point.x as f64, point.y as f64);
                }
                std::thread::sleep(Duration::from_millis(point.interval));
            }
        });
    }

    Ok(())
}

#[tauri::command]
fn stop_clicking(state: State<'_, AppState>) {
    state.is_clicking.store(false, Ordering::SeqCst);
    state.multi_clicking.store(false, Ordering::SeqCst);
}

#[tauri::command]
fn check_permissions() -> bool {
    true
}

// ─── Macro commands ───────────────────────────────────────────────────────────

/// Play a macro sequence.
///
/// - `actions`: ordered list of MacroAction steps
/// - `repeat`:  how many times to run the full sequence (-1 = infinite)
/// - `speed`:   playback multiplier (2.0 = half the delay, i.e. 2× faster)
#[tauri::command]
fn play_macro(
    state: State<'_, AppState>,
    actions: Vec<MacroAction>,
    repeat: i32,
    speed: f64,
) -> Result<(), String> {
    if state.is_clicking.load(Ordering::SeqCst)
        || state.multi_clicking.load(Ordering::SeqCst)
        || state.is_macro.load(Ordering::SeqCst)
    {
        return Ok(());
    }
    if actions.is_empty() {
        return Ok(());
    }

    let speed = speed.max(0.01); // guard against division by zero
    state.is_macro.store(true, Ordering::SeqCst);
    let is_macro   = Arc::clone(&state.is_macro);
    let click_lock = Arc::clone(&state.click_lock);

    std::thread::spawn(move || {
        let mut run = 0i32;

        'outer: loop {
            // Check repeat limit
            if repeat >= 0 && run >= repeat {
                break;
            }
            if !is_macro.load(Ordering::SeqCst) {
                break;
            }

            for action in &actions {
                if !is_macro.load(Ordering::SeqCst) {
                    break 'outer;
                }

                // Execute the action
                {
                    let _lock = click_lock.lock().unwrap();
                    match action {
                        MacroAction::Click { x, y, .. } => {
                            post_click_at(*x, *y);
                        }
                        MacroAction::RightClick { x, y, .. } => {
                            post_right_click_at(*x, *y);
                        }
                        MacroAction::DoubleClick { x, y, .. } => {
                            post_double_click_at(*x, *y);
                        }
                        MacroAction::Scroll { x, y, direction, amount, .. } => {
                            // Move cursor to target position first, then scroll
                            #[cfg(not(target_os = "macos"))]
                            {
                                use enigo::{Axis, Coordinate, Enigo, Mouse, Settings};
                                if let Ok(mut enigo) = Enigo::new(&Settings::default()) {
                                    let _ = enigo.move_mouse(*x as i32, *y as i32, Coordinate::Abs);
                                    let scroll_amount = match direction.as_str() {
                                        "up"   =>  *amount,
                                        "down" => -*amount,
                                        _      =>  *amount,
                                    };
                                    let _ = enigo.scroll(scroll_amount, Axis::Vertical);
                                }
                            }
                            #[cfg(target_os = "macos")]
                            {
                                // Move cursor to x,y before scrolling
                                unsafe {
                                    core_graphics::display::CGWarpMouseCursorPosition(
                                        CGPoint::new(*x, *y),
                                    );
                                }
                                
                                use enigo::{Axis, Enigo, Mouse, Settings};
                                if let Ok(mut enigo) = Enigo::new(&Settings::default()) {
                                    let scroll_amount = match direction.as_str() {
                                        "up"   =>  *amount,
                                        "down" => -*amount,
                                        _      =>  *amount,
                                    };
                                    let _ = enigo.scroll(scroll_amount, Axis::Vertical);
                                }
                            }
                        }
                        MacroAction::Key { key, .. } => {
                            press_key(key);
                        }
                        MacroAction::Wait { .. } => {
                            // delay handled below
                        }
                    }
                } // lock released

                // Per-action delay (scaled by speed)
                let raw_ms = action.delay_after();
                if raw_ms > 0 {
                    let scaled = ((raw_ms as f64) / speed).round() as u64;
                    // Sleep in small chunks so stop_macro is responsive
                    let chunk = 20u64;
                    let mut remaining = scaled;
                    while remaining > 0 && is_macro.load(Ordering::SeqCst) {
                        let sleep = remaining.min(chunk);
                        std::thread::sleep(Duration::from_millis(sleep));
                        remaining = remaining.saturating_sub(chunk);
                    }
                }
            }

            run += 1;
        }

        is_macro.store(false, Ordering::SeqCst);
    });

    Ok(())
}

/// Stop a running macro immediately.
#[tauri::command]
fn stop_macro(state: State<'_, AppState>) {
    state.is_macro.store(false, Ordering::SeqCst);
}

// ─── App entry point ──────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .manage(AppState {
            is_clicking:    Arc::new(AtomicBool::new(false)),
            multi_clicking: Arc::new(AtomicBool::new(false)),
            is_macro:       Arc::new(AtomicBool::new(false)),
            click_lock:     Arc::new(Mutex::new(())),
        })
        .on_window_event(|window, event| match event {
            tauri::WindowEvent::CloseRequested { .. } => {
                if window.label() == "main" {
                    window.app_handle().exit(0);
                }
            }
            _ => {}
        })
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            start_clicking,
            start_multi_clicking,
            stop_clicking,
            check_permissions,
            play_macro,
            stop_macro,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
