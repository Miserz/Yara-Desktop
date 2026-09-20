use serde::{Deserialize, Serialize};

use super::sse::SseEvent;

#[derive(Serialize, Deserialize, Clone, Copy, PartialEq, Eq, Debug)]
#[serde(rename_all = "lowercase")]
pub enum ChatRole {
	User,
	Assistant,
	System,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ChatMessage {
	pub role: ChatRole,
	pub content: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ChatRequest {
	pub provider_id: String,
	pub model_id: String,
	#[serde(default)]
	pub messages: Vec<ChatMessage>,
	#[serde(default)]
	pub temperature: Option<f64>,
	/// False when the trailing user message is already persisted (edit /
	/// regenerate flows) — `start_chat` then skips saving it again.
	/// Absent = true: plain sends keep persisting.
	#[serde(default)]
	pub persist_user: Option<bool>,
}

/// Incrementally emitted to the frontend while a generation is running.
/// `kind` distinguishes reasoning tokens (extended thinking) from content.
#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct DeltaEvent {
	pub request_id: String,
	pub text: String,
	#[serde(default)]
	pub kind: DeltaKind,
}

#[derive(Serialize, Deserialize, Clone, Copy, PartialEq, Eq, Debug, Default)]
#[serde(rename_all = "lowercase")]
pub enum DeltaKind {
	#[default]
	Content,
	Reasoning,
}

/// Emitted once when generation completes normally.
#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct DoneEvent {
	pub request_id: String,
	/// Number of tokens the provider reports as consumed (if known).
	#[serde(skip_serializing_if = "Option::is_none")]
	pub usage: Option<Usage>,
}

/// Emitted when generation fails or is cancelled by the user.
#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ErrorEvent {
	pub request_id: String,
	pub message: String,
	/// True when generation was stopped by the user, not failed.
	#[serde(default)]
	pub cancelled: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
#[serde(rename_all = "camelCase")]
pub struct Usage {
	#[serde(default)]
	pub prompt_tokens: Option<u64>,
	#[serde(default)]
	pub completion_tokens: Option<u64>,
	#[serde(default)]
	pub total_tokens: Option<u64>,
}

/// Extracts the text delta from an OpenAI-compatible stream chunk.
/// Returns `None` for chunks with no content (e.g. role-only first chunk).
///
/// Quirks handled (learned from opencode's transform layer and live probes):
/// - Some gateways (e.g. b.ai) always include an empty `content` string
///   alongside `reasoning_content`, so reasoning must be checked first and
///   empty strings must not short-circuit the lookup.
/// - OpenRouter uses `reasoning`, DeepSeek uses `reasoning_content`.
/// `Some(str)` for a non-empty JSON string field, `None` otherwise. Gateways
/// like b.ai always include `content: ""` next to reasoning, so empty values
/// must be treated as absent.
fn non_empty<'a>(value: Option<&'a serde_json::Value>) -> Option<&'a str> {
	value
		.and_then(|v| v.as_str())
		.filter(|s| !s.is_empty())
}

pub fn extract_delta(chunk: &serde_json::Value) -> Option<(String, DeltaKind)> {
	let delta = chunk.get("choices")?.get(0)?.get("delta")?;
	if let Some(text) = non_empty(
		delta
			.get("reasoning")
			.or_else(|| delta.get("reasoning_content")),
	) {
		return Some((text.to_string(), DeltaKind::Reasoning));
	}
	if let Some(text) = non_empty(delta.get("content")) {
		return Some((text.to_string(), DeltaKind::Content));
	}
	None
}

/// Detects mid-stream error chunks (`{"error": ...}` with no `choices`),
/// which some gateways send instead of a proper HTTP error status.
pub fn extract_error(chunk: &serde_json::Value) -> Option<String> {
	let has_choices = chunk
		.get("choices")
		.is_some_and(|c| !c.is_null() && c.as_array().is_some_and(|a| !a.is_empty()));
	if has_choices {
		return None;
	}
	let error = chunk.get("error")?;
	let message = error
		.get("message")
		.and_then(|m| m.as_str())
		.or_else(|| error.as_str())
		.unwrap_or("Unknown provider error");
	Some(message.to_string())
}

/// Extracts usage from the final chunk, if the provider reports it.
/// OpenRouter sends usage on the last chunk when `stream_options.include_usage`
/// is not used; OpenAI requires it. We collect it from any chunk that has it.
pub fn extract_usage(chunk: &serde_json::Value) -> Option<Usage> {
	let node = chunk.get("usage").filter(|u| !u.is_null())?;
	Some(Usage {
		prompt_tokens: node.get("prompt_tokens").and_then(|v| v.as_u64()),
		completion_tokens: node.get("completion_tokens").and_then(|v| v.as_u64()),
		total_tokens: node.get("total_tokens").and_then(|v| v.as_u64()),
	})
}

