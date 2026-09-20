import { create, type StateCreator } from 'zustand'
import * as api from '@/shared/api/chat'
import * as chatsApi from '@/shared/api/chats'
import type { ChatMessage } from '@/shared/api/chat'
import { useModelsStore } from '@/app/store/models'
import { ensureChat, getActiveChatId, refreshChats } from '@/entities/chat'
import type { Message } from './types'

interface IInitialState {
	messages: Message[]
	isStreaming: boolean
	activeRequestId: string | null
}

interface IActions {
	send: (text: string) => Promise<void>
	stop: () => Promise<void>
	/** Rewrites a user message, cuts the branch after it, regenerates. */
	editMessage: (id: string, text: string) => Promise<void>
	/** Cuts the branch from an assistant message, regenerates the answer. */
	retry: (id: string) => Promise<void>
	hydrate: (messages: Message[], streaming?: Message | null) => void
}

interface IMessageState extends IInitialState, IActions {}

const initialState: IInitialState = {
	messages: [],
	isStreaming: false,
	activeRequestId: null
}

let listening = false

/**
 * While a reload restores a running generation, incoming events for the
 * unknown requestId are buffered here and replayed once the id is adopted.
 */
let restoreBuffer: {
	content?: string
	reasoning?: string
	done: boolean
	error?: string
} | null = null

/**
 * Subscribes to backend chat events once. The requestId is generated on the
 * frontend and known before `start_chat` resolves, so early deltas can never
 * race the invoke result. Stale events from finished generations are dropped
 * by the id check. During a restore, events from the running generation
 * arrive before its id is known вЂ” they are buffered and replayed on adopt.
 */
const ensureListeners = () => {
	if (listening) return
	listening = true
	void api.onChatDelta(event => {
		const { activeRequestId, isStreaming } = useMessageStore.getState()
		if (isStreaming && activeRequestId === null) {
			// Restoring: buffer deltas of the (single) running generation.
			if (event.kind === 'reasoning') {
				restoreBuffer = {
					...(restoreBuffer ?? { done: false }),
					reasoning: (restoreBuffer?.reasoning ?? '') + event.text
				}
			} else {
				restoreBuffer = {
					...(restoreBuffer ?? { done: false }),
					content: (restoreBuffer?.content ?? '') + event.text
				}
			}
			return
		}
		if (activeRequestId !== event.requestId) return
		useMessageStore.setState(state => ({
			messages: state.messages.map(message => {
				if (!message.streaming) return message
				return event.kind === 'reasoning'
					? {
							...message,
							reasoning: (message.reasoning ?? '') + event.text
						}
					: { ...message, content: message.content + event.text }
			})
		}))
	})
	void api.onChatDone(event => {
		const { activeRequestId, isStreaming } = useMessageStore.getState()
		if (isStreaming && activeRequestId === null) {
			restoreBuffer = { ...(restoreBuffer ?? {}), done: true }
			return
		}
		if (activeRequestId !== event.requestId) return
		finalize()
		// Persisted titles/ordering may have changed (LLM title, bump).
		void refreshChats()
	})
	void api.onChatError(event => {
		const { activeRequestId, isStreaming } = useMessageStore.getState()
		if (isStreaming && activeRequestId === null) {
			restoreBuffer = {
				...(restoreBuffer ?? {}),
				done: true,
				error: event.cancelled ? undefined : event.message
			}
			return
		}
		if (activeRequestId !== event.requestId) return
		applyError(event.message, event.cancelled)
	})
	// LLM titles are saved after chat://done; refresh the sidebar then.
	void api.onChatsUpdated(() => {
		void refreshChats()
	})
}

const applyError = (message: string, cancelled: boolean) => {
	useMessageStore.setState(state => ({
		messages: state.messages.map(item => {
			if (!item.streaming) return item
			return {
				...item,
				streaming: false,
				// A stop keeps whatever was streamed so far; only real
				// failures surface an error.
				error: cancelled ? undefined : message
			}
		}),
		isStreaming: false,
		activeRequestId: null
	}))
	void refreshChats()
}

/** Marks the streaming message as complete; safe to call from any path. */
const finalize = () => {
	useMessageStore.setState(state => ({
		messages: state.messages.map(message =>
			message.streaming ? { ...message, streaming: false } : message
		),
		isStreaming: false,
		activeRequestId: null
	}))
}

