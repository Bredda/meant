use tauri::State;
use crate::AppState;
use crate::VaultError;
use crate::config::AppConfig;
use crate::storage::error::StoreError;
use crate::vault::SecretStore;

#[tauri::command]
pub fn check_vault(state: State<'_, AppState>) -> Result<(), VaultError> {
    state.vault.get_secret("__vault_probe__").map(|_| ())
}

#[tauri::command]
pub fn load_config(state: State<'_, AppState>) -> Result<Option<AppConfig>, StoreError> {
    state.config_store.load()
}