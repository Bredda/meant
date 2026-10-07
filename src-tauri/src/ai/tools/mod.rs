pub mod echo;

// `Execution` is not constructed yet: real tools (roadmap axis 5) will use it.
#[allow(dead_code)]
#[derive(Debug)]
pub enum ToolError {
    InvalidInput(String),
    Execution(String),
}

impl std::fmt::Display for ToolError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
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
