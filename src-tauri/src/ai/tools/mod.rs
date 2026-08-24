pub mod echo;

use serde_json::Value;

#[derive(Debug)]
pub enum ToolError {
    InvalidInput(String),
    Execution(String),
}

impl std::fmt::Display for ToolError {
    fn fmt(
        &self,
        f: &mut std::fmt::Formatter<'_>,
    ) -> std::fmt::Result {
        match self {
            Self::InvalidInput(message) => {
                write!(f, "Invalid input: {message}")
            }
            Self::Execution(message) => {
                write!(f, "Tool execution failed: {message}")
            }
        }
    }
}

impl std::error::Error for ToolError {}
