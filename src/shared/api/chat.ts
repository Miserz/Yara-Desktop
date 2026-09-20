import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'

export type ChatRole = 'user' | 'assistant' | 'system'

export interface ChatMessage {
	role: ChatRole
	content: string
}

export interface ChatRequest {
	providerId: string
	modelId: string
	messages: ChatMessage[]
	temperature?: number
	/** False for edit/regenerate flows — the trailing user message is
	 *  already persisted; the backend must not save it again. */
	persistUser?: boolean
}

export type DeltaKind = 'content' | 'reasoning'

export interface DeltaEvent {
	requestId: string
	text: string
	kind: DeltaKind
}

export interface Usage {
	promptTokens?: number
	completionTokens?: number
	totalTokens?: number
}

export interface DoneEvent {
	requestId: string
	usage?: Usage
}

export interface ErrorEvent {
	requestId: string
	message: string
	cancelled: boolean
}

export const startChat = (
	request: ChatRequest,
	requestId: string,
	chatId: string
) => invoke<string>('start_chat', { request, requestId, chatId })

export const stopChat = (requestId: string) =>
	invoke<boolean>('stop_chat', { requestId })

const DELTA_EVENT = 'chat://delta'
const DONE_EVENT = 'chat://done'
const ERROR_EVENT = 'chat://error'
const CHATS_UPDATED_EVENT = 'chat://chats-updated'

export const onChatDelta = (handler: (event: DeltaEvent) => void) =>
	listen<DeltaEvent>(DELTA_EVENT, event => handler(event.payload))

export const onChatDone = (handler: (event: DoneEvent) => void) =>
	listen<DoneEvent>(DONE_EVENT, event => handler(event.payload))

export const onChatError = (handler: (event: ErrorEvent) => void) =>
	listen<ErrorEvent>(ERROR_EVENT, event => handler(event.payload))

export const onChatsUpdated = (handler: (chatId: string) => void) =>
	listen<{ chatId: string }>(CHATS_UPDATED_EVENT, event =>
		handler(event.payload.chatId)
	)
