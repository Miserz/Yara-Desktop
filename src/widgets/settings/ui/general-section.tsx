import { useState } from 'react'
import { ChevronDown, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
	Button,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuTrigger,
	Kbd,
	KbdGroup,
	Separator,
	Tabs,
	TabsList,
	TabsTrigger
} from '@/shared/components'
import {
	changeLanguage,
	getCurrentLanguage,
	LANGUAGES,
	LANGUAGE_NAMES,
	type Language
} from '@/shared/lib/i18n'
import {
	getStartupBehavior,
	setStartupBehavior,
	newChat,
	refreshChats,
	type StartupBehavior
} from '@/entities/chat'
import { clearAllChats } from '@/shared/api/chats'
import { checkForUpdates } from '@/shared/lib/updater'
import { SettingToggle } from './setting-toggle'

const UPDATES_KEY = 'yara.checkUpdates'

function Row({
	label,
	desc,
	children
}: {
	label: string
	desc: string
	children: React.ReactNode
}) {
	return (
		<div className='flex items-center gap-6 py-[13px]'>
			<div className='flex min-w-0 flex-1 flex-col gap-1'>
				<span className='text-sm font-medium text-foreground'>{label}</span>
				<span className='text-[13px] text-muted-foreground'>{desc}</span>
			</div>
			{children}
		</div>
	)
}

function LanguageSelect() {
	const current = getCurrentLanguage()

	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={
					<button
						type='button'
						className='flex h-8 items-center gap-2 rounded-lg border border-[#FFFFFF26] bg-[#FFFFFF0D] px-2.5 text-[13px] text-foreground'
					>
						{LANGUAGE_NAMES[current]}
						<ChevronDown className='size-3.5 text-muted-foreground' />
					</button>
				}
			/>
			<DropdownMenuContent
				align='end'
				sideOffset={6}
				style={{ width: 160 }}
				className='rounded-[10px] border-[#FFFFFF1F] bg-[#242424] p-[5px]'
			>
				<DropdownMenuRadioGroup
					value={current}
					onValueChange={value => changeLanguage(value as Language)}
				>
					{LANGUAGES.map(lang => (
						<DropdownMenuRadioItem
							key={lang}
							value={lang}
							className='rounded-md py-[7px] text-[13px]'
						>
							{LANGUAGE_NAMES[lang]}
						</DropdownMenuRadioItem>
					))}
				</DropdownMenuRadioGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	)
}

function StartupSegmented() {
	const { t } = useTranslation()
	const [value, setValue] = useState<StartupBehavior>(() =>
		getStartupBehavior()
	)

	const options: { id: StartupBehavior; label: string }[] = [
		{ id: 'restore', label: t('settings.general.restoreChat') },
		{ id: 'welcome', label: t('settings.general.newChatOpt') }
	]

	return (
		<Tabs
			value={value}
			onValueChange={id => {
				setValue(id as StartupBehavior)
				setStartupBehavior(id as StartupBehavior)
			}}
		>
			<TabsList variant='default' className='bg-[#FFFFFF0D] dark:bg-[#FFFFFF0D]'>
				{options.map(option => (
					<TabsTrigger
						key={option.id}
						value={option.id}
						className='h-[26px] rounded-[7px] text-[13px]'
					>
						{option.label}
					</TabsTrigger>
				))}
			</TabsList>
		</Tabs>
	)
}

function ClearChats() {
	const { t } = useTranslation()
	const [armed, setArmed] = useState(false)
	const [busy, setBusy] = useState(false)

	const confirm = async () => {
		setBusy(true)
		try {
			await clearAllChats()
			refreshChats()
			newChat()
		} finally {
			setBusy(false)
			setArmed(false)
		}
	}

	if (armed) {
		return (
			<div className='flex items-center gap-2'>
				<Button
					variant='outline'
					size='sm'
					disabled={busy}
					onClick={() => setArmed(false)}
					className='h-8 rounded-lg'
				>
					{t('settings.general.cancel')}
				</Button>
				<Button
					variant='destructive'
					size='sm'
					disabled={busy}
					onClick={() => void confirm()}
					className='h-8 rounded-lg'
				>
					<Trash2 className='size-3.5' />
					{t('settings.general.confirmClear')}
				</Button>
			</div>
		)
	}

	return (
		<Button
			variant='destructive'
			size='sm'
			onClick={() => setArmed(true)}
			className='h-8 rounded-lg'
		>
			<Trash2 className='size-3.5' />
			{t('settings.general.clearChats')}
		</Button>
	)
}

const SHORTCUTS: { key: string; kbds: string[] }[] = [
	{ key: 'newChat', kbds: ['Ctrl', 'T'] },
	{ key: 'commandMenu', kbds: ['Ctrl', 'K'] },
	{ key: 'searchChats', kbds: ['Ctrl', 'F'] },
	{ key: 'newWindow', kbds: ['Ctrl', 'N'] },
	{ key: 'toggleSidebar', kbds: ['Ctrl', 'B'] }
]

export function GeneralSection() {
	const { t } = useTranslation()
	const [checkUpdates, setCheckUpdates] = useState(() => {
		try {
			return localStorage.getItem(UPDATES_KEY) === '1'
		} catch {
			return false
		}
	})

	const toggleUpdates = (checked: boolean) => {
		setCheckUpdates(checked)
		try {
			localStorage.setItem(UPDATES_KEY, checked ? '1' : '0')
		} catch {
			// Storage unavailable — preference applies for this session only.
		}
		if (checked) void checkForUpdates()
	}

	return (
		<div className='flex flex-col'>
			<Row
				label={t('settings.general.language')}
				desc={t('settings.general.languageDesc')}
			>
				<LanguageSelect />
			</Row>
			<Separator className='bg-[#FFFFFF0F]' />
			<Row
				label={t('settings.general.startup')}
				desc={t('settings.general.startupDesc')}
			>
				<StartupSegmented />
			</Row>
			<Separator className='bg-[#FFFFFF0F]' />
			<Row
				label={t('settings.general.updates')}
				desc={t('settings.general.updatesDesc')}
			>
				<SettingToggle
					checked={checkUpdates}
					onChange={toggleUpdates}
					label={t('settings.general.updates')}
				/>
			</Row>
			<Separator className='bg-[#FFFFFF0F]' />
			<Row label={t('settings.general.data')} desc={t('settings.general.dataDesc')}>
				<ClearChats />
			</Row>
			<Separator className='bg-[#FFFFFF0F]' />
			<div className='pt-5 pb-2 text-sm font-medium text-foreground'>
				{t('settings.general.shortcuts')}
			</div>
			{SHORTCUTS.map(item => (
				<div key={item.key}>
					<div className='flex items-center gap-6 py-2.5'>
						<span className='flex-1 text-[13px] text-muted-foreground'>
							{t(`settings.general.shortcut_${item.key}`)}
						</span>
						<KbdGroup>
							{item.kbds.map(kbd => (
								<Kbd key={kbd}>{kbd}</Kbd>
							))}
						</KbdGroup>
					</div>
					<Separator className='bg-[#FFFFFF0F]' />
				</div>
			))}
		</div>
	)
}
