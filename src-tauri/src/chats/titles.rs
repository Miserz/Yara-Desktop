use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ChatTitleRequest {
	pub provider_id: String,
	pub model_id: String,
	/// The first user message of the chat, used as the title source.
	pub source: String,
}

/// Prompt for LLM-generated chat titles. Short and strict on format so the
/// response is cheap to parse.
pub const TITLE_SYSTEM_PROMPT: &str = "You generate short chat titles. \
Reply with 2-5 words that summarize the user's message. \
No quotes, no punctuation at the end, no explanation. \
Reply in the same language as the user's message.";

impl ChatTitleRequest {
	/// Sanitizes a generated title: trims, strips surrounding quotes,
	/// collapses whitespace, caps the length. Returns `None` when nothing
	/// usable remains (empty or quotes-only responses) — the caller then
	/// falls back to a derived title.
	pub fn sanitize_title(raw: &str) -> Option<String> {
		let trimmed = raw.trim().trim_matches(|c: char| c == '"' || c == '\'' || c == '`');
		let collapsed: String =
			trimmed.split_whitespace().collect::<Vec<_>>().join(" ");
		let capped: String = collapsed.chars().take(60).collect();
		if capped.is_empty() {
			None
		} else {
			Some(capped)
		}
	}

	/// Fallback title derived from the first user message: first line,
	/// trimmed to 60 chars. Used when the LLM fails or returns nothing.
	pub fn fallback_title(source: &str) -> String {
		let first_line = source.lines().next().unwrap_or("").trim();
		let mut title: String = first_line.chars().take(60).collect();
		if title.is_empty() {
			title = "New chat".to_string();
		}
		title
	}
}

/// Client for non-streaming one-shot requests (title generation).
pub async fn generate_title(
	app: Option<&tauri::AppHandle>,
	base_url: &str,
	api_key: &str,
	request: &ChatTitleRequest,
) -> Result<String, String> {
	let body = serde_json::json!({
		"model": request.model_id,
		"messages": [
			{ "role": "system", "content": TITLE_SYSTEM_PROMPT },
			{ "role": "user", "content": request.source }
		],
		"max_tokens": 24,
		"temperature": 0
	});

	if let Some(app) = app {
		crate::logging::info(
			app,
			"http",
			"Title generation request",
			Some(serde_json::json!({
				"model": request.model_id,
				"sourceChars": request.source.chars().count(),
			})),
		);
	}

	let response = reqwest::Client::builder()
		.user_agent(concat!("Yara/", env!("CARGO_PKG_VERSION")))
		.http1_only()
		.build()
		.map_err(|e| e.to_string())?
		.post(format!("{}/chat/completions", base_url.trim_end_matches('/')))
		.bearer_auth(api_key)
		.json(&body)
		.send()
		.await
		.map_err(|e| format!("Title request failed: {e}"))?;

	if !response.status().is_success() {
		return Err(format!("Provider returned status {}", response.status()));
	}

	let json: serde_json::Value = response.json().await.map_err(|e| e.to_string())?;
	let content = json
		.get("choices")
		.and_then(|c| c.get(0))
		.and_then(|c| c.get("message"))
		.and_then(|m| m.get("content"))
		.and_then(|c| c.as_str())
		.ok_or_else(|| "Malformed title response".to_string())?;
	let title = ChatTitleRequest::sanitize_title(content)
		.unwrap_or_else(|| ChatTitleRequest::fallback_title(&request.source));
	if let Some(app) = app {
		crate::logging::info(
			app,
			"chat",
			"Title generated",
			Some(serde_json::json!({ "title": title })),
		);
	}
	Ok(title)
}

#[cfg(test)]
mod tests {
	use super::*;

	#[test]
	fn sanitize_strips_quotes_and_truncates() {
		assert_eq!(
			ChatTitleRequest::sanitize_title(r#""  Refactor auth flow  ""#),
			Some("Refactor auth flow".to_string())
		);
		let long = "word ".repeat(30);
		let capped = ChatTitleRequest::sanitize_title(&long).unwrap();
		assert!(capped.chars().count() <= 60);
	}

	#[test]
	fn sanitize_empty_yields_none() {
		assert_eq!(ChatTitleRequest::sanitize_title(""), None);
		assert_eq!(ChatTitleRequest::sanitize_title("   "), None);
		assert_eq!(ChatTitleRequest::sanitize_title("\"\""), None);
	}

	#[test]
	fn fallback_takes_first_line() {
		assert_eq!(
			ChatTitleRequest::fallback_title("Fix the login bug\nthen the logout one"),
			"Fix the login bug"
		);
		assert_eq!(ChatTitleRequest::fallback_title(""), "New chat");
	}
}

/// Generates a random id for messages/chats on the Rust side.
pub fn new_id() -> String {
	Uuid::new_v4().to_string()
}
