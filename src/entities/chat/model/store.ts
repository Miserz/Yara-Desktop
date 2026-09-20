import { create, type StateCreator } from 'zustand'
import * as api from '@/shared/api/chats'
import type { ChatRow } from '@/shared/api/chats'
import { hydrateMessages, snapshotBeforeHydrate } from '@/entities/message'
import type { Message } from '@/entities/message'
import {
	NEW_CHAT,
	getLastOpened,
	setLastOpened
} from './last-opened'
import { getStartupBehavior } from './startup-behavior'

interface IInitialState {
	chats: ChatRow[]
	activeChatId: string | null
	loaded: boolean
	/** Direction of the last chat switch: newer chats slide 'forward'. */
	lastDirection: 'forward' | 'back'
	/**
	 * True when the last switch left the welcome view because the first
	 * message was sent — the hero then lifts away. Selecting an existing
	 * chat from welcome is a plain fade.
	 */
	welcomeLift: boolean
}

interface IActions {
	/** Loads the chat list; opens the most recent chat (or a fresh view). */
	initialize: () => Promise<void>
	/** Returns a chat id for the next exchange, creating one lazily. */
	ensureChat: () => Promise<string | null>
	/** Opens a chat: loads its messages into the message store. */
	selectChat: (id: string) => Promise<void>
	/** Starts a fresh chat view (an empty current chat is reused). */
	newChat: () => void
	/** Deletes a chat; switches away if it was active. */
	removeChat: (id: string) => Promise<void>
	/** Renames a chat; optimistic — reverted if the backend rejects. */
	renameChat: (id: string, title: string) => Promise<void>
	/** Re-reads the list after an exchange completes (titles, ordering). */
	refresh: () => Promise<void>
}

interface IChatState extends IInitialState, IActions {}

const initialState: IInitialState = {
	chats: [],
	activeChatId: null,
	loaded: false,
	lastDirection: 'forward',
	welcomeLift: false
}

const generateId = () =>
	typeof crypto !== 'undefined' && 'randomUUID' in crypto
		? crypto.randomUUID()
		: `${Date.now()}-${Math.random().toString(36).slice(2)}`

const chatsStore: StateCreator<IChatState> = (set, get) => ({
	...initialState,

	initialize: async () => {
		let chats: ChatRow[] = []
		try {
			chats = await api.listChats()
		} catch {
			set({ loaded: true })
			return
		}
		set({ chats, loaded: true })

		// Restore the last opened chat ("new" = fresh-chat view) unless the
		// user prefers always starting on welcome; fall back to the most
		// recently updated chat for first launches.
		if (getStartupBehavior() === 'welcome') return
		const last = getLastOpened()
		if (last === NEW_CHAT || !last) {
			if (last === NEW_CHAT) return
			const active = chats[0]
			if (active) await get().selectChat(active.id)
			return
		}
		if (chats.some(chat => chat.id === last)) {
			await get().selectChat(last)
		} else {
			const active = chats[0]
			if (active) await get().selectChat(active.id)
		}
	},

	ensureChat: async () => {
		const current = get().activeChatId
		if (current) return current
		const id = generateId()
		try {
			await api.createChat(id)
		} catch {
			return null
		}
		const chats = await api.listChats().catch(() => get().chats)
		// welcomeLift: the first message just left the welcome view —
		// the hero lifts away instead of a plain cross-fade.
		set({ activeChatId: id, chats, welcomeLift: true })
		// The fresh view became a real chat once the first message is sent.
		setLastOpened(id)
		return id
	},

	selectChat: async id => {
		// Direction for the switch animation: chats higher in the sidebar
		// (newer) come from the right; welcome counts as the newest edge.
		const { chats, activeChatId } = get()
		const indexOf = (chatId: string | null) => {
			if (!chatId) return chats.length // welcome sits below the list
			const index = chats.findIndex(chat => chat.id === chatId)
			return index === -1 ? chats.length : index
		}
		const direction =
			indexOf(id) < indexOf(activeChatId) ? 'forward' : 'back'
		set({ lastDirection: direction, welcomeLift: false })

		// Freeze the leaving chat's content for the transition layer before
		// the hydrate replaces it in the store.
		if (activeChatId) snapshotBeforeHydrate(activeChatId)

		const rows = await api.loadMessages(id).catch(() => [])
		const messages: Message[] = rows.map(row => ({
			id: row.id,
			role: row.role,
			content: row.content,
			reasoning: row.reasoning ?? undefined,
			createdAt: row.createdAt
		}))
		set({ activeChatId: id })
		setLastOpened(id)
		hydrateMessages(messages)
	},

	newChat: () => {
		// An empty current chat needs no DB work: dropping activeChatId makes
		// the next send lazily create a fresh chat. The chat list keeps only
		// chats that received at least one message. Welcome is the newest
		// edge — switching to it always reads as 'forward'.
		if (get().activeChatId) snapshotBeforeHydrate(get().activeChatId!)
		set({ activeChatId: null, lastDirection: 'forward' })
		setLastOpened(NEW_CHAT)
		hydrateMessages([])
	},

	removeChat: async id => {
		await api.deleteChat(id).catch(() => {})
		const chats = get().chats.filter(chat => chat.id !== id)
		set({ chats })
		if (get().activeChatId === id) {
			const next = chats[0]
			if (next) await get().selectChat(next.id)
			else get().newChat()
		}
	},

	renameChat: async (id, title) => {
		const previous = get().chats
		set({
			chats: previous.map(chat =>
				chat.id === id ? { ...chat, title } : chat
			)
		})
		try {
			await api.renameChat(id, title)
		} catch {
			// Revert the optimistic update on failure.
			set({ chats: previous })
		}
	},

	refresh: async () => {
		const chats = await api.listChats().catch(() => get().chats)
		set({ chats })
	}
})

const useChatsStore = create<IChatState>()(chatsStore)

export const useChats = () => useChatsStore(state => state.chats)
export const useActiveChatId = () =>
	useChatsStore(state => state.activeChatId)
/** Imperative read for non-React code (other stores). */
export const getActiveChatId = () => useChatsStore.getState().activeChatId
export const useChatsLoaded = () => useChatsStore(state => state.loaded)
export const useLastDirection = () =>
	useChatsStore(state => state.lastDirection)
export const useWelcomeLift = () => useChatsStore(state => state.welcomeLift)

export const initializeChats = () =>
	useChatsStore.getState().initialize()
export const ensureChat = () => useChatsStore.getState().ensureChat()
export const selectChat = (id: string) =>
	useChatsStore.getState().selectChat(id)
export const newChat = () => useChatsStore.getState().newChat()
export const removeChat = (id: string) =>
	useChatsStore.getState().removeChat(id)
export const renameChat = (id: string, title: string) =>
	useChatsStore.getState().renameChat(id, title)
export const refreshChats = () => useChatsStore.getState().refresh()
