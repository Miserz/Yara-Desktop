use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Provider {
	pub id: String,
	pub name: String,
	pub base_url: String,
	pub api_key: String,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ModelEntry {
    pub provider_id: String,
    pub id: String,
    pub display_name: String,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct RemoteModel {
    pub id: String,
    #[serde(default)]
    pub name: Option<String>,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ModelRef {
    pub provider_id: String,
    pub model_id: String,
}

#[derive(Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct AppData {
    #[serde(default)]
    pub providers: Vec<Provider>,
    #[serde(default)]
    pub custom_models: Vec<ModelEntry>,
    #[serde(default)]
    pub enabled_models: Vec<ModelRef>,
    #[serde(default)]
    pub active_model: Option<ModelRef>,
}
