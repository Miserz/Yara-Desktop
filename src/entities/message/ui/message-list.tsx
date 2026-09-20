import { useEffect, useRef } from 'react'
import { useMessages } from '../model/store'
import type { Message } from '../model/types'
import { MessageItem } from './message-item'

interface IProps {
	/**
	 * Frozen content for transition snapshots — the leaving view must not
	 * re-read the live store (it would show the newly opened chat, making
	 * the cross-fade between identical layers invisible). Omitted: the
	 * live store-backed list.
	 */
	messages?: Message[]
	/** False disables message actions (frozen snapshot layers). */
	interactive?: boolean
}

/** Stick to the bottom only while the user is already near it. */
const SCROLL_THRESHOLD = 80

export function MessageList({
	messages: snapshot,
	interactive = true
}: IProps = {}) {
	const liveMessages = useMessages()
	const messages = snapshot ?? liveMessages
	const containerRef = useRef<HTMLDivElement>(null)
	const pinnedToBottomRef = useRef(true)

	useEffect(() => {
		const container = containerRef.current
		if (!container || !pinnedToBottomRef.current) return
		container.scrollTop = container.scrollHeight
	}, [messages])

	const handleScroll = () => {
		const container = containerRef.current
		if (!container) return
		const distanceFromBottom =
			container.scrollHeight - container.scrollTop - container.clientHeight
		pinnedToBottomRef.current = distanceFromBottom < SCROLL_THRESHOLD
	}

	return (
		<div
			ref={containerRef}
			onScroll={handleScroll}
			className='flex-1 min-h-0 overflow-y-auto'
		>
			<div className='mx-auto flex w-176 max-w-full flex-col gap-6 px-6 pt-6 pb-44'>
				{messages.map(message => (
					<div
						key={message.id}
						className={
							message.role === 'user'
								? 'flex justify-end'
								: 'flex justify-start'
						}
					>
						<MessageItem message={message} interactive={interactive} />
					</div>
				))}
			</div>
		</div>
	)
}
