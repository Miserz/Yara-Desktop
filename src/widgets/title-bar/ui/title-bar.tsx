import { Minus, RefreshCw, Sidebar, Square, X } from 'lucide-react'
import { motion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/shared/components'
import {
	useUpdaterProgress,
	useUpdaterStatus,
	useUpdaterVersion
} from '@/app/store/updater'
import { downloadAndInstall } from '@/shared/lib/updater'

import { getCurrentWindow } from '@tauri-apps/api/window'

const appWindow = getCurrentWindow()

function UpdatePill() {
	const { t } = useTranslation()
	const status = useUpdaterStatus()
	const version = useUpdaterVersion()
	const progress = useUpdaterProgress()

	if (status !== 'available' && status !== 'downloading' && status !== 'ready')
		return null

	const label =
		status === 'downloading'
			? `${progress}%`
			: status === 'ready'
				? t('updates.restart')
				: t('updates.update')

	return (
		<motion.button
			type='button'
			initial={false}
			animate={{ width: 24 }}
			whileHover={{ width: label.length > 6 ? 112 : 96 }}
			transition={{ duration: 0.18, ease: [0.32, 0.72, 0, 1] }}
			onClick={() => {
				if (status === 'available') void downloadAndInstall()
				if (status === 'ready') void downloadAndInstall()
			}}
			disabled={status === 'downloading'}
			className='group flex h-6 items-center justify-center gap-1.5 overflow-hidden rounded-full bg-primary px-0 text-xs font-medium text-primary-foreground disabled:opacity-80'
			aria-label={label}
			title={version ? `${label} ${version}` : label}
		>
			<RefreshCw
				className={`size-3.5 shrink-0 ${status === 'downloading' ? 'animate-spin' : ''}`}
			/>
			<span className='hidden whitespace-nowrap pr-1 group-hover:inline'>
				{label}
			</span>
		</motion.button>
	)
}

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
			</div>

			<div className='flex items-center'>
				<UpdatePill />
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
