import type { ChatRow } from '@/shared/api/chats'

export type Chat = ChatRow

/** Sidebar title: LLM title, or fallback derived from the first message.
 *  Empty strings are treated like missing titles so i18n fallbacks apply. */
export const chatTitle = (chat: Chat, fallback: string) =>
	chat.title && chat.title.trim().length > 0 ? chat.title : fallback
