#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname ?? '.', '..')
const pkgPath = resolve(root, 'package.json')
const cargoPath = resolve(root, 'src-tauri/Cargo.toml')
const tauriPath = resolve(root, 'src-tauri/tauri.conf.json')
const changelogPath = resolve(root, 'CHANGELOG.md')

const arg = process.argv[2]
if (!arg) {
	console.error('Usage: bun bump <version|patch|minor|major>')
	console.error('  bun bump 0.1.2       # explicit')
	console.error('  bun bump patch       # 0.1.0 -> 0.1.1')
	process.exit(1)
}

const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
const current = pkg.version

function bumpVersion(current, type) {
	const [major, minor, patch] = current.split('.').map(Number)
	if (type === 'major') return `${major + 1}.0.0`
	if (type === 'minor') return `${major}.${minor + 1}.0`
	if (type === 'patch') return `${major}.${minor}.${patch + 1}`
	return type
}

const next = ['patch', 'minor', 'major'].includes(arg) ? bumpVersion(current, arg) : arg

if (!/^\d+\.\d+\.\d+/.test(next)) {
	console.error(`Invalid version: ${next}`)
	process.exit(1)
}

console.log(`${current} → ${next}`)

// package.json
pkg.version = next
writeFileSync(pkgPath, JSON.stringify(pkg, null, '\t') + '\n')

// Cargo.toml: version = "x.y.z"
let cargo = readFileSync(cargoPath, 'utf8')
cargo = cargo.replace(/^version = ".*"/m, `version = "${next}"`)
writeFileSync(cargoPath, cargo)

// tauri.conf.json
const tauri = JSON.parse(readFileSync(tauriPath, 'utf8'))
tauri.version = next
writeFileSync(tauriPath, JSON.stringify(tauri, null, '\t') + '\n')

// CHANGELOG.md: insert after header (after line with Format...)
let changelog = readFileSync(changelogPath, 'utf8')
const today = new Date().toISOString().slice(0, 10)
const entry = `## [${next}] — ${today}\n\n### Added\n- \n\n### Fixed\n- \n`
if (!changelog.includes(`## [${next}]`)) {
	changelog = changelog.replace(
		'Format based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).',
		`Format based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).\n\n${entry}`
	)
	writeFileSync(changelogPath, changelog)
}

console.log(`\nBumped to ${next}. Next:`)
console.log(`  git add -A && git commit -m "chore: bump ${next}" && git tag v${next}`)
console.log(`  git push origin main v${next}`)
