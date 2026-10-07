use tauri::State;

use crate::AppState;

/// Asks a run to stop. The run ends on its own terms: it stores what it has
/// produced and its `chat` call resolves with a `RunCompleted` event whose
/// status is `cancelled`. A run that already ended is not an error.
#[tauri::command]
pub fn cancel_run(state: State<'_, AppState>, run_id: String) {
    state.runs.cancel(&run_id);
}
