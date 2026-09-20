/// Incremental parser for Server-Sent Events as used by OpenAI-compatible APIs.
///
/// Feeds raw bytes from the HTTP response body and yields complete events.
/// Handles chunks split across reads, `\n` and `\r\n` line endings, and
/// multi-line `data:` fields per the SSE spec.
#[derive(Default)]
pub struct SseParser {
	buffer: String,
	data_lines: Vec<String>,
}

#[derive(Debug, PartialEq, Eq)]
pub struct SseEvent {
	pub data: String,
}

impl SseParser {
	pub fn new() -> Self {
		Self::default()
	}

	/// Feed raw text; returns any events that became complete.
	pub fn feed(&mut self, text: &str) -> Vec<SseEvent> {
		self.buffer.push_str(text);
		let mut events = Vec::new();
		// Split on any complete line ending; keep the trailing partial line buffered.
		while let Some(index) = self.next_line_break() {
			// Strip a `\r` before the `\n` (CRLF endings).
			let line_end = if index > 0 && self.buffer.as_bytes()[index - 1] == b'\r' {
				index - 1
			} else {
				index
			};
			let line = self.buffer[..line_end].to_string();
			self.buffer.drain(..index + 1);
			if line.is_empty() {
				// Empty line dispatches the accumulated event.
				if let Some(event) = self.take_event() {
					events.push(event);
				}
				continue;
			}
			self.feed_line(&line);
		}
		events
	}

	/// Flush any buffered event at end of stream (some servers omit the
	/// final empty line). Returns the last event, if one is pending.
	pub fn finish(&mut self) -> Option<SseEvent> {
		if !self.buffer.is_empty() {
			let line = self.buffer.clone();
			self.buffer.clear();
			self.feed_line(&line);
		}
		self.take_event()
	}

	// -- internals ----------------------------------------------------------

	fn next_line_break(&self) -> Option<usize> {
		self.buffer.find('\n')
	}

	fn feed_line(&mut self, line: &str) {
		if let Some(value) = line.strip_prefix("data:") {
			// Per spec: strip a single leading space after the colon.
			let value = value.strip_prefix(' ').unwrap_or(value);
			self.data_lines.push(value.to_string());
		}
		// Other fields (`event:`, `id:`, comments) are ignored.
	}

	fn take_event(&mut self) -> Option<SseEvent> {
		if self.data_lines.is_empty() {
			return None;
		}
		Some(SseEvent {
			data: std::mem::take(&mut self.data_lines).join("\n"),
		})
	}
}

#[cfg(test)]
mod tests {
	use super::*;

	#[test]
	fn parses_simple_event() {
		let mut parser = SseParser::new();
		let events = parser.feed("data: {\"a\":1}\n\n");
		assert_eq!(events.len(), 1);
		assert_eq!(events[0].data, "{\"a\":1}");
	}

	#[test]
	fn handles_crlf() {
		let mut parser = SseParser::new();
		let events = parser.feed("data: hello\r\n\r\n");
		assert_eq!(events.len(), 1);
		assert_eq!(events[0].data, "hello");
		assert!(parser.finish().is_none());
	}

	#[test]
	fn handles_split_chunks() {
		let mut parser = SseParser::new();
		assert!(parser.feed("data: {\"a\"").is_empty());
		assert!(parser.feed(":1}\n").is_empty());
		assert!(parser.feed("\n").len() == 1);
	}

	#[test]
	fn handles_multi_line_data() {
		let mut parser = SseParser::new();
		let events = parser.feed("data: line1\ndata: line2\n\n");
		assert_eq!(events.len(), 1);
		assert_eq!(events[0].data, "line1\nline2");
	}

	#[test]
	fn multiple_events_in_one_chunk() {
		let mut parser = SseParser::new();
		let events = parser.feed("data: one\n\ndata: two\n\ndata: [DONE]\n\n");
		assert_eq!(
			events.iter().map(|e| e.data.as_str()).collect::<Vec<_>>(),
			vec!["one", "two", "[DONE]"]
		);
	}

	#[test]
	fn ignores_other_fields_and_comments() {
		let mut parser = SseParser::new();
		let events = parser.feed(": keep-alive\nevent: message\nid: 42\ndata: x\n\n");
		assert_eq!(events.len(), 1);
		assert_eq!(events[0].data, "x");
	}

	#[test]
	fn finish_flushes_pending_event() {
		let mut parser = SseParser::new();
		assert!(parser.feed("data: tail").is_empty());
		assert_eq!(parser.finish().map(|e| e.data), Some("tail".to_string()));
	}

	#[test]
	fn done_marker_is_data() {
		let mut parser = SseParser::new();
		let events = parser.feed("data: [DONE]\n\n");
		assert_eq!(events[0].data, "[DONE]");
	}
}
