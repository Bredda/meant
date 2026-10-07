use tauri::State;

use crate::state::AppState;
use crate::vault::SecretStore;
use crate::vault::error::VaultError;
use crate::vault::secrets::{ProviderId, SecretStatus};

/// Presence-only inventory of provider credentials.
///
/// The vault is the single source of truth for "which providers are
/// configured", so nothing about it is mirrored into `config.toml`. Key
/// material never crosses the IPC boundary — there is deliberately no command
/// that reads a secret back out.
#[tauri::command]
pub fn list_secrets(state: State<'_, AppState>) -> Result<Vec<SecretStatus>, VaultError> {
    ProviderId::ALL
        .iter()
        .map(|&provider| {
            let is_set = state.vault.get_secret(provider.secret_key())?.is_some();
            Ok(SecretStatus { provider, is_set })
        })
        .collect()
}

#[derive(serde::Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct SetSecretRequest {
    pub provider: ProviderId,
    pub value: String,
}

#[tauri::command]
pub async fn set_secret(
    state: State<'_, AppState>,
    request: SetSecretRequest,
) -> Result<(), VaultError> {
    let value = request.value.trim();

    if !request.provider.accepts(value) {
        return Err(VaultError::InvalidFormat(
            request.provider.label().to_string(),
        ));
    }

    state
        .vault
        .set_secret(request.provider.secret_key(), value)?;

    // A new key must take effect without restarting the app.
    state.invalidate_agent(request.provider).await;

    Ok(())
}

#[derive(serde::Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct DeleteSecretRequest {
    pub provider: ProviderId,
}

#[tauri::command]
pub async fn delete_secret(
    state: State<'_, AppState>,
    request: DeleteSecretRequest,
) -> Result<(), VaultError> {
    // Setup requires at least one provider; enforce that invariant here too,
    // so the app can never be driven into a keyless state from /settings.
    let has_another = ProviderId::ALL
        .iter()
        .filter(|&&provider| provider != request.provider)
        .map(|&provider| state.vault.get_secret(provider.secret_key()))
        .collect::<Result<Vec<_>, _>>()?
        .into_iter()
        .any(|secret| secret.is_some());

    if !has_another {
        return Err(VaultError::LastProvider);
    }

    state.vault.delete_secret(request.provider.secret_key())?;
    state.invalidate_agent(request.provider).await;

    Ok(())
}
