import { useEffect, useRef, useState, type ReactNode } from 'react'
import './styles/globals.css'
import { AnimatedSwitch } from '@/shared/components'
import { cn } from '@/shared/lib/utils'
import { useBootstrap, useShortcuts } from '@/shared/hooks'
import { AppSidebar } from '@/widgets/sidebar'
import { ChatInput } from '@/widgets/chat-input'
import { CommandMenu } from '@/widgets/command-menu'
import { SettingsContent } from '@/widgets/settings'
import { TitleBar } from '@/widgets/title-bar'
import { Welcome } from '@/widgets/welcome'
import { MessageList, getHydrateSnapshot } from '@/entities/message'
import { useActiveChatId, useWelcomeLift } from '@/entities/chat'
import { loadProvidersData } from './store/models'
import { useView } from './store/settings'
import { toggleSidebar, useOpen } from './store/sidebar'

/**
 * Chat area with transition snapshots. The leaving layer stays mounted
 * during the exit animation; if it re-read the live store it would already
 * show the newly opened chat, rendering the cross-fade invisible. The
 * chat store freezes the leaving content on every switch
 * (`snapshotBeforeHydrate`), and the exit layer renders from that frozen
 * copy instead of the live store.
 */
function ChatArea() {
	const activeChatId = useActiveChatId()
	const welcomeLift = useWelcomeLift()
	const viewKey = activeChatId ?? 'welcome'
	// Frozen node of the view being left вЂ” captured once per switch, before
	// the store hydrates the new chat. While no switch is in flight this is
	// null and only the live view renders.
	const [leaving, setLeaving] = useState<{
		key: string
		node: ReactNode
	} | null>(null)
	const lastKeyRef = useRef(viewKey)

	if (lastKeyRef.current !== viewKey) {
		const snapshot = getHydrateSnapshot()
		// The leaving layer renders the frozen content (or plain Welcome),
		// never the live store.
		const leavingNode =
			lastKeyRef.current === 'welcome' ? (
				<div className='flex flex-1 items-center justify-center'>
					<Welcome />
				</div>
			) : snapshot && snapshot.chatKey === lastKeyRef.current ? (
				<MessageList messages={snapshot.messages} interactive={false} />
			) : null
		if (leavingNode) {
			setLeaving({ key: lastKeyRef.current, node: leavingNode })
		}
		lastKeyRef.current = viewKey
	}

	const handleAnimationEnd = () => setLeaving(null)

	const welcomeNode = (
		<div className='flex flex-1 items-center justify-center'>
			<Welcome />
		</div>
	)

	return (
		<div className='relative flex min-h-0 flex-1 flex-col overflow-hidden'>
			{leaving && (
				<div
					key={leaving.key}
					onAnimationEnd={handleAnimationEnd}
					className={cn(
						'animate-out fade-out fill-mode-both duration-200 ease-out absolute inset-0 flex flex-col',
						// The first sent message lifts the welcome hero up and
						// away; every other switch leaves with a plain fade.
						leaving.key === 'welcome' && welcomeLift && 'slide-out-to-top-4'
					)}
				>
					{leaving.node}
				</div>
			)}
			<div
				key={viewKey}
				className={cn(
					'flex min-h-0 flex-1 flex-col duration-200 ease-out',
					leaving && 'animate-in fade-in'
				)}
			>
				{viewKey === 'welcome' ? welcomeNode : <MessageList />}
			</div>
		</div>
	)
}

function App() {
	const open = useOpen()
	const view = useView()

	useBootstrap()
	useShortcuts()

	useEffect(() => {
		loadProvidersData().catch(() => {})
	}, [])

	return (
		<div className='window'>
			<TitleBar sidebarOpen={open} onToggleSidebar={toggleSidebar()} />
			<div className='flex min-h-0 flex-1 px-2 pb-2'>
				<AppSidebar open={open} />
				<div className='flex flex-col flex-1 overflow-hidden bg-[#181818] border shadow-lg rounded-sm'>
					<AnimatedSwitch
						viewKey={view}
						direction={view === 'settings' ? 'forward' : 'back'}
						animation='fade'
					>
						{view === 'settings' ? (
							<SettingsContent />
						) : (
							<div className='relative flex flex-col flex-1 min-h-0'>
								<ChatArea />
								<div
									aria-hidden='true'
									className='pointer-events-none absolute inset-x-0 top-0 z-30 h-12 backdrop-blur-sm'
									style={{
										background:
											'linear-gradient(to bottom, #181818, transparent)',
										maskImage: 'linear-gradient(to bottom, black, transparent)',
										WebkitMaskImage:
											'linear-gradient(to bottom, black, transparent)'
									}}
								/>
								<div
									aria-hidden='true'
									className='pointer-events-none absolute inset-x-0 bottom-0 z-30 h-28 backdrop-blur-sm'
									style={{
										background:
											'linear-gradient(to top, #181818 0px, #181818 16px, rgba(24,24,24,0) 100%)',
										maskImage: 'linear-gradient(to top, black, transparent)',
										WebkitMaskImage:
											'linear-gradient(to top, black, transparent)'
									}}
								/>
								<ChatInput />
							</div>
						)}
					</AnimatedSwitch>
				</div>
			</div>
			<CommandMenu />
		</div>
	)
}

export default App
