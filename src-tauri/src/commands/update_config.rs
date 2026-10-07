use tauri::State;

use crate::{config::AppConfig, state::AppState, storage::error::StoreError};

#[derive(serde::Deserialize, Debug)]
pub struct UpdateConfigRequest {
    pub theme: Option<String>,
    pub username: Option<String>,
}

#[tauri::command]
pub async fn update_config(
    state: State<'_, AppState>,
    request: UpdateConfigRequest,
) -> Result<AppConfig, StoreError> {
    state.config_store.update(move |config| {
        if let Some(theme) = request.theme {
            config.theme = theme;
        }
        if let Some(username) = request.username {
            config.username = username;
        }
    })
}
