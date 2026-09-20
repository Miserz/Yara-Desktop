/**
 * Persists which chat the user had open, across app restarts.
 * Stores a chat id, or "new" for the fresh-chat view.
 */
const KEY = 'yara.lastChatId'

export const NEW_CHAT = 'new'

export const getLastOpened = (): string | null => {
	try {
		return localStorage.getItem(KEY)
	} catch {
		return null
	}
}

export const setLastOpened = (value: string) => {
	try {
		localStorage.setItem(KEY, value)
	} catch {
		// Storage unavailable — session-only behavior.
	}
}
