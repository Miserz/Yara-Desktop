use std::time::Duration;

use tauri::AppHandle;
use tauri::Emitter;
use tokio::select;
use tokio::time::timeout;

use super::commands::GenerationRecord;
use super::sse::SseParser;
use super::types::{
	ChatMessage, ChatRequest, ChunkPayload, DeltaEvent, DeltaKind, DoneEvent,
	ErrorEvent, Usage,
};
use crate::providers::store::Store;

/// How long a chunk of silence on an established stream is tolerated
/// before the generation is considered dead.
const STREAM_IDLE_TIMEOUT: Duration = Duration::from_secs(120);
/// Connection establishment (DNS + TCP + TLS) budget.
const CONNECT_TIMEOUT: Duration = Duration::from_secs(30);
/// How many times a failed send is retried (transient 5xx / connect errors).
const SEND_ATTEMPTS: u32 = 2;

/// Names of the events emitted to the frontend. Payloads: `DeltaEvent`,
/// `DoneEvent`, `ErrorEvent` (all carry `requestId`).
pub const DELTA_EVENT: &str = "chat://delta";
pub const DONE_EVENT: &str = "chat://done";
pub const ERROR_EVENT: &str = "chat://error";
/// Emitted when the chat list changes behind the frontend's back
/// (LLM title saved after the done event). Payload: `{ chatId }`.
pub const CHATS_UPDATED_EVENT: &str = "chat://chats-updated";

fn chat_url(base_url: &str) -> String {
	format!("{}/chat/completions", base_url.trim_end_matches('/'))
}

/// Streaming outcome reported back to the command layer.
pub enum StreamOutcome {
	Done(Option<Usage>),
	Cancelled,
}

/// Runs a streaming chat completion against an OpenAI-compatible provider,
/// emitting `chat://delta` events to the frontend as text arrives. Every
/// delta is also appended to the record so the DB save on completion (and
/// `get_active_generation` for reload restores) sees the full text.
/// Returns `Ok(StreamOutcome::Cancelled)` when the user stops generation.
pub async fn stream_chat(
	app: &AppHandle,
	request_id: &str,
	request: &ChatRequest,
	messages: &[ChatMessage],
	record: &GenerationRecord,
) -> Result<StreamOutcome, String> {
	let cancel = record.cancel.clone();
	let (base_url, api_key) = resolve_provider(app, &request.provider_id)?;

	let mut body = serde_json::json!({
		"model": request.model_id,
		"messages": messages,
		"stream": true,
		"stream_options": { "include_usage": true },
	});
	// Only send temperature when set; `null` is rejected by some providers.
	if let Some(temperature) = request.temperature {
		body["temperature"] = serde_json::json!(temperature);
	}

	// Some gateways (b.ai, tokenrouter) reject or throttle requests without
	// a User-Agent via their WAF — observed as mid-stream disconnects.
	// HTTP/1.1 on purpose: TokenRouter's h2 + rustls negotiation hangs
	// ("operation timed out" with no response); SSE over HTTP/1.1 is fully
	// supported and avoids the whole class of h2 streaming issues.
	let client = reqwest::Client::builder()
		.user_agent(concat!("Yara/", env!("CARGO_PKG_VERSION")))
		.http1_only()
		.connect_timeout(CONNECT_TIMEOUT)
		.build()
		.map_err(|e| e.to_string())?;

	crate::logging::info(
		app,
		"http",
		"Chat completion request",
		Some(serde_json::json!({
			"model": request.model_id,
			"providerId": request.provider_id,
			"url": chat_url(&base_url),
			"messageCount": messages.len(),
		})),
	);

	// Transient failures (free-tier rate limits, upstream 5xx, connect
	// timeouts) get one retry before surfacing the error.
	let mut response = None;
	let mut last_error = String::new();
	for attempt in 1..=SEND_ATTEMPTS {
		match client
			.post(chat_url(&base_url))
			.bearer_auth(&api_key)
			.json(&body)
			.send()
			.await
		{
			Ok(r) => {
				response = Some(r);
				break;
			}
			Err(e) => {
				last_error = e.to_string();
				crate::logging::warn(
					app,
					"http",
					format!("Send failed (attempt {attempt}/{SEND_ATTEMPTS})"),
					Some(serde_json::json!({ "error": last_error })),
				);
			}
		}
	}
	let mut response = response.ok_or_else(|| {
		crate::logging::error(
			app,
			"http",
			format!("Request failed after {SEND_ATTEMPTS} attempts"),
			Some(serde_json::json!({ "error": last_error })),
		);
		format!("Request failed: {last_error}")
	})?;

	if !response.status().is_success() {
		let status = response.status();
		let detail = response.text().await.unwrap_or_default();
		crate::logging::error(
			app,
			"http",
			format!("Provider returned status {status}"),
			Some(serde_json::json!({
				"status": status.as_u16(),
				"body": detail.chars().take(500).collect::<String>(),
			})),
		);
		return Err(format!("Provider returned status {status}: {detail}"));
	}

	let mut parser = SseParser::new();
	let mut usage: Option<Usage> = None;
	let mut delta_count: u64 = 0;
	let mut reasoning_count: u64 = 0;

	let result = loop {
		let chunk: Result<Option<bytes::Bytes>, reqwest::Error> = select! {
			_ = cancel.cancelled() => return Ok(StreamOutcome::Cancelled),
			// A silent stream means the provider died mid-generation; fail
			// loudly instead of leaving the UI streaming forever.
			_ = timeout(STREAM_IDLE_TIMEOUT, tokio::time::sleep(STREAM_IDLE_TIMEOUT)) => {
				break Err("Stream timed out: no data received from provider".to_string());
			}
			chunk = response.chunk() => chunk,
		};
		match chunk {
			Ok(Some(bytes)) => {
				let text = String::from_utf8_lossy(&bytes);
				for event in parser.feed(&text) {
					match super::types::parse_chunk(&event) {
						Ok(Some(ChunkPayload::Delta(delta, kind))) => {
							match kind {
								DeltaKind::Content => delta_count += 1,
								DeltaKind::Reasoning => reasoning_count += 1,
							}
							emit_delta(app, request_id, &record, delta, kind);
						}
						Ok(Some(ChunkPayload::Usage(u))) => usage = Some(u),
						Ok(Some(ChunkPayload::Error(message))) => {
							// Gateways can inject error chunks mid-stream;
							// treat them as failures instead of a silent end.
							crate::logging::error(
								app,
								"chat",
								"Mid-stream error chunk",
								Some(serde_json::json!({ "message": message })),
							);
							return Err(message);
						}
						Ok(None) => { /* [DONE] marker */ }
						Err(e) => return Err(e),
					}
				}
			}
			Ok(None) => break Ok(()), // End of stream
			Err(e) => break Err(format!("Stream failed: {e}")),
		}
	};

	if let Err(message) = result {
		return Err(message);
	}

	if let Some(event) = parser.finish() {
		match super::types::parse_chunk(&event) {
			Ok(Some(ChunkPayload::Delta(delta, kind))) => {
				emit_delta(app, request_id, &record, delta, kind);
			}
			Ok(Some(ChunkPayload::Usage(u))) => usage = Some(u),
			Ok(Some(ChunkPayload::Error(message))) => return Err(message),
			_ => {}
		}
	}

	Ok(StreamOutcome::Done(usage).tap_log(app, request_id, delta_count, reasoning_count, &record))
}

