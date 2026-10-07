use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, PartialEq)]
pub struct AppConfig {
    #[serde(default = "default_theme")]
    pub theme: String,
    #[serde(default = "default_username")]
    pub username: String,
    // future non-secret preferences go here
}

// Written by hand so a config created from scratch (`AtomicFileStore::update`
// on first run) gets the same values as a file missing those keys.
impl Default for AppConfig {
    fn default() -> Self {
        Self {
            theme: default_theme(),
            username: default_username(),
        }
    }
}

fn default_theme() -> String {
    "system".to_string()
}
fn default_username() -> String {
    "username".to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_matches_serde_defaults() {
        let from_empty_file: AppConfig = toml::from_str("").unwrap();

        assert_eq!(AppConfig::default(), from_empty_file);
        assert_eq!(AppConfig::default().theme, "system");
    }
}
