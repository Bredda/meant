use tauri::State;

use crate::{
    config::{validate_username, AppConfig, Theme},
    error::AppError,
    state::AppState,
};

#[derive(serde::Deserialize, Debug)]
pub struct UpdateConfigRequest {
    pub theme: Option<Theme>,
    pub username: Option<String>,
}

#[tauri::command]
pub async fn update_config(
    state: State<'_, AppState>,
    request: UpdateConfigRequest,
) -> Result<AppConfig, AppError> {
    if let Some(username) = &request.username {
        validate_username(username).map_err(AppError::InvalidInput)?;
    }

    Ok(state.config_store.update(move |config| {
        if let Some(theme) = request.theme {
            config.theme = theme;
        }
        if let Some(username) = request.username {
            config.username = username;
        }
    })?)
}