/// Summary helper: logs stream completion stats.
trait TapLog {
	fn tap_log(
		self,
		app: &AppHandle,
		request_id: &str,
		deltas: u64,
		reasoning: u64,
		record: &GenerationRecord,
	) -> Self;
}

impl TapLog for StreamOutcome {
	fn tap_log(
		self,
		app: &AppHandle,
		request_id: &str,
		deltas: u64,
		reasoning: u64,
		record: &GenerationRecord,
	) -> Self {
		crate::logging::info(
			app,
			"chat",
			"Stream complete",
			Some(serde_json::json!({
				"requestId": request_id,
				"contentDeltas": deltas,
				"reasoningDeltas": reasoning,
				"contentChars": record.acccumulated_text().len(),
				"reasoningChars": record.reasoning_text().len(),
			})),
		);
		self
	}
}

/// Emits a delta to the frontend and accumulates it for the final DB save.
/// Reasoning deltas go to their own buffer; only content reaches the DB's
/// `content` column, reasoning is stored alongside as `reasoning`.
fn emit_delta(
	app: &AppHandle,
	request_id: &str,
	record: &GenerationRecord,
	text: String,
	kind: DeltaKind,
) {
	let buffer = match kind {
		DeltaKind::Content => &record.accumulated,
		DeltaKind::Reasoning => &record.reasoning,
	};
	if let Ok(mut accumulated) = buffer.lock() {
		accumulated.push_str(&text);
	}
	let _ = app.emit(DELTA_EVENT, DeltaEvent {
		request_id: request_id.to_string(),
		text,
		kind,
	});
}

fn resolve_provider(app: &AppHandle, provider_id: &str) -> Result<(String, String), String> {
	use std::sync::Mutex;
	use tauri::Manager;

	let state = app.state::<Mutex<Store>>();
	let store = state.lock().map_err(|e| e.to_string())?;
	let provider = store
		.data
		.providers
		.iter()
		.find(|item| item.id == provider_id)
		.ok_or_else(|| "Provider not found".to_string())?;
	Ok((provider.base_url.clone(), provider.api_key.clone()))
}

/// Emits the completion event for a finished generation.
pub fn emit_done(app: &AppHandle, request_id: &str, usage: Option<Usage>) {
	let _ = app.emit(DONE_EVENT, DoneEvent {
		request_id: request_id.to_string(),
		usage,
	});
}

/// Emits the error/cancel event for a failed or stopped generation.
pub fn emit_error(app: &AppHandle, request_id: &str, message: String, cancelled: bool) {
	let _ = app.emit(ERROR_EVENT, ErrorEvent {
		request_id: request_id.to_string(),
		message,
		cancelled,
	});
}
