use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::State;

#[cfg(target_os = "macos")]
use core_graphics::event::{CGEvent, CGEventTapLocation, CGMouseButton, CGEventType};
#[cfg(target_os = "macos")]
use core_graphics::event_source::{CGEventSource, CGEventSourceStateID};
#[cfg(target_os = "macos")]
use core_graphics::geometry::CGPoint;

struct AppState {
    is_clicking: Arc<AtomicBool>,
    multi_clicking: Arc<AtomicBool>,
    click_lock: Arc<Mutex<()>>,
}

#[derive(serde::Deserialize, Debug, Clone)]
struct PointConfig {
    #[allow(dead_code)]
    id: String,
    x: i32,
    y: i32,
    interval: u64,
}

#[tauri::command]
fn start_clicking(state: State<'_, AppState>, interval_ms: u64) -> Result<(), String> {
    if state.is_clicking.load(Ordering::SeqCst) || state.multi_clicking.load(Ordering::SeqCst) {
        return Ok(());
    }

    state.is_clicking.store(true, Ordering::SeqCst);
    let is_clicking = Arc::clone(&state.is_clicking);
    let click_lock = Arc::clone(&state.click_lock);

    std::thread::spawn(move || {
        while is_clicking.load(Ordering::SeqCst) {
            #[cfg(target_os = "macos")]
            {
                if let Ok(source) = CGEventSource::new(CGEventSourceStateID::HIDSystemState) {
                    if let Ok(event) = CGEvent::new(source) {
                        let pos = event.location();
                        let _lock = click_lock.lock().unwrap();
                        post_click_at(pos.x, pos.y);
                    }
                }
            }
            #[cfg(not(target_os = "macos"))]
            {
                use enigo::{Button, Coordinate, Direction, Enigo, Mouse, Settings};
                let mut enigo = Enigo::new(&Settings::default()).unwrap();
                if let Ok(current_pos) = enigo.location() {
                    let _lock = click_lock.lock().unwrap();
                    let _ = enigo.button(Button::Left, Direction::Press);
                    let _ = enigo.button(Button::Left, Direction::Release);
                    let _ = enigo.move_mouse(current_pos.0, current_pos.1, Coordinate::Abs);
                } else {
                    let _lock = click_lock.lock().unwrap();
                    let _ = enigo.button(Button::Left, Direction::Click);
                }
            }
            std::thread::sleep(Duration::from_millis(interval_ms));
        }
    });

    Ok(())
}

#[cfg(target_os = "macos")]
fn post_click_at(x: f64, y: f64) {
    if let Ok(source) = CGEventSource::new(CGEventSourceStateID::HIDSystemState) {
        // Record the current mouse position before we do anything
        let current_pos = if let Ok(event) = CGEvent::new(source.clone()) {
            event.location()
        } else {
            CGPoint::new(x, y) // Fallback
        };

        let target_pos = CGPoint::new(x, y);

        let down_event = CGEvent::new_mouse_event(
            source.clone(),
            CGEventType::LeftMouseDown,
            target_pos,
            CGMouseButton::Left,
        );
        
        let up_event = CGEvent::new_mouse_event(
            source.clone(),
            CGEventType::LeftMouseUp,
            target_pos,
            CGMouseButton::Left,
        );

        if let (Ok(down), Ok(up)) = (down_event, up_event) {
            // Post the click at the target
            down.post(CGEventTapLocation::HID);
            up.post(CGEventTapLocation::HID);

            // Instantly and SILENTLY restore the cursor to where the user had it.
            // CGDisplayMoveCursorToPoint generates events, CGWarpMouseCursorPosition does NOT.
            // This prevents the flickering/warping loop.
            unsafe {
                core_graphics::display::CGWarpMouseCursorPosition(current_pos);
            }
        }
    }
}

#[cfg(not(target_os = "macos"))]
fn post_click_at(x: f64, y: f64) {
    // Fallback for non-macOS (still warps for now, but avoids compile error)
    use enigo::{Button, Coordinate, Direction, Enigo, Mouse, Settings};
    let mut enigo = Enigo::new(&Settings::default()).unwrap();
    
    // Save current position
    if let Ok(current_pos) = enigo.location() {
        // Move to target
        let _ = enigo.move_mouse(x as i32, y as i32, Coordinate::Abs);
        
        // Click
        let _ = enigo.button(Button::Left, Direction::Press);
        let _ = enigo.button(Button::Left, Direction::Release);
        
        // Restore position
        let _ = enigo.move_mouse(current_pos.0, current_pos.1, Coordinate::Abs);
    } else {
        // Fallback if we can't get current position
        let _ = enigo.move_mouse(x as i32, y as i32, Coordinate::Abs);
        let _ = enigo.button(Button::Left, Direction::Click);
    }
}

#[tauri::command]
fn start_multi_clicking(state: State<'_, AppState>, points: Vec<PointConfig>) -> Result<(), String> {
    if state.is_clicking.load(Ordering::SeqCst) || state.multi_clicking.load(Ordering::SeqCst) {
        return Ok(());
    }

    state.multi_clicking.store(true, Ordering::SeqCst);
    println!("Multi-clicking started with {} points", points.len());

    for point in points {
        let multi_clicking = Arc::clone(&state.multi_clicking);
        let click_lock = Arc::clone(&state.click_lock);
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
    #[cfg(target_os = "macos")]
    {
        return true;
    }
    #[cfg(not(target_os = "macos"))]
    {
        true
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .manage(AppState {
            is_clicking: Arc::new(AtomicBool::new(false)),
            multi_clicking: Arc::new(AtomicBool::new(false)),
            click_lock: Arc::new(Mutex::new(())),
        })
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            start_clicking,
            start_multi_clicking,
            stop_clicking,
            check_permissions
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
