use serde::{Deserialize, Serialize};

use crate::chat::types::ChatRole;

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ChatRow {
	pub id: String,
	/// None until the first exchange completes and a title is generated.
	pub title: Option<String>,
	pub created_at: i64,
	pub updated_at: i64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ChatMessageRow {
	pub id: String,
	pub role: ChatRole,
	pub content: String,
	/// Extended-thinking tokens for assistant messages, if any.
	#[serde(default)]
	pub reasoning: Option<String>,
	pub created_at: i64,
}

/// Snapshot of a running generation, for restoring the streaming state
/// after a reload (F5) or a second window.
#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ActiveGeneration {
	pub request_id: String,
	pub chat_id: String,
	/// Content text streamed so far.
	pub text: String,
	/// Reasoning tokens streamed so far (extended thinking).
	pub reasoning: String,
}

/// A single search result row: either a chat whose title matched, or a
/// message whose content did (with a context snippet around the match).
#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct SearchHit {
	pub chat_id: String,
	/// Chat title at match time; may be None for untitled chats matched
	/// by message content (the sidebar shows its fallback there).
	pub chat_title: Option<String>,
	/// For `title` hits — the title itself; for `message` hits — a short
	/// content excerpt around the first match.
	pub snippet: String,
	/// `title` hits outrank `message` hits for the same chat.
	#[serde(rename = "kind")]
	pub kind: SearchHitKind,
	/// The chat's last-activity time, for the result row's right side.
	pub updated_at: i64,
}

#[derive(Serialize, Deserialize, Clone, Copy, PartialEq, Eq, Debug)]
#[serde(rename_all = "lowercase")]
pub enum SearchHitKind {
	Title,
	Message,
}
