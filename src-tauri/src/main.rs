// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod ai;
mod commands;
mod db;
mod state;
mod runs;
mod config;
mod storage;

use tauri::{Emitter, Manager};

use db::ThreadRepository;
use state::AppState;

use crate::{ai::agent::react::ReActAgent, config::config_store, runs::service::RunService};


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
            let store = config_store(&app_data_dir);

            let threads = 
                ThreadRepository::new(&app_data_dir)
            .   expect("Failed to initialize database");

            match store.load() {
                Ok(Some(config)) => {
                    println!("config-loaded");
                    app.handle().emit("config-loaded", &config)?;
                }
                Ok(None) => {
                    println!("config-missing");
                    app.handle().emit("config-missing", ())?;
                }
                Err(err) => {
                    println!("config-error");
                    app.handle().emit("config-error", err.to_string())?;
                    
                }
            }
            let agent = ReActAgent::new().expect("Failed to initialize AI agent");

            app.manage(AppState {
                agent: RunService::new(agent),
                threads,
                config_store: store,
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::chat::chat,
            commands::get_thread_messages::get_thread_messages,
            commands::list_threads::list_threads,
            commands::get_thread::get_thread,
            commands::update_config::update_config,
            ]
        
        )
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
