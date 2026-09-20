use std::sync::Mutex;

use tauri::State;
use uuid::Uuid;

use super::client;
use super::store::Store;
use super::types::{AppData, ModelEntry, ModelRef, Provider, RemoteModel};

pub type StoreState = Mutex<Store>;

#[tauri::command]
pub fn get_data(state: State<'_, StoreState>) -> Result<AppData, String> {
    let store = state.lock().map_err(|e| e.to_string())?;
    Ok(store.data.clone())
}

#[tauri::command]
pub fn add_provider(
    state: State<'_, StoreState>,
    name: String,
    base_url: String,
    api_key: String,
) -> Result<Provider, String> {
    let mut store = state.lock().map_err(|e| e.to_string())?;
    let provider = Provider {
        id: Uuid::new_v4().to_string(),
        name,
        base_url,
        api_key,
    };
    store.data.providers.push(provider.clone());
    store.save()?;
    Ok(provider)
}

#[tauri::command]
pub fn update_provider(state: State<'_, StoreState>, provider: Provider) -> Result<(), String> {
    let mut store = state.lock().map_err(|e| e.to_string())?;
    let index = store
        .data
        .providers
        .iter()
        .position(|item| item.id == provider.id)
        .ok_or_else(|| "Provider not found".to_string())?;
    store.data.providers[index] = provider;
    store.save()
}

#[tauri::command]
pub fn remove_provider(state: State<'_, StoreState>, id: String) -> Result<(), String> {
    let mut store = state.lock().map_err(|e| e.to_string())?;
    store.data.providers.retain(|item| item.id != id);
    store.data.custom_models.retain(|item| item.provider_id != id);
    store
        .data
        .enabled_models
        .retain(|item| item.provider_id != id);
    if store
        .data
        .active_model
        .as_ref()
        .is_some_and(|model| model.provider_id == id)
    {
        store.data.active_model = None;
    }
    store.save()
}

#[tauri::command]
pub fn add_model(state: State<'_, StoreState>, model: ModelEntry) -> Result<(), String> {
    let mut store = state.lock().map_err(|e| e.to_string())?;
    let exists = store
        .data
        .custom_models
        .iter()
        .any(|item| item.provider_id == model.provider_id && item.id == model.id);
    if exists {
        return Err("Model already added".to_string());
    }
    store.data.custom_models.push(model);
    store.save()
}

#[tauri::command]
pub fn remove_model(
    state: State<'_, StoreState>,
    provider_id: String,
    model_id: String,
) -> Result<(), String> {
    let mut store = state.lock().map_err(|e| e.to_string())?;
    store
        .data
        .custom_models
        .retain(|item| !(item.provider_id == provider_id && item.id == model_id));
    store
        .data
        .enabled_models
        .retain(|item| !(item.provider_id == provider_id && item.model_id == model_id));
    if store.data.active_model.as_ref().is_some_and(|model| {
        model.provider_id == provider_id && model.model_id == model_id
    }) {
        store.data.active_model = None;
    }
    store.save()
}

#[tauri::command]
pub fn set_model_enabled(
    state: State<'_, StoreState>,
    provider_id: String,
    model_id: String,
    enabled: bool,
) -> Result<(), String> {
    let mut store = state.lock().map_err(|e| e.to_string())?;
    if enabled {
        let exists = store
            .data
            .enabled_models
            .iter()
            .any(|item| item.provider_id == provider_id && item.model_id == model_id);
        if !exists {
            store.data.enabled_models.push(ModelRef {
                provider_id,
                model_id,
            });
        }
    } else {
        store
            .data
            .enabled_models
            .retain(|item| !(item.provider_id == provider_id && item.model_id == model_id));
        if store.data.active_model.as_ref().is_some_and(|model| {
            model.provider_id == provider_id && model.model_id == model_id
        }) {
            store.data.active_model = None;
        }
    }
    store.save()
}

#[tauri::command]
pub fn set_active_model(
    state: State<'_, StoreState>,
    model: Option<ModelRef>,
) -> Result<(), String> {
    let mut store = state.lock().map_err(|e| e.to_string())?;
    store.data.active_model = model;
    store.save()
}

#[tauri::command]
pub fn set_enabled_models(
    state: State<'_, StoreState>,
    models: Vec<ModelRef>,
) -> Result<(), String> {
    let mut store = state.lock().map_err(|e| e.to_string())?;
    store.data.enabled_models = models;
    store.save()
}

#[tauri::command]
pub async fn fetch_remote_models(
    state: State<'_, StoreState>,
    provider_id: String,
) -> Result<Vec<RemoteModel>, String> {
    let (base_url, api_key) = {
        let store = state.lock().map_err(|e| e.to_string())?;
        let provider = store
            .data
            .providers
            .iter()
            .find(|item| item.id == provider_id)
            .ok_or_else(|| "Provider not found".to_string())?;
        (provider.base_url.clone(), provider.api_key.clone())
    };
    client::fetch_remote_models(&base_url, &api_key).await
}

#[tauri::command]
pub async fn test_provider(base_url: String, api_key: String) -> Result<(), String> {
    client::test_connection(&base_url, &api_key).await
}
