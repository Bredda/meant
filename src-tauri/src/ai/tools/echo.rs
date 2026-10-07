use crate::ai::tools::ToolError;

#[rig::tool_macro(description = "Echo the provided text", required(text))]
pub async fn echo(text: String) -> Result<String, ToolError> {
    // A business failure: the model gets this message as the tool's result and
    // can correct itself, the run goes on.
    if text.is_empty() {
        return Err(ToolError::InvalidInput(
            "text must not be empty".to_string(),
        ));
    }

    Ok(text)
}
