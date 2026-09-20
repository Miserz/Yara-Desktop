import type { ChatRole } from '@/shared/api/chat'

export interface Message {
	id: string
	role: ChatRole
	content: string
	/** Extended-thinking tokens (assistant only), shown in a collapsible. */
	reasoning?: string
	/** Present while the assistant response for this message is streaming. */
	streaming?: boolean
	/** Set when generation failed; shown inline instead of a dialog. */
	error?: string
	createdAt: number
}