/** Marks the streaming message as failed. */
const failWith = (message: string) => {
	useMessageStore.setState(state => ({
		messages: state.messages.map(item =>
			item.streaming ? { ...item, streaming: false, error: message } : item
		),
		isStreaming: false,
		activeRequestId: null
	}))
}

const generateId = () =>
	typeof crypto !== 'undefined' && 'randomUUID' in crypto
		? crypto.randomUUID()
		: `${Date.now()}-${Math.random().toString(36).slice(2)}`

/** Only complete, non-failed, non-empty turns are sent back as history. */
const toApiMessages = (messages: Message[]): ChatMessage[] =>
	messages
		.filter(message => !message.error && message.content.length > 0)
		.map(message => ({ role: message.role, content: message.content }))

const messagesStore: StateCreator<IMessageState> = (set, get) => ({
	...initialState,

	send: async (text: string) => {
		const trimmed = text.trim()
		if (!trimmed || get().isStreaming) return

		const { activeModel } = useModelsStore.getState()
		if (!activeModel) return

		const chatId = await ensureChat()
		if (!chatId) return

		const requestId = generateId()
		const userMessage: Message = {
			id: generateId(),
			role: 'user',
			content: trimmed,
			createdAt: Date.now()
		}
		const assistantMessage: Message = {
			id: generateId(),
			role: 'assistant',
			content: '',
			streaming: true,
			createdAt: Date.now()
		}
		const history = [
			...toApiMessages(get().messages),
			{ role: 'user' as const, content: trimmed }
		]

		set({
			messages: [...get().messages, userMessage, assistantMessage],
			isStreaming: true,
			activeRequestId: requestId
		})

		ensureListeners()

		try {
			await api.startChat(
				{
					providerId: activeModel.providerId,
					modelId: activeModel.modelId,
					messages: history
				},
				requestId,
				chatId
			)
		} catch (error) {
			failWith(error instanceof Error ? error.message : String(error))
		}
	},

	editMessage: async (id, text) => {
		const trimmed = text.trim()
		if (!trimmed || get().isStreaming) return

		const { activeModel } = useModelsStore.getState()
		const chatId = getActiveChatId()
		if (!activeModel || !chatId) return

		const index = get().messages.findIndex(message => message.id === id)
		if (index < 0 || get().messages[index].role !== 'user') return

		// Persist: rewrite the message, cut everything after it (the edited
		// message itself is kept). Abort when persistence fails so memory
		// and the database can't diverge.
		try {
			await chatsApi.editMessage(id, trimmed)
			await chatsApi.truncateFrom(chatId, id, false)
		} catch {
			return
		}

		const requestId = generateId()
		const kept = get().messages.slice(0, index)
		const edited: Message = {
			...get().messages[index],
			content: trimmed
		}
		const assistantMessage: Message = {
			id: generateId(),
			role: 'assistant',
			content: '',
			streaming: true,
			createdAt: Date.now()
		}
		const history = [
			...toApiMessages(kept),
			{ role: 'user' as const, content: trimmed }
		]

		set({
			messages: [...kept, edited, assistantMessage],
			isStreaming: true,
			activeRequestId: requestId
		})

		ensureListeners()

		try {
			await api.startChat(
				{
					providerId: activeModel.providerId,
					modelId: activeModel.modelId,
					messages: history,
					persistUser: false
				},
				requestId,
				chatId
			)
		} catch (error) {
			failWith(error instanceof Error ? error.message : String(error))
		}
	},

	retry: async id => {
		if (get().isStreaming) return

		const { activeModel } = useModelsStore.getState()
		const chatId = getActiveChatId()
		if (!activeModel || !chatId) return

		const index = get().messages.findIndex(message => message.id === id)
		if (index < 0 || get().messages[index].role !== 'assistant') return

		// Persist: cut this answer and everything after it, keeping the user
		// message it responds to. Abort when persistence fails so memory
		// and the database can't diverge.
		try {
			const previous = get().messages[index - 1]
			if (previous) {
				await chatsApi.truncateFrom(chatId, previous.id, false)
			} else {
				await chatsApi.truncateFrom(chatId, id, true)
			}
		} catch {
			return
		}

		const requestId = generateId()
		const kept = get().messages.slice(0, index)
		const assistantMessage: Message = {
			id: generateId(),
			role: 'assistant',
			content: '',
			streaming: true,
			createdAt: Date.now()
		}
		// The history is the kept prefix вЂ” it already ends with the user
		// message this answer responds to.
		const history = toApiMessages(kept)

		set({
			messages: [...kept, assistantMessage],
			isStreaming: true,
			activeRequestId: requestId
		})

		ensureListeners()

		try {
			await api.startChat(
				{
					providerId: activeModel.providerId,
					modelId: activeModel.modelId,
					messages: history,
					persistUser: false
				},
				requestId,
				chatId
			)
		} catch (error) {
			failWith(error instanceof Error ? error.message : String(error))
		}
	},

	stop: async () => {
		const requestId = get().activeRequestId
		if (!requestId) return
		let stopped = false
		try {
			stopped = await api.stopChat(requestId)
		} catch {
			// fall through: finalize locally below
		}
		// The backend emits chat://error when it accepts the stop; if the
		// generation already ended (false), no event will come вЂ” finish here.
		if (!stopped) finalize()
	},

	hydrate: (messages, streaming = null) => {
		if (streaming) {
			set({
				messages: [...messages, streaming],
				isStreaming: true,
				activeRequestId: streaming.id
			})
		} else {
			set({
				messages,
				isStreaming: false,
				activeRequestId: null
			})
		}
	}
})

