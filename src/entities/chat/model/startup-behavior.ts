/**
 * Startup behavior: what the app opens on launch.
 * - "restore": the last opened chat (or welcome) — default
 * - "welcome": always the fresh-chat view
 */
const KEY = 'yara.startupBehavior'

export type StartupBehavior = 'restore' | 'welcome'

export const getStartupBehavior = (): StartupBehavior => {
	try {
		const value = localStorage.getItem(KEY)
		return value === 'welcome' ? 'welcome' : 'restore'
	} catch {
		return 'restore'
	}
}

export const setStartupBehavior = (value: StartupBehavior) => {
	try {
		localStorage.setItem(KEY, value)
	} catch {
		// Storage unavailable — the default applies.
	}
}
