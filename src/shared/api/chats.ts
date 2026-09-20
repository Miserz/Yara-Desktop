import { invoke } from '@tauri-apps/api/core'
import type { ChatRole } from './chat'

export interface ChatRow {
	id: string
	title: string | null
	createdAt: number
	updatedAt: number
}

export interface ChatMessageRow {
	id: string
	role: ChatRole
	content: string
	reasoning?: string | null
	createdAt: number
}

export interface ActiveGeneration {
	requestId: string
	chatId: string
	text: string
	reasoning: string
}

export type SearchHitKind = 'title' | 'message'

export interface SearchHit {
	chatId: string
	chatTitle: string | null
	/** Title itself for title hits; a content excerpt for message hits. */
	snippet: string
	kind: SearchHitKind
	/** Chat's last-activity time, shown on the row's right side. */
	updatedAt: number
}

export const searchChats = (query: string) =>
	invoke<SearchHit[]>('search_chats', { query })

export const clearAllChats = () => invoke('clear_all_chats')

/** Rewrites a message's content (message editing). */
export const editMessage = (id: string, content: string) =>
	invoke('edit_message', { id, content })

/** Deletes a message and everything after it in the same chat. */
export const truncateFrom = (chatId: string, messageId: string) =>
	invoke('truncate_from', { chatId, messageId })

export const createChat = (id: string) =>
	invoke<ChatRow>('create_chat', { id })

export const listChats = () => invoke<ChatRow[]>('list_chats')

export const deleteChat = (id: string) =>
	invoke('delete_chat', { id })

export const renameChat = (id: string, title: string) =>
	invoke('rename_chat', { id, title })

export const loadMessages = (chatId: string) =>
	invoke<ChatMessageRow[]>('load_messages', { chatId })

export const getActiveGeneration = () =>
	invoke<ActiveGeneration | null>('get_active_generation')
