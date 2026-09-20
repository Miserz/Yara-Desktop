use std::sync::Mutex;

use tauri::State;

use super::store::ChatsStore;
use super::types::{ChatMessageRow, ChatRow, SearchHit};

pub type ChatsState = Mutex<ChatsStore>;

fn now_millis() -> i64 {
	std::time::SystemTime::now()
		.duration_since(std::time::UNIX_EPOCH)
		.map(|d| d.as_millis() as i64)
		.unwrap_or(0)
}

#[tauri::command]
pub fn create_chat(state: State<'_, ChatsState>, id: String) -> Result<ChatRow, String> {
	let store = state.lock().map_err(|e| e.to_string())?;
	store.create_chat(&id, now_millis())
}

#[tauri::command]
pub fn list_chats(state: State<'_, ChatsState>) -> Result<Vec<ChatRow>, String> {
	let store = state.lock().map_err(|e| e.to_string())?;
	store.list_chats()
}

#[tauri::command]
pub fn delete_chat(state: State<'_, ChatsState>, id: String) -> Result<(), String> {
	let store = state.lock().map_err(|e| e.to_string())?;
	store.delete_chat(&id)
}

#[tauri::command]
pub fn rename_chat(
	state: State<'_, ChatsState>,
	id: String,
	title: String,
) -> Result<(), String> {
	let store = state.lock().map_err(|e| e.to_string())?;
	store.rename_chat(&id, &title)
}

#[tauri::command]
pub fn load_messages(
	state: State<'_, ChatsState>,
	chat_id: String,
) -> Result<Vec<ChatMessageRow>, String> {
	let store = state.lock().map_err(|e| e.to_string())?;
	store.load_messages(&chat_id)
}

#[tauri::command]
pub fn search_chats(
	app: tauri::AppHandle,
	state: State<'_, ChatsState>,
	query: String,
) -> Result<Vec<SearchHit>, String> {
	let store = state.lock().map_err(|e| e.to_string())?;
	let hits = store.search(&query)?;
	crate::logging::info(
		&app,
		"db",
		"Chat search",
		Some(serde_json::json!({
			"query": query,
			"hits": hits.len(),
		})),
	);
	Ok(hits)
}

/// Removes every chat with its messages. Settings → General → Clear data.
#[tauri::command]
pub fn clear_all_chats(
	app: tauri::AppHandle,
	state: State<'_, ChatsState>,
) -> Result<(), String> {
	let store = state.lock().map_err(|e| e.to_string())?;
	store.clear_all()?;
	crate::logging::warn(
		&app,
		"db",
		"All chats cleared by user",
		None,
	);
	Ok(())
}

/// Rewrites a message's content (message editing).
#[tauri::command]
pub fn edit_message(
	state: State<'_, ChatsState>,
	id: String,
	content: String,
) -> Result<(), String> {
	let store = state.lock().map_err(|e| e.to_string())?;
	store.edit_message(&id, &content)
}

/// Deletes a message and everything after it in the same chat
/// (edit / regenerate flows cut the branch before re-running).
#[tauri::command]
pub fn truncate_from(
	app: tauri::AppHandle,
	state: State<'_, ChatsState>,
	chat_id: String,
	message_id: String,
) -> Result<(), String> {
	let store = state.lock().map_err(|e| e.to_string())?;
	store.truncate_from(&chat_id, &message_id)?;
	crate::logging::info(
		&app,
		"db",
		"Truncated message branch",
		Some(serde_json::json!({ "chatId": chat_id, "fromMessage": message_id })),
	);
	Ok(())
}
