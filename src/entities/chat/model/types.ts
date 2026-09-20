import type { ChatRow } from '@/shared/api/chats'

export type Chat = ChatRow

/** Sidebar title: LLM title, or fallback derived from the first message. */
export const chatTitle = (chat: Chat, fallback: string) =>
	chat.title ?? fallback
