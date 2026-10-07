use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Thread {
    pub id: String,
    pub title: String,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StoredThreadMessage {
    pub id: String,
    pub position: i64,
    pub created_at: i64,
    pub thread_id: String,
    /// The run that produced this message; `None` for rows older than runs.
    pub run_id: Option<String>,

    /// user | assistant | tool_call | tool_result
    pub role: String,

    /// Text content for user/assistant messages.
    /// JSON payload for tool_call/tool_result.
    pub content: String,

    /* Tools specifics */
    /// Links a tool result to its originating tool call.
    pub tool_call_id: Option<String>,

    /// Tool name for tool_call/tool_result messages.
    pub tool_name: Option<String>,

    /// A `tool_result` that records a failed call; `false` for every other role.
    pub is_error: bool,
}

/// A message to insert; position and timestamps are assigned by the repository.
#[derive(Debug, Clone)]
pub struct NewMessage {
    pub id: String,
    /// user | assistant | tool_call | tool_result
    pub role: &'static str,
    pub content: String,
    pub tool_call_id: Option<String>,
    pub tool_name: Option<String>,
    pub is_error: bool,
}

/// A stored run as the UI shows it: the outcome of one agent execution.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RunSummary {
    pub id: String,
    pub provider: String,
    pub model: String,
    /// running | completed | failed (see `RunStatus::as_str`)
    pub status: String,
    pub error: Option<String>,
    pub started_at: i64,
    pub ended_at: Option<i64>,
}

#[derive(Debug, Clone)]
pub struct NewRun {
    pub id: String,
    pub thread_id: String,
    pub provider: String,
    pub model: String,
}