/// Maps a raw SSE event to a delta, a usage report, an error, or nothing.
pub enum ChunkPayload {
	Delta(String, DeltaKind),
	Usage(Usage),
	Error(String),
}

pub fn parse_chunk(event: &SseEvent) -> Result<Option<ChunkPayload>, String> {
	if event.data.trim() == "[DONE]" {
		return Ok(None);
	}
	let chunk: serde_json::Value = serde_json::from_str(&event.data)
		.map_err(|e| format!("Invalid chunk JSON: {e}"))?;
	if let Some(usage) = extract_usage(&chunk) {
		return Ok(Some(ChunkPayload::Usage(usage)));
	}
	if let Some(error) = extract_error(&chunk) {
		return Ok(Some(ChunkPayload::Error(error)));
	}
	Ok(extract_delta(&chunk)
		.map(|(text, kind)| ChunkPayload::Delta(text, kind)))
}

#[cfg(test)]
mod tests {
	use super::*;

	fn chunk(json: &str) -> SseEvent {
		SseEvent { data: json.to_string() }
	}

	#[test]
	fn parses_content_delta() {
		let payload = parse_chunk(&chunk(
			r#"{"choices":[{"delta":{"content":"hello"}}]}"#,
		))
		.unwrap()
		.unwrap();
		match payload {
			ChunkPayload::Delta(text, kind) => {
				assert_eq!(text, "hello");
				assert_eq!(kind, DeltaKind::Content);
			}
			_ => panic!("expected delta"),
		}
	}

	#[test]
	fn parses_openrouter_reasoning() {
		let payload = parse_chunk(&chunk(
			r#"{"choices":[{"delta":{"reasoning":"thinking..."}}]}"#,
		))
		.unwrap()
		.unwrap();
		match payload {
			ChunkPayload::Delta(text, kind) => {
				assert_eq!(text, "thinking...");
				assert_eq!(kind, DeltaKind::Reasoning);
			}
			_ => panic!("expected delta"),
		}
	}

	#[test]
	fn parses_deepseek_reasoning_content() {
		let payload = parse_chunk(&chunk(
			r#"{"choices":[{"delta":{"reasoning_content":"hmm"}}]}"#,
		))
		.unwrap()
		.unwrap();
		match payload {
			ChunkPayload::Delta(text, kind) => {
				assert_eq!(text, "hmm");
				assert_eq!(kind, DeltaKind::Reasoning);
			}
			_ => panic!("expected delta"),
		}
	}

	#[test]
	fn role_only_chunk_yields_none() {
		let payload =
			parse_chunk(&chunk(r#"{"choices":[{"delta":{"role":"assistant"}}]}"#))
				.unwrap();
		assert!(payload.is_none());
	}

	#[test]
	fn done_marker_yields_none() {
		let payload = parse_chunk(&chunk("[DONE]")).unwrap();
		assert!(payload.is_none());
	}

	#[test]
	fn parses_usage() {
		let payload = parse_chunk(&chunk(
			r#"{"choices":[],"usage":{"prompt_tokens":5,"completion_tokens":7,"total_tokens":12}}"#,
		))
		.unwrap()
		.unwrap();
		match payload {
			ChunkPayload::Usage(u) => {
				assert_eq!(u.total_tokens, Some(12));
			}
			_ => panic!("expected usage"),
		}
	}

	#[test]
	fn bai_quirk_empty_content_alongside_reasoning() {
		// b.ai sends {"content":"","reasoning_content":"..."} — reasoning must
		// win over the empty content string.
		let payload = parse_chunk(&chunk(
			r#"{"choices":[{"delta":{"content":"","reasoning_content":"We"}}]}"#,
		))
		.unwrap()
		.unwrap();
		match payload {
			ChunkPayload::Delta(text, kind) => {
				assert_eq!(text, "We");
				assert_eq!(kind, DeltaKind::Reasoning);
			}
			_ => panic!("expected reasoning delta"),
		}
	}

	#[test]
	fn empty_strings_yield_none() {
		let payload = parse_chunk(&chunk(
			r#"{"choices":[{"delta":{"content":"","reasoning_content":""}}]}"#,
		))
		.unwrap();
		assert!(payload.is_none());
	}

	#[test]
	fn midstream_error_chunk_detected() {
		let payload = parse_chunk(
	&chunk(r#"{"error":{"code":"rate_limited","message":"Free tier limit reached"}}"#),
		)
		.unwrap()
		.unwrap();
		match payload {
			ChunkPayload::Error(message) => {
				assert_eq!(message, "Free tier limit reached");
			}
			_ => panic!("expected error"),
		}
	}

	#[test]
	fn choices_null_with_error_string() {
		let payload = parse_chunk(
	&chunk(r#"{"choices":null,"error":"Connection dropped by upstream"}"#),
		)
		.unwrap()
		.unwrap();
		match payload {
			ChunkPayload::Error(message) => {
				assert_eq!(message, "Connection dropped by upstream");
			}
			_ => panic!("expected error"),
		}
	}
}
