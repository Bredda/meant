use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Default, PartialEq)]
pub struct AppConfig {
    #[serde(default = "default_theme")]
    pub theme: String,
    // future non-secret preferences go here
}

fn default_theme() -> String {
    "system".to_string()
}