import { useEffect, useMemo, useRef, useState } from 'react'
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
	Button,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger
} from '@/shared/components'
import {
	chatTitle,
	removeChat,
	renameChat,
	selectChat,
	useActiveChatId,
	useChats
} from '@/entities/chat'
import type { Chat } from '@/entities/chat'
import { cn } from '@/shared/lib/utils'

type GroupKey = 'today' | 'yesterday' | 'earlier'

const GROUP_KEYS: GroupKey[] = ['today', 'yesterday', 'earlier']

/** Groups chats by their updated_at day: Today / Yesterday / Earlier. */
const groupChats = (chats: Chat[]) => {
	const startOfToday = new Date()
	startOfToday.setHours(0, 0, 0, 0)
	const todayMs = startOfToday.getTime()
	const yesterdayMs = todayMs - 86_400_000

	const groups: Record<GroupKey, Chat[]> = {
		today: [],
		yesterday: [],
		earlier: []
	}
	for (const chat of chats) {
		if (chat.updatedAt >= todayMs) groups.today.push(chat)
		else if (chat.updatedAt >= yesterdayMs) groups.yesterday.push(chat)
		else groups.earlier.push(chat)
	}
	return groups
}

const FALLBACK_TITLE_KEY = 'chatHistory.fallbackTitle'
const MAX_TITLE_LENGTH = 60

const ChatButton = ({ chat, active }: { chat: Chat; active: boolean }) => {
	const { t } = useTranslation()
	const [editing, setEditing] = useState(false)
	const [draft, setDraft] = useState('')
	const inputRef = useRef<HTMLInputElement>(null)
	const fallbackTitle = t(FALLBACK_TITLE_KEY)

	const startEditing = () => {
		setDraft(chat.title ?? chatTitle(chat, fallbackTitle))
		setEditing(true)
	}

	const commit = () => {
		const trimmed = draft.trim()
		setEditing(false)
		if (!trimmed || trimmed === chat.title) return
		void renameChat(chat.id, trimmed.slice(0, MAX_TITLE_LENGTH))
	}

	useEffect(() => {
		if (!editing) return
		inputRef.current?.focus()
		inputRef.current?.select()
	}, [editing])

	return (
		<div className='group/chat relative flex min-w-0 items-center'>
			<Button
				animated
				variant={active ? 'default' : 'ghost'}
				className={cn(
					'flex-1 justify-start pr-9 font-normal truncate',
					editing && 'pointer-events-none'
				)}
				onClick={() => void selectChat(chat.id)}
				onDoubleClick={startEditing}
			>
				{/* Hidden while editing: the overlay input renders the draft,
				    the button only carries the background. */}
				<span className={cn('truncate', editing && 'opacity-0')}>
					{chatTitle(chat, fallbackTitle)}
				</span>
			</Button>
			{editing && (
				<input
					ref={inputRef}
					value={draft}
					maxLength={MAX_TITLE_LENGTH}
					onChange={event => setDraft(event.target.value)}
					onBlur={commit}
					onKeyDown={event => {
						if (event.key === 'Enter') commit()
						if (event.key === 'Escape') setEditing(false)
					}}
					className={cn(
						'absolute inset-0 z-10 h-8 px-3 pr-9',
						'text-sm font-normal',
						'bg-transparent outline-none',
						active
							? 'text-primary-foreground caret-primary-foreground'
							: 'text-foreground caret-foreground'
					)}
					aria-label={t('chatHistory.titleA11y')}
				/>
			)}
			<DropdownMenu>
				<DropdownMenuTrigger
					render={
						<button
							aria-label='Chat actions'
							className={cn(
								'absolute flex items-center justify-center size-6 right-1.5 opacity-0 transition-opacity group-hover/chat:opacity-100 data-popup-open:opacity-100',
								active &&
									'text-primary-foreground hover:text-primary-foreground hover:bg-foreground/10'
							)}
						>
							<MoreHorizontal className='size-4' />
						</button>
					}
				/>
				<DropdownMenuContent align='end' className='min-w-36'>
					<DropdownMenuItem onClick={startEditing}>
						<Pencil className='size-3.5' />
						{t('chatHistory.rename')}
					</DropdownMenuItem>
					<DropdownMenuItem onClick={() => void removeChat(chat.id)}>
						<Trash2 className='size-3.5' />
						{t('chatHistory.delete')}
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	)
}

export function ChatHistory() {
	const chats = useChats()
	const activeChatId = useActiveChatId()
	const { t } = useTranslation()
	const groups = useMemo(() => groupChats(chats), [chats])

	const [open, setOpen] = useState<GroupKey[]>([...GROUP_KEYS])

	const activeGroup = useMemo(
		() =>
			GROUP_KEYS.find(
				key => groups[key].some(chat => chat.id === activeChatId) && key
			),
		[groups, activeChatId]
	)

	useEffect(() => {
		if (!activeGroup) return
		setOpen(current =>
			current.includes(activeGroup) ? current : [...current, activeGroup]
		)
	}, [activeGroup])

	const section = (key: GroupKey, label: string) =>
		groups[key].length > 0 && (
			<AccordionItem value={key}>
				<AccordionTrigger>{label}</AccordionTrigger>
				<AccordionContent className='flex min-w-0 flex-col'>
					{groups[key].map(chat => (
						<ChatButton
							key={chat.id}
							chat={chat}
							active={chat.id === activeChatId}
						/>
					))}
				</AccordionContent>
			</AccordionItem>
		)

	return (
		<Accordion
			multiple
			value={open}
			onValueChange={value => setOpen(value as GroupKey[])}
		>
			{section('today', t('chatHistory.today'))}
			{section('yesterday', t('chatHistory.yesterday'))}
			{section('earlier', t('chatHistory.earlier'))}
		</Accordion>
	)
}