const useMessageStore = create<IMessageState>()(messagesStore)

export const useMessages = () => useMessageStore(state => state.messages)
export const useIsStreaming = () => useMessageStore(state => state.isStreaming)

export const sendMessage = (text: string) =>
	useMessageStore.getState().send(text)
export const stopGeneration = () => useMessageStore.getState().stop()
export const editMessage = (id: string, text: string) =>
	useMessageStore.getState().editMessage(id, text)
export const retryMessage = (id: string) =>
	useMessageStore.getState().retry(id)

/**
 * Replaces the in-memory conversation (chat switch, new chat) and, with a
 * `streaming` message, restores a running generation after a reload.
 */
export const hydrateMessages = (
	messages: Message[],
	streaming?: Message | null
) => useMessageStore.getState().hydrate(messages, streaming)

/**
 * Copy of the conversation as it was BEFORE the last hydrate вЂ” used by
 * transition layers so the leaving view fades out with its own content
 * instead of re-reading the freshly hydrated store.
 */
let lastHydrateSnapshot: { chatKey: string; messages: Message[] } | null =
	null

/** Records the leaving chat's content right before a hydrate replaces it. */
export const snapshotBeforeHydrate = (chatKey: string) => {
	if (lastHydrateSnapshot?.chatKey === chatKey) return
	lastHydrateSnapshot = {
		chatKey,
		messages: useMessageStore.getState().messages.map(message => ({ ...message }))
	}
}

/** Frozen content of the chat that was left by the last hydrate, if any. */
export const getHydrateSnapshot = () => lastHydrateSnapshot

/** Attaches a restored generation's requestId so live deltas pass the filter. */
export const adoptRestoredGeneration = (
	requestId: string,
	text: string,
	reasoning = ''
) => {
	// Attach listeners before adopting so the restore buffer catches
	// everything between the backend snapshot and this moment.
	ensureListeners()
	useMessageStore.setState(state => {
		if (!state.isStreaming) return state
		return {
			...state,
			activeRequestId: requestId,
			messages: state.messages.map(message =>
				message.streaming
					? {
							...message,
							content: text,
							reasoning: reasoning || message.reasoning
						}
					: message
			)
		}
	})
	// Replay anything buffered while the id was unknown.
	const buffered = restoreBuffer
	restoreBuffer = null
	if (!buffered) return
	if (buffered.reasoning || buffered.content) {
		const { content = '', reasoning = '' } = buffered
		useMessageStore.setState(state => ({
			messages: state.messages.map(message => {
				if (!message.streaming) return message
				return {
					...message,
					content: message.content + content,
					reasoning: (message.reasoning ?? '') + reasoning
				}
			})
		}))
	}
	if (buffered.done) {
		if (buffered.error) {
			applyError(buffered.error, false)
		} else {
			finalize()
			void refreshChats()
		}
	}
}

/** True while a restored generation is not yet adopted (no requestId). */
export const isRestoring = () =>
	useMessageStore.getState().isStreaming &&
	useMessageStore.getState().activeRequestId === null
