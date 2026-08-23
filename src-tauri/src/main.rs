// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod ai;
mod commands;
mod db;
mod state;

use tauri::Manager;

use ai::agent::AgentService;
use db::ThreadRepository;
use state::AppState;



fn main() {
     #[cfg(debug_assertions)]
    {
        dotenvy::dotenv().ok();
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            let app_data_dir = app.path().app_data_dir()?;

            std::fs::create_dir_all(&app_data_dir)?;

            let database_path = app_data_dir.join("meant.db");

            let threads = ThreadRepository::new(
                database_path
                    .to_str()
                    .expect("Invalid database path"),
            )
            .expect("Failed to initialize database");

            let agent =
                AgentService::new().expect("Failed to initialize AI agent");

            app.manage(AppState {
                agent,
                threads,
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::chat::chat,
            commands::get_thread_messages::get_thread_messages,
            commands::list_threads::list_threads,
            commands::get_thread::get_thread
            ]
        
        )
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
