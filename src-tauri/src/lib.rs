use tauri::Manager;
use tauri_plugin_shell::ShellExt;

struct SidecarState(std::sync::Mutex<Option<tauri_plugin_shell::process::CommandChild>>);

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            let mut child_process = None;
            let shell = app.handle().shell();
            if let Ok(sidecar) = shell.sidecar("ai-habit-coach-backend") {
                if let Ok((_rx, child)) = sidecar.spawn() {
                    child_process = Some(child);
                    println!("✅ Successfully spawned Python FastAPI sidecar");
                } else {
                    eprintln!("❌ Failed to spawn Python FastAPI sidecar");
                }
            } else {
                eprintln!("❌ Sidecar configuration for ai-habit-coach-backend not found");
            }

            app.manage(SidecarState(std::sync::Mutex::new(child_process)));
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            if let tauri::RunEvent::Exit = event {
                // Kill the sidecar when exiting
                if let Some(state) = app_handle.try_state::<SidecarState>() {
                    if let Ok(mut lock) = state.0.lock() {
                        if let Some(child) = lock.take() {
                            let _ = child.kill();
                            println!("🧹 Successfully terminated Python FastAPI sidecar");
                        }
                    }
                }
            }
        });
}
