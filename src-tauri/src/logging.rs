use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use tauri::{Emitter, Manager};
use uuid::Uuid;

/// Log levels filterable in the developer console.
#[derive(Serialize, Deserialize, Clone, Copy, PartialEq, Eq, Debug)]
#[serde(rename_all = "lowercase")]
pub enum LogLevel {
	Debug,
	Info,
	Warn,
	Error,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct LogEntry {
	pub id: String,
	pub level: LogLevel,
	/// Coarse category shown as a filter chip: http, chat, db, app.
	pub category: String,
	pub message: String,
	/// Structured payload (request/response bodies, chunk counts, etc.).
	#[serde(skip_serializing_if = "Option::is_none")]
	pub data: Option<serde_json::Value>,
	pub timestamp: i64,
}

/// Bounded in-memory log buffer the dev console reads on open; live entries
/// are additionally pushed via the `log://entry` event.
const BUFFER_CAPACITY: usize = 1000;

pub struct LogBuffer {
	entries: Vec<LogEntry>,
}

impl Default for LogBuffer {
	fn default() -> Self {
		Self {
			entries: Vec::new(),
		}
	}
}

pub type LogState = Mutex<LogBuffer>;

fn now_millis() -> i64 {
	SystemTime::now()
		.duration_since(UNIX_EPOCH)
		.map(|d| d.as_millis() as i64)
		.unwrap_or(0)
}

/// Records a log entry: pushes it to the buffer (dropping the oldest when
/// full) and emits `log://entry` to any open developer console window.
pub fn log(
	app: &AppHandle,
	level: LogLevel,
	category: &str,
	message: impl Into<String>,
	data: Option<serde_json::Value>,
) {
	let entry = LogEntry {
		id: Uuid::new_v4().to_string(),
		level,
		category: category.to_string(),
		message: message.into(),
		data,
		timestamp: now_millis(),
	};
	if let Some(state) = app.try_state::<LogState>() {
		if let Ok(mut buffer) = state.lock() {
			if buffer.entries.len() >= BUFFER_CAPACITY {
				buffer.entries.remove(0);
			}
			buffer.entries.push(entry.clone());
		}
	}
	let _ = app.emit(LOG_EVENT, &entry);
}

pub const LOG_EVENT: &str = "log://entry";

pub fn info(
	app: &AppHandle,
	category: &str,
	message: impl Into<String>,
	data: Option<serde_json::Value>,
) {
	log(app, LogLevel::Info, category, message, data);
}

/// Reserved for future warning-level events.
#[allow(dead_code)]
pub fn warn(
	app: &AppHandle,
	category: &str,
	message: impl Into<String>,
	data: Option<serde_json::Value>,
) {
	log(app, LogLevel::Warn, category, message, data);
}

pub fn error(
	app: &AppHandle,
	category: &str,
	message: impl Into<String>,
	data: Option<serde_json::Value>,
) {
	log(app, LogLevel::Error, category, message, data);
}

#[tauri::command]
pub fn get_logs(state: tauri::State<'_, LogState>) -> Result<Vec<LogEntry>, String> {
	let buffer = state.lock().map_err(|e| e.to_string())?;
	Ok(buffer.entries.clone())
}

#[tauri::command]
pub fn clear_logs(state: tauri::State<'_, LogState>) -> Result<(), String> {
	let mut buffer = state.lock().map_err(|e| e.to_string())?;
	buffer.entries.clear();
	Ok(())
}
