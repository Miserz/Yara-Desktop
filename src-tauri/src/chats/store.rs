use std::sync::Mutex;

use rusqlite::{params, Connection, OptionalExtension};
use tauri::Manager;

use super::types::{ChatMessageRow, ChatRow, SearchHit, SearchHitKind};
use crate::chat::types::ChatRole;

/// SQLite-backed chat history. One connection guarded by a mutex — writes
/// are rare (two per exchange) and reads are cheap, so a simple lock is
/// plenty for a desktop app.
pub struct ChatsStore {
	conn: Mutex<Connection>,
}

const MIGRATION: &str = "
CREATE TABLE IF NOT EXISTS chats (
	id TEXT PRIMARY KEY,
	title TEXT,
	created_at INTEGER NOT NULL,
	updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS messages (
	id TEXT PRIMARY KEY,
	chat_id TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
	role TEXT NOT NULL,
	content TEXT NOT NULL,
	created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_messages_chat ON messages(chat_id, created_at);
";

/// Column added after release; old databases migrate in place.
const REASONING_MIGRATION: &str =
	"ALTER TABLE messages ADD COLUMN reasoning TEXT;";

impl ChatsStore {
	pub fn open(app: &tauri::AppHandle) -> Result<Self, String> {
		let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
		std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
		let conn =
			Connection::open(dir.join("yara.db")).map_err(|e| e.to_string())?;
		conn.execute_batch("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;")
			.map_err(|e| e.to_string())?;
		conn.execute_batch(MIGRATION).map_err(|e| e.to_string())?;
		// In-place migration for databases created before reasoning support.
		if !Self::has_column(&conn, "messages", "reasoning") {
			conn.execute_batch(REASONING_MIGRATION)
				.map_err(|e| e.to_string())?;
		}
		Ok(Self {
			conn: Mutex::new(conn),
		})
	}

	#[cfg(test)]
	pub fn in_memory() -> Result<Self, String> {
		let conn = Connection::open_in_memory().map_err(|e| e.to_string())?;
		conn.execute_batch(MIGRATION).map_err(|e| e.to_string())?;
		if !Self::has_column(&conn, "messages", "reasoning") {
			conn.execute_batch(REASONING_MIGRATION)
				.map_err(|e| e.to_string())?;
		}
		Ok(Self {
			conn: Mutex::new(conn),
		})
	}

	fn has_column(conn: &Connection, table: &str, column: &str) -> bool {
		conn.prepare(&format!("PRAGMA table_info({table})"))
			.and_then(|mut stmt| {
				let rows = stmt.query_map([], |row| {
					row.get::<_, String>(1)
				})?;
				Ok(rows.filter_map(Result::ok).any(|name| name == column))
			})
			.unwrap_or(false)
	}

	fn row_to_chat(row: &rusqlite::Row) -> rusqlite::Result<ChatRow> {
		Ok(ChatRow {
			id: row.get(0)?,
			title: row.get(1)?,
			created_at: row.get(2)?,
			updated_at: row.get(3)?,
		})
	}

	pub fn create_chat(&self, id: &str, now: i64) -> Result<ChatRow, String> {
		let conn = self.conn.lock().map_err(|e| e.to_string())?;
		conn.execute(
			"INSERT INTO chats (id, title, created_at, updated_at) VALUES (?1, NULL, ?2, ?2)",
			params![id, now],
		)
		.map_err(|e| e.to_string())?;
		Ok(ChatRow {
			id: id.to_string(),
			title: None,
			created_at: now,
			updated_at: now,
		})
	}

	/// All chats, most recently updated first.
	pub fn list_chats(&self) -> Result<Vec<ChatRow>, String> {
		let conn = self.conn.lock().map_err(|e| e.to_string())?;
		let mut stmt = conn
			.prepare(
				"SELECT id, title, created_at, updated_at
				 FROM chats ORDER BY updated_at DESC",
			)
			.map_err(|e| e.to_string())?;
		let rows = stmt
			.query_map([], Self::row_to_chat)
			.map_err(|e| e.to_string())?
			.collect::<Result<Vec<_>, _>>()
			.map_err(|e| e.to_string())?;
		Ok(rows)
	}

	pub fn delete_chat(&self, id: &str) -> Result<(), String> {
		let conn = self.conn.lock().map_err(|e| e.to_string())?;
		conn.execute("DELETE FROM chats WHERE id = ?1", params![id])
			.map_err(|e| e.to_string())?;
		Ok(())
	}

	pub fn rename_chat(&self, id: &str, title: &str) -> Result<(), String> {
		let conn = self.conn.lock().map_err(|e| e.to_string())?;
		conn.execute(
			"UPDATE chats SET title = ?1 WHERE id = ?2",
			params![title, id],
		)
		.map_err(|e| e.to_string())?;
		Ok(())
	}

	/// Bumps `updated_at`; used when a generation finishes.
	pub fn touch_chat(&self, id: &str, now: i64) -> Result<(), String> {
		let conn = self.conn.lock().map_err(|e| e.to_string())?;
		conn.execute(
			"UPDATE chats SET updated_at = ?1 WHERE id = ?2",
			params![now, id],
		)
		.map_err(|e| e.to_string())?;
		Ok(())
	}

	pub fn append_message(
		&self,
		id: &str,
		chat_id: &str,
		role: &str,
		content: &str,
		reasoning: Option<&str>,
		now: i64,
	) -> Result<(), String> {
		let conn = self.conn.lock().map_err(|e| e.to_string())?;
		conn.execute(
			"INSERT INTO messages (id, chat_id, role, content, reasoning, created_at)
			 VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
			params![id, chat_id, role, content, reasoning, now],
		)
		.map_err(|e| e.to_string())?;
		Ok(())
	}

	/// Messages of a chat, oldest first.
	pub fn load_messages(&self, chat_id: &str) -> Result<Vec<ChatMessageRow>, String> {
		let conn = self.conn.lock().map_err(|e| e.to_string())?;
		let mut stmt = conn
			.prepare(
				"SELECT id, role, content, reasoning, created_at
				 FROM messages WHERE chat_id = ?1 ORDER BY created_at",
			)
			.map_err(|e| e.to_string())?;
		let rows = stmt
			.query_map(params![chat_id], |row| {
				let role: String = row.get(1)?;
				Ok(ChatMessageRow {
					id: row.get(0)?,
					role: match role.as_str() {
						"user" => ChatRole::User,
						"assistant" => ChatRole::Assistant,
						_ => ChatRole::System,
					},
					content: row.get(2)?,
					reasoning: row.get(3)?,
					created_at: row.get(4)?,
				})
			})
			.map_err(|e| e.to_string())?
			.collect::<Result<Vec<_>, _>>()
			.map_err(|e| e.to_string())?;
		Ok(rows)
	}

	/// The first user message, used as a title fallback in the sidebar.
	pub fn first_user_message(&self, chat_id: &str) -> Result<Option<String>, String> {
		let conn = self.conn.lock().map_err(|e| e.to_string())?;
		conn.query_row(
			"SELECT content FROM messages
			 WHERE chat_id = ?1 AND role = 'user' ORDER BY created_at LIMIT 1",
			params![chat_id],
			|row| row.get::<_, String>(0),
		)
		.optional()
		.map_err(|e| e.to_string())
	}

	/// Number of messages in a chat.
	#[allow(dead_code)]
	pub fn message_count(&self, chat_id: &str) -> Result<i64, String> {
		let conn = self.conn.lock().map_err(|e| e.to_string())?;
		conn.query_row(
			"SELECT COUNT(*) FROM messages WHERE chat_id = ?1",
			params![chat_id],
			|row| row.get::<_, i64>(0),
		)
		.map_err(|e| e.to_string())
	}

	pub fn chat_exists(&self, id: &str) -> Result<bool, String> {
		let conn = self.conn.lock().map_err(|e| e.to_string())?;
		conn.query_row(
			"SELECT 1 FROM chats WHERE id = ?1",
			params![id],
			|row| row.get::<_, i64>(0),
		)
		.optional()
		.map(|o| o.is_some())
		.map_err(|e| e.to_string())
	}

	/// Removes every chat (messages cascade). Used by settings.
	pub fn clear_all(&self) -> Result<(), String> {
		let conn = self.conn.lock().map_err(|e| e.to_string())?;
		conn.execute_batch("DELETE FROM chats;")
			.map_err(|e| e.to_string())?;
		Ok(())
	}

	/// Rewrites a message's content (message editing).
	pub fn edit_message(&self, id: &str, content: &str) -> Result<(), String> {
		let conn = self.conn.lock().map_err(|e| e.to_string())?;
		conn.execute(
			"UPDATE messages SET content = ?2 WHERE id = ?1",
			params![id, content],
		)
		.map_err(|e| e.to_string())?;
		Ok(())
	}

	/// Deletes a message and everything after it in the same chat. Used by
	/// edit/regenerate: the truncated tail is re-created by the new run.
	pub fn truncate_from(&self, chat_id: &str, message_id: &str) -> Result<(), String> {
		let conn = self.conn.lock().map_err(|e| e.to_string())?;
		conn.execute(
			"DELETE FROM messages
			 WHERE chat_id = ?1
			 AND created_at >= (SELECT created_at FROM messages WHERE id = ?2)",
			params![chat_id, message_id],
		)
		.map_err(|e| e.to_string())?;
		Ok(())
	}

	/// Full-text search over chat titles and message content.
	/// Title matches outrank content matches for the same chat; results are
	/// ordered by recency and capped.
	pub fn search(&self, query: &str) -> Result<Vec<SearchHit>, String> {
		let trimmed = query.trim();
		if trimmed.is_empty() {
			return Ok(Vec::new());
		}
		let pattern = format!("%{}%", escape_like(trimmed));

		let conn = self.conn.lock().map_err(|e| e.to_string())?;

		// 1) Title hits — most recent chats first.
		let mut title_hits: Vec<SearchHit> = Vec::new();
		{
			let mut stmt = conn
				.prepare(
					"SELECT id, title, updated_at FROM chats
					 WHERE title LIKE ?1 ESCAPE '\\'
					 ORDER BY updated_at DESC LIMIT 50",
				)
				.map_err(|e| e.to_string())?;
			let rows = stmt
				.query_map(params![pattern], |row| {
					Ok(SearchHit {
						chat_id: row.get(0)?,
						chat_title: row.get(1)?,
						snippet: String::new(), // filled below from the title
						kind: SearchHitKind::Title,
						updated_at: row.get(2)?,
					})
				})
				.map_err(|e| e.to_string())?
				.collect::<Result<Vec<_>, _>>()
				.map_err(|e| e.to_string())?;
			for mut hit in rows {
				// Title rows are non-null here by the LIKE predicate.
				hit.snippet = hit.chat_title.clone().unwrap_or_default();
				title_hits.push(hit);
			}
		}

		// 2) Content hits, newest messages first; deduped against titles.
		let mut message_hits: Vec<SearchHit> = Vec::new();
		{
			let mut stmt = conn
				.prepare(
					"SELECT m.chat_id, m.content, c.title, c.updated_at
					 FROM messages m JOIN chats c ON c.id = m.chat_id
					 WHERE m.content LIKE ?1 ESCAPE '\\'
					 ORDER BY m.created_at DESC LIMIT 200",
				)
				.map_err(|e| e.to_string())?;
			let rows = stmt
				.query_map(params![pattern], |row| {
					Ok((
						row.get::<_, String>(0)?,
						row.get::<_, String>(1)?,
						row.get::<_, Option<String>>(2)?,
						row.get::<_, i64>(3)?,
					))
				})
				.map_err(|e| e.to_string())?
				.collect::<Result<Vec<_>, _>>()
				.map_err(|e| e.to_string())?;
			for (chat_id, content, chat_title, updated_at) in rows {
				if title_hits.iter().any(|hit| hit.chat_id == chat_id) {
					continue; // a title match already represents this chat
				}
				if message_hits
					.iter()
					.any(|hit| hit.chat_id == chat_id)
				{
					continue; // keep only the newest message per chat
				}
				message_hits.push(SearchHit {
					chat_id,
					chat_title,
					snippet: make_snippet(&content, trimmed),
					kind: SearchHitKind::Message,
					updated_at,
				});
			}
		}

		title_hits.extend(message_hits);
		title_hits.truncate(50);
		Ok(title_hits)
	}
}

/// Escapes LIKE wildcards in a user query so literal `%`/`_` match
/// themselves under `ESCAPE '\'`.
fn escape_like(input: &str) -> String {
	let mut escaped = String::with_capacity(input.len());
	for c in input.chars() {
		if matches!(c, '%' | '_' | '\\') {
			escaped.push('\\');
		}
		escaped.push(c);
	}
	escaped
}

/// Cuts a context window around the first case-insensitive occurrence of
/// `query`; leading/trailing ellipses mark truncation.
fn make_snippet(content: &str, query: &str) -> String {
	const RADIUS: usize = 40;
	let lower_content = content.to_lowercase();
	let lower_query = query.to_lowercase();
	let match_pos = match lower_content.find(&lower_query) {
		Some(pos) => pos,
		None => return content.chars().take(RADIUS * 2).collect(),
	};

	let chars: Vec<(usize, char)> = content.char_indices().collect();
	// Byte offset -> char index.
	let char_index = |byte: usize| {
		chars.iter().position(|(i, _)| *i >= byte).unwrap_or(chars.len())
	};
	let start_char = char_index(match_pos).saturating_sub(RADIUS);
	let end_char = (char_index(match_pos + query.len()) + RADIUS).min(chars.len());

	let mut snippet = String::new();
	if start_char > 0 {
		snippet.push('…');
	}
	for (_, c) in &chars[start_char..end_char] {
		snippet.push(*c);
	}
	if end_char < chars.len() {
		snippet.push('…');
	}
	snippet
}

#[cfg(test)]
mod tests {
	use super::*;

	fn now() -> i64 {
		1_700_000_000_000
	}

	#[test]
	fn create_list_delete() {
		let store = ChatsStore::in_memory().unwrap();
		let a = store.create_chat("a", now()).unwrap();
		let b = store.create_chat("b", now() + 1).unwrap();
		let chats = store.list_chats().unwrap();
		assert_eq!(chats.len(), 2);
		// Most recently updated first.
		assert_eq!(chats[0].id, "b");
		assert_eq!(chats[0].title, None);

		store.touch_chat("a", now() + 5).unwrap();
		let chats = store.list_chats().unwrap();
		assert_eq!(chats[0].id, "a");

		store.rename_chat("a", "Hello").unwrap();
		assert_eq!(store.list_chats().unwrap()[0].title, Some("Hello".into()));

		store.delete_chat("b").unwrap();
		assert_eq!(store.list_chats().unwrap().len(), 1);
	}

	#[test]
	fn messages_order_and_cascade() {
		let store = ChatsStore::in_memory().unwrap();
		store.create_chat("a", now()).unwrap();
		store
			.append_message("m1", "a", "user", "hello", None, now())
			.unwrap();
		store
			.append_message("m2", "a", "assistant", "hi", None, now() + 1)
			.unwrap();
		store
			.append_message("m3", "a", "user", "bye", None, now() + 2)
			.unwrap();

		let messages = store.load_messages("a").unwrap();
		assert_eq!(messages.len(), 3);
		assert_eq!(messages[0].content, "hello");
		assert_eq!(messages[2].content, "bye");
		assert_eq!(store.message_count("a").unwrap(), 3);

		// Cascade removes messages with the chat.
		store.delete_chat("a").unwrap();
		assert!(store.load_messages("a").unwrap().is_empty());
		assert!(!store.chat_exists("a").unwrap());
	}

	#[test]
	fn first_user_message_fallback() {
		let store = ChatsStore::in_memory().unwrap();
		store.create_chat("a", now()).unwrap();
		assert!(store.first_user_message("a").unwrap().is_none());
		store
			.append_message("m1", "a", "assistant", "first", None, now())
			.unwrap();
		store
			.append_message("m2", "a", "user", "refactor please", None, now() + 1)
			.unwrap();
		assert_eq!(
			store.first_user_message("a").unwrap(),
			Some("refactor please".to_string())
		);
	}

	#[test]
	fn reasoning_roundtrip() {
		let store = ChatsStore::in_memory().unwrap();
		store.create_chat("a", now()).unwrap();
		store
			.append_message(
				"m1",
				"a",
				"assistant",
				"answer",
				Some("thinking hard"),
				now(),
			)
			.unwrap();
		let messages = store.load_messages("a").unwrap();
		assert_eq!(messages[0].reasoning, Some("thinking hard".to_string()));
		assert_eq!(messages[0].content, "answer");
	}

	fn seeded_search_store() -> ChatsStore {
		let store = ChatsStore::in_memory().unwrap();
		store.create_chat("auth", now()).unwrap();
		store.rename_chat("auth", "Refactor auth flow").unwrap();
		store
			.append_message("m1", "auth", "user", "please fix the login bug", None, now())
			.unwrap();

		store.create_chat("misc", now() + 1).unwrap();
		store
			.append_message(
				"m2",
				"misc",
				"assistant",
				"we got 100% test coverage after the fix",
				None,
				now() + 1,
			)
			.unwrap();
		store
	}

	#[test]
	fn search_by_title_and_content() {
		let store = seeded_search_store();
		let hits = store.search("auth").unwrap();
		assert_eq!(hits.len(), 1);
		assert_eq!(hits[0].chat_id, "auth");
		assert_eq!(hits[0].kind, SearchHitKind::Title);

		let hits = store.search("login bug").unwrap();
		assert_eq!(hits.len(), 1);
		assert_eq!(hits[0].chat_id, "auth");
		assert_eq!(hits[0].kind, SearchHitKind::Message);
		assert!(hits[0].snippet.contains("login bug"));
	}

	#[test]
	fn search_is_case_insensitive_and_snippet_marks_truncation() {
		let store = ChatsStore::in_memory().unwrap();
		store.create_chat("a", now()).unwrap();
		let long = format!("{} needle {}", "x".repeat(200), "y".repeat(200));
		store
			.append_message("m1", "a", "user", &long, None, now())
			.unwrap();
		let hits = store.search("NEEDLE").unwrap();
		assert_eq!(hits.len(), 1);
		assert!(hits[0].snippet.starts_with('…'));
		assert!(hits[0].snippet.ends_with('…'));
		assert!(hits[0].snippet.to_lowercase().contains("needle"));
	}

	#[test]
	fn search_escapes_like_wildcards() {
		let store = seeded_search_store();
		// "100%" must match literally, not as a wildcard pattern.
		let hits = store.search("100%").unwrap();
		assert_eq!(hits.len(), 1);
		assert_eq!(hits[0].chat_id, "misc");

		// Underscore is literal too: no chat matches a lone "_".
		assert!(store.search("_").unwrap().is_empty());
	}

	#[test]
	fn search_title_hit_outranks_message_hit() {
		let store = ChatsStore::in_memory().unwrap();
		store.create_chat("a", now()).unwrap();
		store.rename_chat("a", "Fix bug").unwrap();
		store
			.append_message("m1", "a", "user", "also mentions bug inside", None, now())
			.unwrap();
		let hits = store.search("bug").unwrap();
		assert_eq!(hits.len(), 1);
		assert_eq!(hits[0].kind, SearchHitKind::Title);
	}

	#[test]
	fn search_empty_query_returns_nothing() {
		let store = seeded_search_store();
		assert!(store.search("").unwrap().is_empty());
		assert!(store.search("   ").unwrap().is_empty());
	}

	#[test]
	fn edit_and_truncate_branch() {
		let store = ChatsStore::in_memory().unwrap();
		store.create_chat("a", now()).unwrap();
		store.append_message("u1", "a", "user", "first question", None, now()).unwrap();
		store.append_message("r1", "a", "assistant", "first answer", None, now() + 1).unwrap();
		store.append_message("u2", "a", "user", "second question", None, now() + 2).unwrap();
		store.append_message("r2", "a", "assistant", "second answer", None, now() + 3).unwrap();

		// Editing rewrites only the target message.
		store.edit_message("u2", "edited question").unwrap();
		let messages = store.load_messages("a").unwrap();
		assert_eq!(messages[2].content, "edited question");
		assert_eq!(messages[3].content, "second answer");

		// Truncating from r2 removes r2 only (tail of the branch).
		store.truncate_from("a", "r2").unwrap();
		let messages = store.load_messages("a").unwrap();
		assert_eq!(messages.len(), 3);
		assert_eq!(messages[2].content, "edited question");

		// Truncating from u2 removes the pair and everything after.
		store.truncate_from("a", "u2").unwrap();
		let messages = store.load_messages("a").unwrap();
		assert_eq!(messages.len(), 2);
		assert_eq!(messages[1].content, "first answer");
	}
}
