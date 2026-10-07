use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Default, PartialEq)]
pub struct AppConfig {
    #[serde(default = "default_theme")]
    pub theme: String,
    #[serde(default = "default_username")]
    pub username: String
    // future non-secret preferences go here
}

fn default_theme() -> String {
    "system".to_string()
}
fn default_username() -> String {
    "username".to_string()
}