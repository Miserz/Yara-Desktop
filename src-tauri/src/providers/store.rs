use std::fs;
use std::path::PathBuf;

use tauri::Manager;

use super::types::AppData;

pub struct Store {
    path: PathBuf,
    pub data: AppData,
}

impl Store {
    pub fn load(app: &tauri::AppHandle) -> Result<Self, String> {
        let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
        fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
        let path = dir.join("providers.json");
        let data = fs::read_to_string(&path)
            .ok()
            .and_then(|content| serde_json::from_str(&content).ok())
            .unwrap_or_default();
        Ok(Self { path, data })
    }

    pub fn save(&self) -> Result<(), String> {
        let content = serde_json::to_string_pretty(&self.data).map_err(|e| e.to_string())?;
        fs::write(&self.path, content).map_err(|e| e.to_string())
    }
}
