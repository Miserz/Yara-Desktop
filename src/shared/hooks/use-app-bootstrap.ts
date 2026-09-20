import { useEffect } from 'react'
import * as chatsApi from '@/shared/api/chats'
import {
	adoptRestoredGeneration,
	hydrateMessages
} from '@/entities/message'
import type { Message } from '@/entities/message'
import {
	initializeChats,
	newChat,
	selectChat
} from '@/entities/chat'
import {
	openCommandMenu,
	openCommandSearch
} from '@/app/store/command-menu'
import { openNewAppWindow } from '@/shared/lib/new-window'

const toMessage = (row: chatsApi.ChatMessageRow): Message => ({
	id: row.id,
	role: row.role,
	content: row.content,
	reasoning: row.reasoning ?? undefined,
	createdAt: row.createdAt
})

/**
 * App bootstrap: loads the chat list, restores the last chat, and resumes
 * a generation that was streaming when the webview reloaded (F5): the
 * backend snapshot is adopted into the message store so live deltas
 * continue arriving.
 */
export function useBootstrap() {
	useEffect(() => {
		let cancelled = false

		const bootstrap = async () => {
			// Check the backend first: a running generation wins over the
			// "last chat" default, so the stream restores into its own chat.
			const active = await chatsApi
				.getActiveGeneration()
				.catch(() => null)
			if (cancelled) return

			if (active) {
				await selectChat(active.chatId)
				const rows = await chatsApi
					.loadMessages(active.chatId)
					.catch(() => [])
				if (cancelled) return
				hydrateMessages(
					rows.map(toMessage),
					{
						id: 'restored',
						role: 'assistant',
						content: active.text,
						reasoning: active.reasoning || undefined,
						streaming: true,
						createdAt: Date.now()
					}
				)
				// Listeners must be attached before adopting, so the buffer
				// catches everything between snapshot and adopt.
				adoptRestoredGeneration(
					active.requestId,
					active.text,
					active.reasoning
				)
			} else {
				await initializeChats()
			}
		}

		void bootstrap()
		return () => {
			cancelled = true
		}
	}, [])
}

/** Global shortcuts for the chat view. */
export function useShortcuts() {
	useEffect(() => {
		const handler = (event: KeyboardEvent) => {
			if (!event.ctrlKey || event.shiftKey || event.altKey) return
			const key = event.key.toLowerCase()
			if (key === 't') {
				event.preventDefault()
				newChat()
			} else if (key === 'k') {
				event.preventDefault()
				openCommandMenu()
			} else if (key === 'f') {
				event.preventDefault()
				openCommandSearch()
			} else if (key === 'n') {
				event.preventDefault()
				openNewAppWindow()
			}
		}
		window.addEventListener('keydown', handler)
		return () => window.removeEventListener('keydown', handler)
	}, [])
}
