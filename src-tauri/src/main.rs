// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod ai;
mod commands;
mod config;
mod db;
mod runs;
mod state;
mod storage;
mod vault;

use tauri::Manager;

use db::ThreadRepository;
use state::AppState;

use crate::{config::config_store, vault::keyring_store::KeyringStore};

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            let app_data_dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&app_data_dir)?;
            let store = config_store(&app_data_dir);
            let vault = KeyringStore::new("meant");
            let threads =
                ThreadRepository::new(&app_data_dir).expect("Failed to initialize database");

            // The agent is not built here: on a fresh install no API key exists
            // yet. AppState builds it lazily from the vault on the first run.
            app.manage(AppState::new(threads, store, vault));

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
            commands::secrets::list_secrets,
            commands::secrets::set_secret,
            commands::secrets::delete_secret
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
