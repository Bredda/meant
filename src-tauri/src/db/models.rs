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
}
