import { Minus, Sidebar, Square, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
	Button,
	Menubar,
	MenubarContent,
	MenubarGroup,
	MenubarItem,
	MenubarMenu,
	MenubarShortcut,
	MenubarTrigger
} from '@/shared/components'
import { newChat } from '@/entities/chat'
import { openCommandMenu } from '@/app/store/command-menu'
import { openNewAppWindow } from '@/shared/lib/new-window'

import { getCurrentWindow } from '@tauri-apps/api/window'

const appWindow = getCurrentWindow()

export function TitleBar({
	sidebarOpen,
	onToggleSidebar
}: {
	sidebarOpen: boolean
	onToggleSidebar: () => void
}) {
	const { t } = useTranslation()

	return (
		<div
			data-tauri-drag-region
			className='sticky top-0 shrink-0 flex justify-between items-center p-1 h-(--titlebar-height)'
		>
			<div className='flex'>
				<label className='p-1'>
					<Button
						size='icon-xs'
						variant='ghost'
						className='text-muted-foreground'
						aria-label={t('menu.toggleSidebar')}
						aria-pressed={sidebarOpen}
						onClick={onToggleSidebar}
					>
						<Sidebar />
					</Button>
				</label>
				<Menubar>
					<MenubarMenu>
					<MenubarTrigger>{t('menu.file')}</MenubarTrigger>
					<MenubarContent>
						<MenubarGroup>
							<MenubarItem onClick={() => newChat()}>
								{t('menu.newChat')} <MenubarShortcut>Ctrl T</MenubarShortcut>
							</MenubarItem>
							<MenubarItem onClick={openNewAppWindow}>
								{t('menu.newWindow')}{' '}
								<MenubarShortcut>Ctrl N</MenubarShortcut>
							</MenubarItem>
						</MenubarGroup>
						<MenubarGroup>
							<MenubarItem onClick={() => openCommandMenu()}>
								{t('menu.commandMenu')}{' '}
								<MenubarShortcut>Ctrl K</MenubarShortcut>
							</MenubarItem>
						</MenubarGroup>
					</MenubarContent>
					</MenubarMenu>
				</Menubar>
			</div>

			<div className='flex'>
				<label className='p-1'>
					<Button
						size='icon-xs'
						variant='ghost'
						onClick={() => appWindow.minimize()}
					>
						<Minus></Minus>
					</Button>
				</label>
				<label className='p-1'>
					<Button
						size='icon-xs'
						variant='ghost'
						onClick={() => appWindow.toggleMaximize()}
					>
						<Square className='size-3' />
					</Button>
				</label>
				<label className='p-1'>
					<Button
						size='icon-xs'
						variant='ghost'
						onClick={() => appWindow.close()}
					>
						<X />
					</Button>
				</label>
			</div>
		</div>
	)
}
