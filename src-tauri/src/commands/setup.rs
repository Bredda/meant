use crate::config::AppConfig;
use crate::error::AppError;
use crate::state::AppState;
use crate::vault::SecretStore;
use tauri::State;

#[tauri::command]
pub fn check_vault(state: State<'_, AppState>) -> Result<(), AppError> {
    state.vault.get_secret("__vault_probe__")?;
    Ok(())
}

#[tauri::command]
pub fn load_config(state: State<'_, AppState>) -> Result<Option<AppConfig>, AppError> {
    Ok(state.config_store.load()?)
}
