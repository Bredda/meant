// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod ai;
mod commands;
mod db;
mod state;
mod runs;
mod config;
mod storage;
mod vault;

use tauri::Manager;

use db::ThreadRepository;
use state::AppState;

use crate::{
    ai::agent::react::ReActAgent, 
    config::config_store, 
    runs::service::RunService, 
    vault::{
        error::VaultError, 
        keyring_store::KeyringStore}
};

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
            let vault  = KeyringStore::new("meant");
                ThreadRepository::new(&app_data_dir)
            .   expect("Failed to initialize database");
            let threads = 
                ThreadRepository::new(&app_data_dir)
            .   expect("Failed to initialize database");
            let agent = ReActAgent::new().expect("Failed to initialize AI agent");
            app.manage(AppState {
                agent: RunService::new(agent),
                threads,
                vault,
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
            commands::setup::check_vault,
            commands::setup::load_config,
            ]
        
        )
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
