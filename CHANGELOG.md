# Changelog

All notable changes to Yara are documented here.
Format based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [0.1.0] — 2026-09-22

### Added
- Streaming chat with OpenAI-compatible providers, reasoning `Thought process` block
- Chat history in SQLite (WAL), F5-resilient streaming, search, rename/delete
- Settings: General (language, startup, auto-update toggle, clear data, shortcuts), Models (provider tabs, search, add/edit provider, add model From list / By ID), About (version, links)
- Tabs primitives (`default`/`pills`/`line`) with sliding indicator (`motion`)
- TitleBar: blue pill (28px → hover 112) left of window controls
- Updater: `tauri-plugin-updater` + `plugin-process`, signed `latest.json`, blue pill update in TitleBar, auto-check on startup, manual check in About
- i18n `en`/`ru`, CSP and `opener` hardening for markdown links

### Fixed
- Branch truncation: `rowid` ordering, `inclusive` flag, abort on persist failure
- Chat title fallback now localized via frontend i18n
- Provider/model validation, duplicate guard, sync error surfacing
