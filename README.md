# Yara

A desktop AI assistant with streaming conversations, reasoning-model support,
and a command-driven interface.

Built with Tauri 2, React 19, Tailwind CSS 4, and SQLite.

## Features

- **Streaming chat** with any OpenAI-compatible provider (OpenRouter, b.ai,
  TokenRouter, Ollama, custom endpoints)
- **Reasoning support** — extended-thinking tokens render in a collapsible
  "Thought process" block (OpenRouter `reasoning`, DeepSeek `reasoning_content`)
- **Chat history** in SQLite with LLM-generated titles and fallbacks
- **Reload-safe streaming** — press F5 mid-generation, the stream resumes
- **Command menu** (`Ctrl+K`) and search across chats and messages (`Ctrl+F`)
- **Inline chat management** — rename (double-click), delete, groups by date
- **Frosted acrylic UI** — frameless window, floating input, blur edges

## Development

```bash
bun install
bun run tauri dev
```

Requires Rust and Bun. Configuration (providers, models) lives in the app's
data directory; chats are stored in `yara.db`.

## Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+K` | Command menu |
| `Ctrl+F` | Search chats |
| `Ctrl+T` | New chat |
| `Ctrl+Shift+I` | DevTools (logs: `get_logs` via invoke) |
