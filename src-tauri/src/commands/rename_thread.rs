use tauri::State;

use crate::{db::models::Thread, error::AppError, AppState};

const MAX_TITLE_CHARS: usize = 120;

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RenameThreadRequest {
    pub thread_id: String,
    pub title: String,
}

#[tauri::command]
pub fn rename_thread(
    state: State<'_, AppState>,
    request: RenameThreadRequest,
) -> Result<Thread, AppError> {
    let title = validate_title(&request.title)?;

    state
        .threads
        .rename_thread(&request.thread_id, &title)?
        .ok_or_else(|| AppError::NotFound(format!("Thread {}", request.thread_id)))
}

fn validate_title(raw: &str) -> Result<String, AppError> {
    let title = raw.trim();

    if title.is_empty() {
        return Err(AppError::InvalidInput("The title cannot be empty".into()));
    }
    if title.chars().count() > MAX_TITLE_CHARS {
        return Err(AppError::InvalidInput(format!(
            "The title is limited to {MAX_TITLE_CHARS} characters"
        )));
    }

    Ok(title.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn titles_are_trimmed() {
        assert_eq!(validate_title("  Notes  ").unwrap(), "Notes");
    }

    #[test]
    fn blank_and_oversized_titles_are_rejected() {
        assert!(validate_title("   ").is_err());
        assert!(validate_title(&"a".repeat(MAX_TITLE_CHARS + 1)).is_err());
        assert!(validate_title(&"a".repeat(MAX_TITLE_CHARS)).is_ok());
    }
}
