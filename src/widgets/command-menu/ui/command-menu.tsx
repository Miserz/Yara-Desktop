import { useEffect, useRef, useState } from 'react'
import {
	Bot,
	FileText,
	MessageSquare,
	SearchIcon,
	Settings,
	SquarePen
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { getCurrentLanguage } from '@/shared/lib/i18n'
import {
	Button,
	CommandDialog,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandShortcut
} from '@/shared/components'
import {
	closeCommandMenu,
	useCommandMenuOpen,
	useSearchFirst
} from '@/app/store/command-menu'
import { newChat, selectChat, useChats } from '@/entities/chat'
import { chatTitle } from '@/entities/chat'
import {
	setActiveModel,
	useActiveModel,
	useEnabledModels,
	useModels,
	useProviders
} from '@/app/store/models'
import { openSettings } from '@/app/store/settings'
import { toggleSidebar } from '@/app/store/sidebar'
import * as chatsApi from '@/shared/api/chats'
import type { SearchHit } from '@/shared/api/chats'

type SearchTab = 'all' | 'chats' | 'files' | 'images' | 'code'

/**
 * Faces of one dialog: the command palette (commands only) and the menus
 * its commands turn it into — search or model selection.
 */
type MenuMode = 'commands' | 'search' | 'model'

const SEARCH_DEBOUNCE_MS = 250

/** Tab ids mapped to their i18n keys, in display order. */
const SEARCH_TAB_KEYS: Array<[SearchTab, string]> = [
	['all', 'commandMenu.tab.all'],
	['chats', 'commandMenu.tab.chats'],
	['files', 'commandMenu.tab.files'],
	['images', 'commandMenu.tab.images'],
	['code', 'commandMenu.tab.code']
]

/**
 * Compact last-activity label: "Today • 14:03", "Yesterday • 16:10",
 * "30 May • 17:58" for anything older.
 */
const formatActivity = (updatedAt: number, t: (key: string) => string) => {
	const date = new Date(updatedAt)
	const pad = (n: number) => n.toString().padStart(2, '0')
	const time = `${pad(date.getHours())}:${pad(date.getMinutes())}`
	const startOfToday = new Date()
	startOfToday.setHours(0, 0, 0, 0)
	const todayMs = startOfToday.getTime()
	if (updatedAt >= todayMs) return `${t('commandMenu.today')} • ${time}`
	if (updatedAt >= todayMs - 86_400_000)
		return `${t('commandMenu.yesterday')} • ${time}`
	const month = date.toLocaleString(getCurrentLanguage() === 'ru' ? 'ru-RU' : 'en-US', { month: 'short' })
	return `${date.getDate()} ${month} • ${time}`
}

/** Renders a snippet with the matched part emphasized (plain split, no HTML). */
const Snippet = ({ snippet, query }: { snippet: string; query: string }) => {
	const q = query.trim()
	const index = q ? snippet.toLowerCase().indexOf(q.toLowerCase()) : -1
	if (index < 0) {
		return <span className='truncate text-muted-foreground'>{snippet}</span>
	}
	return (
		<span className='truncate text-muted-foreground'>
			{snippet.slice(0, index)}
			<span className='font-medium text-foreground'>
				{snippet.slice(index, index + q.length)}
			</span>
			{snippet.slice(index + q.length)}
		</span>
	)
}

const TabChip = ({
	active,
	children,
	onClick
}: {
	active: boolean
	children: React.ReactNode
	onClick: () => void
}) => (
	<Button
		size='xs'
		variant={active ? 'secondary' : 'ghost'}
		className={active ? '' : 'text-muted-foreground'}
		onClick={onClick}
	>
		{children}
	</Button>
)

const PlaceholderSection = ({ label }: { label: string }) => {
	const { t } = useTranslation()

	return (
		<CommandGroup heading={label}>
			<div className='px-2 py-4 text-center text-sm text-muted-foreground'>
				{t('commandMenu.comingSoon', { label })}
			</div>
		</CommandGroup>
	)
}

export function CommandMenu() {
	const open = useCommandMenuOpen()
	const searchFirst = useSearchFirst()
	const chats = useChats()
	const providers = useProviders()
	const models = useModels()
	const enabledModels = useEnabledModels()
	const activeModel = useActiveModel()
	const { t } = useTranslation()
	const [query, setQuery] = useState('')
	const [tab, setTab] = useState<SearchTab>('all')
	const [mode, setMode] = useState<MenuMode>('commands')
	const [hits, setHits] = useState<SearchHit[]>([])
	const [searched, setSearched] = useState(false)
	const debounceRef = useRef<number | undefined>(undefined)

	const enterSearch = () => {
		setMode('search')
		setQuery('')
		setTab('all')
	}

	const enterModel = () => {
		setMode('model')
		setQuery('')
	}

	// Reset local state when the dialog closes. Search entries (Ctrl+F,
	// sidebar item) open straight into the search menu; Ctrl+K shows commands.
	useEffect(() => {
		if (open) {
			if (searchFirst) {
				setMode('search')
				setTab('chats')
			} else {
				setMode('commands')
				setTab('all')
			}
		} else {
			setQuery('')
			setTab('all')
			setMode('commands')
			setHits([])
			setSearched(false)
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [open])

	// Debounced search; empty queries never reach the backend.
	useEffect(() => {
		if (!open || mode !== 'search') return
		const trimmed = query.trim()
		window.clearTimeout(debounceRef.current)
		if (!trimmed) {
			setHits([])
			setSearched(false)
			return
		}
		debounceRef.current = window.setTimeout(() => {
			chatsApi
				.searchChats(trimmed)
				.then(result => {
					setHits(result)
					setSearched(true)
				})
				.catch(() => setHits([]))
		}, SEARCH_DEBOUNCE_MS)
		return () => window.clearTimeout(debounceRef.current)
	}, [query, open, mode])

	const runAndClose = (action: () => void) => {
		closeCommandMenu()
		action()
	}

	const trimmedQuery = query.trim()
	const titleHits = hits.filter(hit => hit.kind === 'title')
	const messageHits = hits.filter(hit => hit.kind === 'message')
	const recentChats = chats.slice(0, 5)
	const isPlaceholderTab =
		tab === 'files' || tab === 'images' || tab === 'code'
	const isChatTab = tab === 'all' || tab === 'chats'

	// Search-menu visibility rules.
	const showRecent = !trimmedQuery && isChatTab && recentChats.length > 0
	const showFilesStub = !trimmedQuery && tab === 'all'
	const showTitleHits =
		!!trimmedQuery && isChatTab && titleHits.length > 0
	const showMessageHits =
		!!trimmedQuery && isChatTab && messageHits.length > 0
	const showNoResults =
		!!trimmedQuery && searched && isChatTab && hits.length === 0

	// Model-selection rows: enabled models grouped by provider, checkmark
	// on the active one — same content as the settings picker.
	const enabledKeys = new Set(
		enabledModels.map(item => `${item.providerId}/${item.modelId}`)
	)
	const providerGroups = providers
		.map(provider => ({
			provider,
			items: models.filter(
				item =>
					item.providerId === provider.id &&
					enabledKeys.has(`${provider.id}/${item.id}`)
			)
		}))
		.filter(group => group.items.length > 0)

	const MODE_META: Record<MenuMode, { title: string; description: string; placeholder: string }> = {
		commands: {
			title: t('commandMenu.title'),
			description: t('commandMenu.runCommand'),
			placeholder: t('commandMenu.typeCommand')
		},
		search: {
			title: t('commandMenu.searchTitle'),
			description: t('commandMenu.searchDescription'),
			placeholder: t('commandMenu.searchPlaceholder')
		},
		model: {
			title: t('commandMenu.modelTitle'),
			description: t('commandMenu.modelDescription'),
			placeholder: t('commandMenu.modelPlaceholder')
		}
	}

	return (
		<CommandDialog
			open={open}
			onOpenChange={value => {
				if (!value) closeCommandMenu()
			}}
			title={MODE_META[mode].title}
			description={MODE_META[mode].description}
		>
			{/* The input stays mounted across mode switches, keeping focus. */}
			<CommandInput
				value={query}
				onValueChange={setQuery}
				placeholder={MODE_META[mode].placeholder}
			/>
			{mode === 'search' && (
				<div className='flex items-center gap-1 px-2 pb-1 pt-2'>
					{SEARCH_TAB_KEYS.map(([id, key]) => (
						<TabChip
							key={id}
							active={tab === id}
							onClick={() => setTab(id)}
						>
							{t(key)}
						</TabChip>
					))}
				</div>
			)}
			<CommandList>
				{mode === 'model' ? (
					<>
						<CommandEmpty>{t('commandMenu.noModels')}</CommandEmpty>
						{providerGroups.map(({ provider, items }) => (
							<CommandGroup key={provider.id} heading={provider.name}>
								{items.map(model => {
									const active =
										activeModel?.providerId === provider.id &&
										activeModel?.modelId === model.id
									return (
										<CommandItem
											key={model.id}
											value={`${provider.name} ${model.displayName} ${model.id}`}
											data-checked={active}
											onSelect={() =>
												runAndClose(() =>
													void setActiveModel({
														providerId: provider.id,
														modelId: model.id
													})
												)
											}
										>
											<Bot />
											<span className='min-w-0 flex-1 truncate'>
												{model.displayName}
											</span>
											<span className='hidden max-w-48 shrink-0 truncate text-xs text-muted-foreground sm:inline'>
												{model.id}
											</span>
										</CommandItem>
									)
								})}
							</CommandGroup>
						))}
					</>
				) : mode === 'search' ? (
					isPlaceholderTab ? (
						<PlaceholderSection
							label={t(
								SEARCH_TAB_KEYS.find(([id]) => id === tab)?.[1] ?? ''
							)}
						/>
					) : showNoResults ? (
						<CommandEmpty>{t('commandMenu.noResults')}</CommandEmpty>
					) : (
						<>
						{showRecent && (
							<CommandGroup heading={t('commandMenu.recentActivity')}>
								{recentChats.map(chat => (
									<CommandItem
										key={chat.id}
										value={`recent-${chatTitle(chat, t('chatHistory.fallbackTitle'))}`}
										onSelect={() =>
											runAndClose(() => void selectChat(chat.id))
										}
									>
										<MessageSquare />
										<span className='truncate'>
											{chatTitle(chat, t('chatHistory.fallbackTitle'))}
										</span>
										<CommandShortcut className='shrink-0 text-[11px] tabular-nums'>
											{formatActivity(chat.updatedAt, t)}
										</CommandShortcut>
									</CommandItem>
								))}
							</CommandGroup>
						)}
						{showTitleHits && (
							<CommandGroup heading={t('commandMenu.chatsGroup')}>
								{titleHits.map(hit => (
									<CommandItem
										key={hit.chatId}
										value={hit.chatTitle ?? t('chatHistory.fallbackTitle')}
										onSelect={() =>
											runAndClose(() => void selectChat(hit.chatId))
										}
									>
										<MessageSquare />
										<span className='truncate'>
											{hit.chatTitle ?? t('chatHistory.fallbackTitle')}
										</span>
										<CommandShortcut className='shrink-0 text-[11px] tabular-nums'>
											{formatActivity(hit.updatedAt, t)}
										</CommandShortcut>
									</CommandItem>
								))}
							</CommandGroup>
						)}
						{showMessageHits && (
							<CommandGroup heading={t('commandMenu.inMessages')}>
								{messageHits.map(hit => (
									<CommandItem
										key={hit.chatId}
										value={hit.snippet}
										onSelect={() =>
											runAndClose(() => void selectChat(hit.chatId))
										}
									>
										<MessageSquare />
										<Snippet snippet={hit.snippet} query={query} />
										<CommandShortcut className='shrink-0 text-[11px] tabular-nums'>
											{formatActivity(hit.updatedAt, t)}
										</CommandShortcut>
									</CommandItem>
								))}
							</CommandGroup>
						)}
							{showFilesStub && (
								<CommandGroup heading={t('commandMenu.filesGroup')}>
									<div className='flex items-center gap-2 px-2 py-2 text-sm text-muted-foreground'>
										<FileText className='size-4' />
										{t('commandMenu.noFiles')}
									</div>
								</CommandGroup>
							)}
						</>
					)
				) : (
					<>
						<CommandEmpty>{t('commandMenu.noCommands')}</CommandEmpty>
						<CommandGroup heading={t('commandMenu.title')}>
							<CommandItem
								value='new-chat'
								onSelect={() => runAndClose(() => newChat())}
							>
								<SquarePen />
								{t('commandMenu.newChat')}
							</CommandItem>
						<CommandItem value='change-model' onSelect={enterModel}>
							<Bot />
							{t('commandMenu.changeModel')}
						</CommandItem>
							<CommandItem value='search-in-chats' onSelect={enterSearch}>
								<SearchIcon />
								{t('commandMenu.searchInChats')}
							</CommandItem>
							<CommandItem
								value='open-settings'
								onSelect={() =>
									runAndClose(() => {
										openSettings()
									})
								}
							>
								<Settings />
								{t('commandMenu.openSettings')}
							</CommandItem>
							<CommandItem
								value='toggle-sidebar'
								onSelect={() =>
									runAndClose(() => {
										toggleSidebar()
									})
								}
							>
								<Settings />
								{t('commandMenu.toggleSidebar')}
							</CommandItem>
						</CommandGroup>
					</>
				)}
			</CommandList>
		</CommandDialog>
	)
}
