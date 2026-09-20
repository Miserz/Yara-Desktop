import { useState } from 'react'
import { GitBranch, Globe, RefreshCw, Scale } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { openUrl } from '@tauri-apps/plugin-opener'
import { Button } from '@/shared/components'

const APP_VERSION = '0.1.0'
const REPO_URL = 'https://github.com/Miserz/yara'

function Divider() {
	return <div className='h-px w-full bg-[#FFFFFF0F]' />
}

export function AboutSection() {
	const { t } = useTranslation()
	const [updatesNote, setUpdatesNote] = useState(false)

	const open = (url: string) => {
		openUrl(url).catch(() => {})
	}

	const rows: { label: string; value: string }[] = [
		{ label: t('settings.about.version'), value: APP_VERSION },
		{ label: t('settings.about.engine'), value: t('settings.about.engineValue') },
		{
			label: t('settings.about.interface'),
			value: t('settings.about.interfaceValue')
		},
		{
			label: t('settings.about.license'),
			value: t('settings.about.licenseValue')
		},
		{ label: t('settings.about.repository'), value: 'github.com/Miserz/yara' }
	]

	const links = [
		{
			icon: RefreshCw,
			label: t('settings.about.checkUpdates'),
			action: () => setUpdatesNote(true)
		},
		{
			icon: Globe,
			label: t('settings.about.openSite'),
			action: () => open(REPO_URL)
		},
		{
			icon: Scale,
			label: t('settings.about.licenseBtn'),
			action: () => open(`${REPO_URL}/blob/main/LICENSE`)
		},
		{
			icon: GitBranch,
			label: t('settings.about.sourceCode'),
			action: () => open(REPO_URL)
		}
	]

	return (
		<div className='flex flex-col'>
			<div className='flex flex-col items-center gap-3 px-4 pt-4 pb-2'>
				<div className='flex size-16 items-center justify-center rounded-2xl bg-[#E5E5E5] text-[34px] font-semibold text-[#242424]'>
					Y
				</div>
				<div className='text-2xl font-medium text-foreground'>Yara</div>
				<div className='text-sm text-muted-foreground'>
					{t('settings.about.tagline')}
				</div>
				<div className='flex h-6 items-center gap-1.5 rounded-full bg-[#FFFFFF12] px-2.5'>
					<span className='size-1.5 rounded-full bg-[#4ADE80]' />
					<span className='text-xs text-muted-foreground'>
						{t('settings.about.versionBadge', { version: APP_VERSION })}
					</span>
				</div>
				{updatesNote && (
					<div className='text-xs text-muted-foreground'>
						{t('settings.about.updatesSoon')}
					</div>
				)}
			</div>
			<div className='flex flex-col'>
				{rows.map(row => (
					<div key={row.label}>
						<Divider />
						<div className='flex items-center gap-6 py-3'>
							<span className='flex-1 text-sm text-muted-foreground'>
								{row.label}
							</span>
							<span className='text-[13.5px] text-foreground'>{row.value}</span>
						</div>
					</div>
				))}
				<Divider />
			</div>
			<div className='flex flex-wrap items-center justify-center gap-2 py-6'>
				{links.map(link => (
					<Button
						key={link.label}
						variant='outline'
						size='sm'
						onClick={link.action}
						className='h-8 rounded-lg text-[13px] font-normal'
					>
						<link.icon className='size-3.5 text-muted-foreground' />
						{link.label}
					</Button>
				))}
			</div>
			<p className='pb-2 text-center text-xs text-muted-foreground'>
				{t('settings.about.footerNote')}
			</p>
		</div>
	)
}
