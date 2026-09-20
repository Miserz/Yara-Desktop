import { useEffect, useRef, useState } from 'react'
import { Check, Clipboard, Pencil, RefreshCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/shared/components'
import { editMessage, retryMessage } from '../model/store'
import type { Message } from '../model/types'
import { MarkdownContent } from './markdown-content'
import { ThinkingBlock } from './thinking-block'

interface IProps {
	message: Message
	/** False for frozen transition snapshots — actions are hidden there. */
	interactive?: boolean
}

const WaitingDots = () => {
	const { t } = useTranslation()

	return (
		<div
			className='flex items-center gap-1 py-1'
			aria-label={t('message.thinking')}
		>
			{[0, 1, 2].map(index => (
				<span
					key={index}
					className='size-1.5 rounded-full bg-muted-foreground animate-pulse'
					style={{ animationDelay: `${index * 200}ms` }}
				/>
			))}
		</div>
	)
}

const StreamCursor = () => (
	<span
		className='ml-0.5 inline-block size-2.5 translate-y-0.5 rounded-[2px] bg-foreground animate-pulse'
		aria-hidden='true'
	/>
)

const COPY_FEEDBACK_MS = 1500

const CopyButton = ({ content }: { content: string }) => {
	const { t } = useTranslation()
	const [copied, setCopied] = useState(false)
	const timerRef = useRef<number | undefined>(undefined)

	useEffect(() => () => window.clearTimeout(timerRef.current), [])

	const handleCopy = () => {
		void navigator.clipboard.writeText(content).catch(() => {})
		setCopied(true)
		window.clearTimeout(timerRef.current)
		timerRef.current = window.setTimeout(
			() => setCopied(false),
			COPY_FEEDBACK_MS
		)
	}

	return (
		<Button
			size='icon-xs'
			variant='ghost'
			aria-label={t('message.copy')}
			className='text-muted-foreground hover:text-foreground'
			onClick={handleCopy}
		>
			{copied ? (
				<Check className='size-3.5' />
			) : (
				<Clipboard className='size-3.5' />
			)}
		</Button>
	)
}

/** Hover-visible action row under a message. */
const MessageActions = ({
	message,
	children
}: {
	message: Message
	children: React.ReactNode
}) => (
	<div className='flex h-6 items-center gap-0.5 opacity-0 transition-opacity duration-150 group-hover/message:opacity-100'>
		<CopyButton content={message.content} />
		{children}
	</div>
)

export function MessageItem({ message, interactive = true }: IProps) {
	const { t } = useTranslation()
	const [editing, setEditing] = useState(false)
	const [draft, setDraft] = useState('')
	const textareaRef = useRef<HTMLTextAreaElement>(null)

	const isWaiting =
		message.streaming && message.content.length === 0 && !message.reasoning

	// Snapshot rows are never interactive; streaming rows show no actions.
	const showActions = interactive && !message.streaming && !editing

	useEffect(() => {
		if (!editing) return
		const textarea = textareaRef.current
		if (!textarea) return
		textarea.focus()
		textarea.select()
	}, [editing])

	const startEditing = () => {
		setDraft(message.content)
		setEditing(true)
	}

	const commitEditing = () => {
		const trimmed = draft.trim()
		setEditing(false)
		if (!trimmed || trimmed === message.content) return
		void editMessage(message.id, trimmed)
	}

	if (message.role === 'user') {
		if (editing) {
			return (
				<div className='flex w-full max-w-[75%] flex-col items-end gap-1'>
					<textarea
						ref={textareaRef}
						value={draft}
						onChange={event => setDraft(event.target.value)}
						onBlur={commitEditing}
						onKeyDown={event => {
							if (event.key === 'Enter' && !event.shiftKey) {
								event.preventDefault()
								commitEditing()
							}
							if (event.key === 'Escape') setEditing(false)
						}}
						rows={Math.min(8, Math.max(1, draft.split('\n').length))}
						className='w-full resize-none rounded-lg bg-[#212121] border border-foreground/15 px-4 py-3 text-sm text-foreground caret-foreground outline-none'
						aria-label={t('message.edit')}
					/>
				</div>
			)
		}
		return (
			<div className='group/message flex w-fit max-w-[75%] flex-col items-end gap-1'>
				<div className='rounded-lg bg-[#212121] px-4 py-3'>
					<p className='whitespace-pre-wrap text-sm text-foreground'>
						{message.content}
					</p>
				</div>
				{showActions && (
					<MessageActions message={message}>
						<Button
							size='icon-xs'
							variant='ghost'
							aria-label={t('message.edit')}
							className='text-muted-foreground hover:text-foreground'
							onClick={startEditing}
						>
							<Pencil className='size-3.5' />
						</Button>
					</MessageActions>
				)}
			</div>
		)
	}

	return (
		<div className='group/message min-h-4 text-sm text-foreground'>
			{isWaiting ? (
				<WaitingDots />
			) : (
				<div className='relative'>
					{message.reasoning && (
						<ThinkingBlock
							reasoning={message.reasoning}
							streaming={!!message.streaming && message.content.length === 0}
						/>
					)}
					{message.content.length > 0 && (
						<MarkdownContent content={message.content} />
					)}
					{message.streaming && <StreamCursor />}
				</div>
			)}
			{message.error && (
				<p className='mt-1 text-sm text-red-400/90'>{message.error}</p>
			)}
			{showActions && (
				<MessageActions message={message}>
					<Button
						size='icon-xs'
						variant='ghost'
						aria-label={t('message.tryAgain')}
						className='text-muted-foreground hover:text-foreground'
						onClick={() => void retryMessage(message.id)}
					>
						<RefreshCw className='size-3.5' />
					</Button>
				</MessageActions>
			)}
		</div>
	)
}
