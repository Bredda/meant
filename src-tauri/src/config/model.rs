use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Theme {
    Light,
    Dark,
    #[default]
    System,
}

#[derive(Debug, Serialize, Deserialize, PartialEq)]
pub struct AppConfig {
    #[serde(default)]
    pub theme: Theme,
    #[serde(default = "default_username")]
    pub username: String,
    // future non-secret preferences go here
}

// Written by hand so a config created from scratch (`AtomicFileStore::update`
// on first run) gets the same values as a file missing those keys.
impl Default for AppConfig {
    fn default() -> Self {
        Self {
            theme: Theme::default(),
            username: default_username(),
        }
    }
}

fn default_username() -> String {
    "username".to_string()
}

/// Same rule as `preferencesSchema` in `src/lib/schemas.ts`: the form checks
/// it for feedback, this is the check that counts.
pub fn validate_username(username: &str) -> Result<(), String> {
    let length = username.chars().count();
    if !(3..=10).contains(&length) {
        return Err("Username must be between 3 and 10 characters.".into());
    }
    if !username
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || c == '_')
    {
        return Err("Username can only contain letters, numbers, and underscores.".into());
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_matches_serde_defaults() {
        let from_empty_file: AppConfig = toml::from_str("").unwrap();

        assert_eq!(AppConfig::default(), from_empty_file);
        assert_eq!(AppConfig::default().theme, Theme::System);
    }

    #[test]
    fn existing_config_files_still_decode() {
        let config: AppConfig = toml::from_str("theme = \"dark\"\nusername = \"neo\"\n").unwrap();

        assert_eq!(config.theme, Theme::Dark);
    }

    #[test]
    fn unknown_theme_is_rejected() {
        assert!(toml::from_str::<AppConfig>("theme = \"sepia\"").is_err());
    }

    #[test]
    fn username_rule() {
        assert!(validate_username("neo_42").is_ok());
        for invalid in ["ab", "abcdefghijk", "with space", "dash-ed", "é_tienne"] {
            assert!(validate_username(invalid).is_err(), "{invalid}");
        }
    }
}
