mod model;

use crate::storage::{codec::TomlCodec, file_store::AtomicFileStore};
pub use model::{validate_username, AppConfig, Theme};
use std::path::Path;

pub fn config_store(app_data_dir: &Path) -> AtomicFileStore<AppConfig, TomlCodec> {
    AtomicFileStore::new(app_data_dir.join("config.toml"))
}
