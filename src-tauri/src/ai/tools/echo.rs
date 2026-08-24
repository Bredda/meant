use crate::ai::tools::ToolError;

#[rig::tool_macro(
    description = "Echo the provided text",
    required(text)
)]
pub async fn echo(
    text: String,
) -> Result<String, ToolError> {
    Ok(text)
    // Error throwing
    // Err(ToolError::Execution("Unexpected error".to_string()))
}