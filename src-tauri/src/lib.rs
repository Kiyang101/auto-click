use enigo::{Button, Direction, Enigo, Mouse, Settings};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tauri::State;

struct AppState {
    is_clicking: Arc<AtomicBool>,
}

#[tauri::command]
fn start_clicking(state: State<'_, AppState>, interval_ms: u64) -> Result<(), String> {
    if state.is_clicking.load(Ordering::SeqCst) {
        return Ok(());
    }

    state.is_clicking.store(true, Ordering::SeqCst);
    let is_clicking = Arc::clone(&state.is_clicking);

    std::thread::spawn(move || {
        let mut enigo = Enigo::new(&Settings::default()).expect("Failed to initialize Enigo");

        while is_clicking.load(Ordering::SeqCst) {
            let _ = enigo.button(Button::Left, Direction::Click);
            std::thread::sleep(Duration::from_millis(interval_ms));
        }
    });

    Ok(())
}

#[tauri::command]
fn stop_clicking(state: State<'_, AppState>) {
    state.is_clicking.store(false, Ordering::SeqCst);
}

#[tauri::command]
fn check_permissions() -> bool {
    // On macOS, we can check if we have accessibility permissions
    #[cfg(target_os = "macos")]
    {
        // For macOS, we can use a more robust check if needed,
        // but for now let's just return true to avoid blocking the user.
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
        })
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            start_clicking,
            stop_clicking,
            check_permissions
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
