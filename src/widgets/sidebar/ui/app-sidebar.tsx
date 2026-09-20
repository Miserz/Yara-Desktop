import { ArrowLeft, Search, Settings, SquarePen } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { AnimatedSwitch, Kbd } from '@/shared/components'
import { closeSettings, openSettings, useView } from '@/app/store/settings'
import { openCommandSearch } from '@/app/store/command-menu'
import { newChat, useActiveChatId, useChats } from '@/entities/chat'
import { SettingsNav } from '@/widgets/settings'
import { ChatHistory } from './chat-history'
import {
	Sidebar,
	SidebarBody,
	SidebarFooter,
	SidebarHeader,
	SidebarItem
} from './sidebar'

export function AppSidebar({ open }: { open: boolean }) {
	const view = useView()

	return (
		<Sidebar open={open}>
			<AnimatedSwitch
				viewKey={view}
				direction={view === 'settings' ? 'forward' : 'back'}
				animation='slide-fade'
			>
				{view === 'settings' ? <SettingsView /> : <ChatsView />}
			</AnimatedSwitch>
		</Sidebar>
	)
}

function ChatsView() {
	const chats = useChats()
	const activeChatId = useActiveChatId()
	const { t } = useTranslation()

	return (
		<>
			<SidebarHeader>
				<div className='flex items-center gap-1 px-3 mt-3'>
					<h2 className='text-xl font-medium'>{t('sidebar.chats')}</h2>
					<Kbd className='text-foreground'>{chats.length}</Kbd>
				</div>
				<div className='flex flex-col mt-2'>
					<SidebarItem
						icon={SquarePen}
						text={t('sidebar.newChat')}
						kbds={['Ctrl', 'T']}
						active={!activeChatId ? true : false}
						onClick={() => newChat()}
					/>
					<SidebarItem
						icon={Search}
						text={t('sidebar.search')}
						kbds={['Ctrl', 'F']}
						onClick={() => openCommandSearch()}
					/>
				</div>
			</SidebarHeader>
			<SidebarBody className='my-4'>
				<ChatHistory />
			</SidebarBody>
			<SidebarFooter>
				<SidebarItem
					icon={Settings}
					text={t('sidebar.settings')}
					onClick={openSettings()}
				/>
			</SidebarFooter>
		</>
	)
}

function SettingsView() {
	const { t } = useTranslation()

	return (
		<>
			<SidebarHeader className='px-3 mt-3'>
				<h2 className='text-xl font-medium'>{t('settings.title')}</h2>
			</SidebarHeader>
			<SidebarBody className='mt-2'>
				<SettingsNav />
			</SidebarBody>
			<SidebarFooter>
				<SidebarItem
					icon={ArrowLeft}
					text={t('sidebar.back')}
					onClick={closeSettings()}
				/>
			</SidebarFooter>
		</>
	)
}
