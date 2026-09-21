import { useEffect, useMemo, useState } from 'react'
import {
	Box,
	Check,
	Ellipsis,
	Eye,
	EyeOff,
	Hash,
	Info,
	ListPlus,
	Pencil,
	PlugZap,
	Plus,
	RefreshCw,
	Search,
	Trash2,
	X
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { openUrl } from '@tauri-apps/plugin-opener'
import {
	Button,
	Dialog,
	DialogClose,
	DialogContent,
	DialogTitle,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
	Input,
	InputGroup,
	InputGroupAddon,
	InputGroupButton,
	InputGroupInput,
	Separator,
	Tabs,
	TabsList,
	TabsTrigger
} from '@/shared/components'
import {
	addModel,
	addProvider,
	fetchModels,
	removeModel,
	removeProvider,
	testProvider,
	toggleModelEnabled,
	updateProvider,
	useActiveModel,
	useCustomModels,
	useEnabledModels,
	useModels,
	useModelsStore,
	useProviders,
	useSyncing
} from '@/app/store/models'
import { fetchRemoteModels, type Provider } from '@/shared/api/providers'
import { resolveDisplayName } from '@/shared/lib/model-name'
import { cn } from '@/shared/lib/utils'

function normalizeUrl(value: string) {
	return value.trim().replace(/\/+$/, '')
}

function validUrl(value: string) {
	return value.startsWith('http://') || value.startsWith('https://')
}

export function ModelsSection() {
	const { t } = useTranslation()
	const providers = useProviders()
	const models = useModels()
	const customModels = useCustomModels()
	const enabledModels = useEnabledModels()
	const activeModel = useActiveModel()
	const syncing = useSyncing()

	const [selectedId, setSelectedId] = useState<string | null>(null)
	const [query, setQuery] = useState('')
	const [menuNote, setMenuNote] = useState<{
		ok: boolean
		text: string
	} | null>(null)
	const [lastSync, setLastSync] = useState<number | null>(null)
	const [providerDialog, setProviderDialog] = useState<
		{ mode: 'create' } | { mode: 'edit'; id: string } | null
	>(null)
	const [addModelOpen, setAddModelOpen] = useState(false)
	const [deleteId, setDeleteId] = useState<string | null>(null)

	const selected =
		providers.find(item => item.id === selectedId) ?? providers[0] ?? null

	const enabledKeys = useMemo(
		() =>
			new Set(enabledModels.map(item => `${item.providerId}/${item.modelId}`)),
		[enabledModels]
	)

	const providerModels = useMemo(() => {
		if (!selected) return []
		return models.filter(
			item =>
				item.providerId === selected.id &&
				enabledKeys.has(`${item.providerId}/${item.id}`)
		)
	}, [models, enabledKeys, selected])

	const counts = useMemo(() => {
		const map = new Map<string, number>()
		for (const item of enabledModels) {
			map.set(item.providerId, (map.get(item.providerId) ?? 0) + 1)
		}
		return map
	}, [enabledModels])

	const filtered = useMemo(() => {
		const q = query.trim().toLowerCase()
		if (!q) return providerModels
		return providerModels.filter(
			item =>
				item.displayName.toLowerCase().includes(q) ||
				item.id.toLowerCase().includes(q)
		)
	}, [providerModels, query])

	useEffect(() => {
		if (!menuNote) return
		const timer = setTimeout(() => setMenuNote(null), 4000)
		return () => clearTimeout(timer)
	}, [menuNote])

	if (!selected) {
		return (
			<>
				<div className='flex w-full items-center gap-8'>
					<div className='flex size-[120px] shrink-0 items-center justify-center rounded-[20px] border border-[#FFFFFF0F] bg-[#FFFFFF06]'>
						<PlugZap className='size-9 text-muted-foreground' />
					</div>
					<div className='flex flex-1 flex-col gap-3'>
						<p className='text-base font-medium text-foreground'>
							{t('settings.models.emptyTitle')}
						</p>
						<p className='text-[13px] leading-5 text-muted-foreground'>
							{t('settings.models.emptyDesc')}
						</p>
						<div className='flex items-center gap-3 pt-1'>
							<Button
								onClick={() => setProviderDialog({ mode: 'create' })}
								className='h-[34px] rounded-lg'
							>
								<Plus className='size-3.5' />
								{t('settings.models.addProvider')}
							</Button>
							<button
								type='button'
								onClick={() =>
									openUrl('https://github.com/Miserz/yara#readme').catch(
										() => {}
									)
								}
								className='text-xs text-[#7C9EFF] hover:underline'
							>
								{t('settings.models.docsLink')}
							</button>
						</div>
					</div>
				</div>
				{providerDialog && (
					<ProviderDialog
						key={
							providerDialog.mode +
							('id' in providerDialog ? providerDialog.id : '')
						}
						dialog={providerDialog}
						providers={providers}
						onClose={() => setProviderDialog(null)}
						onSaved={id => {
							setSelectedId(id)
							setLastSync(Date.now())
						}}
					/>
				)}
			</>
		)
	}

	const refresh = async () => {
		const ok = await fetchModels(selected.id)
		if (ok) {
			setLastSync(Date.now())
		} else {
			setMenuNote({ ok: false, text: t('settings.models.syncFailed') })
		}
	}

	const test = async () => {
		try {
			await testProvider(selected.baseUrl, selected.apiKey)
			setMenuNote({ ok: true, text: t('settings.models.connectionOk') })
		} catch (error) {
			setMenuNote({
				ok: false,
				text: error instanceof Error ? error.message : String(error)
			})
		}
	}

	return (
		<div className='flex flex-col gap-4'>
			<div className='flex flex-wrap items-center gap-2'>
				<Tabs
					value={selected.id}
					onValueChange={value => {
						setSelectedId(value)
						setQuery('')
					}}
				>
					<TabsList variant='pills'>
						{providers.map(provider => (
							<TabsTrigger
								key={provider.id}
								value={provider.id}
								variant='pills'
								className='h-[34px] flex-none gap-2 px-3 text-[13px] text-foreground dark:text-foreground'
							>
								<span
									className={cn(
										'flex size-5 items-center justify-center rounded-md text-[10px] font-semibold',
										provider.id === selected.id
											? 'bg-[#FFFFFF26] text-[#242424]'
											: 'bg-[#FFFFFF12] text-foreground'
									)}
								>
									{provider.name.charAt(0).toUpperCase()}
								</span>
								{provider.name}
								<span
									className={cn(
										'text-[11.5px]',
										provider.id === selected.id
											? 'text-[#242424]'
											: 'text-muted-foreground'
									)}
								>
									{counts.get(provider.id) ?? 0}
								</span>
							</TabsTrigger>
						))}
					</TabsList>
				</Tabs>
				<button
					type='button'
					onClick={() => setProviderDialog({ mode: 'create' })}
					className='flex h-[34px] items-center justify-center gap-1.5 rounded-full border border-[#FFFFFF26] bg-[#FFFFFF0D] px-3 text-[13px] font-medium text-muted-foreground'
				>
					<Plus className='size-[15px]' />
					{t('settings.models.add')}
				</button>
				<div className='min-w-2 flex-1' />
				<span className='text-xs text-muted-foreground'>
					{syncing
						? t('settings.models.syncing')
						: lastSync
							? t('settings.models.syncedJustNow')
							: t('settings.models.notSynced')}
				</span>
			</div>

			<div className='flex items-center gap-2'>
				<InputGroup className='h-8 flex-1 rounded-lg border-[#FFFFFF26] bg-[#FFFFFF0D] shadow-none dark:bg-[#FFFFFF0D]'>
					<InputGroupAddon className='pl-[11px]'>
						<Search className='size-3.5' />
					</InputGroupAddon>
					<InputGroupInput
						value={query}
						onChange={event => setQuery(event.target.value)}
						placeholder={t('settings.models.searchPlaceholder', {
							provider: selected.name
						})}
						className='h-full text-[13px] placeholder:text-[#6B6B6B] md:text-[13px]'
					/>
				</InputGroup>
				<Button
					variant='ghost'
					size='sm'
					onClick={() => setAddModelOpen(true)}
					className='h-8 shrink-0 rounded-lg border border-[#FFFFFF26] bg-[#FFFFFF0D] px-3 font-medium'
				>
					<Plus className='size-3.5 text-muted-foreground' />
					{t('settings.models.addModel')}
				</Button>
				<DropdownMenu>
					<DropdownMenuTrigger
						render={
							<button
								type='button'
								aria-label={t('settings.models.providerMenu')}
								className='flex size-8 shrink-0 items-center justify-center rounded-lg border border-[#FFFFFF26] bg-[#FFFFFF0D] text-muted-foreground'
							>
								<Ellipsis className='size-[15px]' />
							</button>
						}
					/>
					<DropdownMenuContent
						align='end'
						sideOffset={6}
						style={{ width: 200 }}
						className='rounded-[10px] border-[#FFFFFF1F] bg-[#242424] p-[5px]'
					>
						<DropdownMenuItem
							onClick={() =>
								setProviderDialog({ mode: 'edit', id: selected.id })
							}
							className='rounded-md py-[7px] text-[12.5px]'
						>
							<Pencil className='size-3.5 text-muted-foreground' />
							{t('settings.models.rename')}
						</DropdownMenuItem>
						<DropdownMenuItem
							onClick={() => void refresh()}
							className='rounded-md py-[7px] text-[12.5px]'
						>
							<RefreshCw className='size-3.5 text-muted-foreground' />
							{t('settings.models.refreshModels')}
						</DropdownMenuItem>
						<DropdownMenuItem
							onClick={() => void test()}
							className='rounded-md py-[7px] text-[12.5px]'
						>
							<PlugZap className='size-3.5 text-muted-foreground' />
							{t('settings.models.testConnection')}
						</DropdownMenuItem>
						<DropdownMenuSeparator className='mx-1 bg-[#FFFFFF14]' />
						<DropdownMenuItem
							variant='destructive'
							onClick={() => setDeleteId(selected.id)}
							className='rounded-md py-[7px] text-[12.5px]'
						>
							<Trash2 className='size-3.5' />
							{t('settings.models.deleteProvider')}
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>

			{menuNote && (
				<div
					className={cn(
						'rounded-lg border px-3 py-2 text-[13px]',
						menuNote.ok
							? 'border-[#4ADE8026] bg-[#4ADE800A] text-foreground'
							: 'border-[#F2555A33] bg-[#F2555A0A] text-[#F2555A]'
					)}
				>
					{menuNote.text}
				</div>
			)}

			<div className='flex flex-col'>
				{filtered.length === 0 && (
					<p className='py-8 text-center text-sm text-muted-foreground'>
						{t('settings.models.noModels')}
					</p>
				)}
				{filtered.map((model, index) => {
					const key = `${model.providerId}/${model.id}`
					const isActive =
						activeModel?.providerId === model.providerId &&
						activeModel?.modelId === model.id
					const isCustom = customModels.some(
						item => item.providerId === model.providerId && item.id === model.id
					)
					const remove = () => {
						if (isCustom) {
							void removeModel(model.providerId, model.id)
						} else {
							void toggleModelEnabled({
								providerId: model.providerId,
								modelId: model.id
							})
						}
					}
					return (
						<div key={key}>
							{index > 0 && <Separator className='bg-[#FFFFFF0F]' />}
							<div className='flex items-center gap-2.5 py-[9px]'>
								<Box className='size-[15px] shrink-0 text-muted-foreground' />
								<div className='flex min-w-0 flex-1 flex-col gap-0.5'>
									<span className='truncate text-[13.5px] font-medium text-foreground'>
										{model.displayName}
										{isActive && (
											<span className='ml-2 text-xs font-normal text-muted-foreground'>
												●
											</span>
										)}
									</span>
									<span className='truncate text-xs text-muted-foreground'>
										{model.id}
									</span>
								</div>
								<Button
									variant='ghost'
									size='icon-sm'
									onClick={remove}
									aria-label={`${t('settings.models.delete')}: ${model.displayName}`}
									className='shrink-0 text-muted-foreground hover:text-[#F2555A]'
								>
									<Trash2 className='size-4' />
								</Button>
							</div>
						</div>
					)
				})}
			</div>

			{providerDialog && (
				<ProviderDialog
					key={
						providerDialog.mode +
						('id' in providerDialog ? providerDialog.id : '')
					}
					dialog={providerDialog}
					providers={providers}
					onClose={() => setProviderDialog(null)}
					onSaved={id => {
						setSelectedId(id)
						setLastSync(Date.now())
					}}
				/>
			)}
			{addModelOpen && selected && (
				<AddModelDialog
					provider={selected}
					onClose={() => setAddModelOpen(false)}
				/>
			)}
			{deleteId && (
				<DeleteProviderDialog
					provider={providers.find(item => item.id === deleteId) ?? null}
					onClose={() => setDeleteId(null)}
					onDeleted={() => {
						if (selectedId === deleteId) setSelectedId(null)
					}}
				/>
			)}
		</div>
	)
}

function Field({
	label,
	children
}: {
	label: string
	children: React.ReactNode
}) {
	return (
		<label className='flex flex-col gap-[7px]'>
			<span className='text-[13px] font-medium text-foreground'>{label}</span>
			{children}
		</label>
	)
}

const fieldClass =
	'h-9 rounded-lg border-[#FFFFFF26] bg-[#FFFFFF0D] px-3 text-[13px] md:text-[13px] placeholder:text-[#6B6B6B] focus-visible:border-[#FFFFFF40]'

function ProviderDialog({
	dialog,
	providers,
	onClose,
	onSaved
}: {
	dialog: { mode: 'create' } | { mode: 'edit'; id: string }
	providers: Provider[]
	onClose: () => void
	onSaved: (id: string) => void
}) {
	const { t } = useTranslation()
	const editing =
		dialog.mode === 'edit'
			? (providers.find(item => item.id === dialog.id) ?? null)
			: null

	const [name, setName] = useState(editing?.name ?? '')
	const [baseUrl, setBaseUrl] = useState(editing?.baseUrl ?? '')
	const [apiKey, setApiKey] = useState(editing?.apiKey ?? '')
	const [showKey, setShowKey] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [saving, setSaving] = useState(false)
	const [testing, setTesting] = useState(false)
	const [testOk, setTestOk] = useState<number | null>(null)
	const [testError, setTestError] = useState<string | null>(null)

	const validate = (): { name: string; url: string; key: string } | null => {
		const cleanName = name.trim()
		const cleanUrl = normalizeUrl(baseUrl)
		const cleanKey = apiKey.trim()
		if (!cleanName) {
			setError(t('settings.models.nameRequired'))
			return null
		}
		if (!cleanUrl) {
			setError(t('settings.models.urlRequired'))
			return null
		}
		if (!validUrl(cleanUrl)) {
			setError(t('settings.models.urlInvalid'))
			return null
		}
		const duplicate = providers.some(
			item =>
				(dialog.mode === 'edit' ? item.id !== dialog.id : true) &&
				(item.name.toLowerCase() === cleanName.toLowerCase() ||
					item.baseUrl === cleanUrl)
		)
		if (duplicate) {
			setError(t('settings.models.duplicate'))
			return null
		}
		setError(null)
		return { name: cleanName, url: cleanUrl, key: cleanKey }
	}

	const runTest = async () => {
		const clean = validate()
		if (!clean) return
		setTesting(true)
		setTestOk(null)
		setTestError(null)
		try {
			await testProvider(clean.url, clean.key)
			let count: number | null = null
			if (dialog.mode === 'edit') {
				const remote = await fetchRemoteModels(dialog.id).catch(() => null)
				count = remote ? remote.length : null
			}
			setTestOk(count)
		} catch (err) {
			setTestError(err instanceof Error ? err.message : String(err))
		} finally {
			setTesting(false)
		}
	}

	const save = async () => {
		const clean = validate()
		if (!clean) return
		setSaving(true)
		try {
			if (dialog.mode === 'create') {
				const created = await addProvider({
					name: clean.name,
					baseUrl: clean.url,
					apiKey: clean.key
				})
				onSaved(created.id)
			} else {
				await updateProvider({
					id: dialog.id,
					name: clean.name,
					baseUrl: clean.url,
					apiKey: clean.key
				})
				onSaved(dialog.id)
			}
			onClose()
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err))
		} finally {
			setSaving(false)
		}
	}

	return (
		<Dialog open onOpenChange={open => !open && onClose()}>
			<DialogContent
				showCloseButton={false}
				className='gap-4 border-[#FFFFFF1F] bg-[#242424] p-6 sm:max-w-[500px]'
			>
				<div className='flex items-start justify-between'>
					<div className='flex flex-col gap-1'>
						<DialogTitle className='text-[18px] font-medium text-foreground'>
							{dialog.mode === 'create'
								? t('settings.models.addProvider')
								: t('settings.models.editProvider')}
						</DialogTitle>
						{editing && (
							<p className='text-[13px] text-muted-foreground'>
								{t('settings.models.editSubtitle', { name: editing.name })}
							</p>
						)}
					</div>
					<DialogClose className='flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-white/10'>
						<X className='size-4' />
					</DialogClose>
				</div>

				<Field label={t('settings.models.providerName')}>
					<Input
						value={name}
						onChange={event => setName(event.target.value)}
						placeholder='OpenRouter'
						className={fieldClass}
					/>
				</Field>
				<Field label={t('settings.models.baseUrl')}>
					<Input
						value={baseUrl}
						onChange={event => setBaseUrl(event.target.value)}
						placeholder='https://openrouter.ai/api/v1'
						spellCheck={false}
						className={fieldClass}
					/>
				</Field>
				<Field label={t('settings.models.apiKey')}>
					<InputGroup className='rounded-lg border-[#FFFFFF26] bg-[#FFFFFF0D] shadow-none dark:bg-[#FFFFFF0D]'>
						<InputGroupInput
							value={apiKey}
							type={showKey ? 'text' : 'password'}
							onChange={event => setApiKey(event.target.value)}
							spellCheck={false}
							className='text-[13px] md:text-[13px]'
						/>
						<InputGroupAddon align='inline-end'>
							<InputGroupButton
								size='icon-xs'
								onClick={() => setShowKey(value => !value)}
								aria-label={
									showKey
										? t('settings.models.hideKey')
										: t('settings.models.showKey')
								}
							>
								{showKey ? (
									<EyeOff className='size-4' />
								) : (
									<Eye className='size-4' />
								)}
							</InputGroupButton>
						</InputGroupAddon>
					</InputGroup>
				</Field>

				{(testOk !== null || testError) && (
					<div
						className={cn(
							'flex items-center gap-2.5 rounded-[9px] border p-2.5',
							testError
								? 'border-[#F2555A33] bg-[#F2555A0A]'
								: 'border-[#4ADE8026] bg-[#4ADE800A]'
						)}
					>
						{testError ? (
							<X className='size-[15px] shrink-0 text-[#F2555A]' />
						) : (
							<Check className='size-[15px] shrink-0 text-[#4ADE80]' />
						)}
						<div className='flex min-w-0 flex-1 flex-col gap-0.5'>
							<span className='text-[13px] font-medium text-foreground'>
								{testError
									? t('settings.models.connectionFailed')
									: t('settings.models.connectionOk')}
							</span>
							<span className='truncate text-[11.5px] text-muted-foreground'>
								{testError ??
									(testOk !== null
										? t('settings.models.modelsAvailable', { count: testOk })
										: t('settings.models.checkedJustNow'))}
							</span>
						</div>
						<Button
							variant='ghost'
							size='xs'
							disabled={testing}
							onClick={() => void runTest()}
							className='h-7 shrink-0 rounded-[7px] border border-[#FFFFFF26] bg-[#FFFFFF0D] text-xs'
						>
							<RefreshCw className='size-3' />
							{t('settings.models.test')}
						</Button>
					</div>
				)}

				{error && <p className='text-[13px] text-[#F2555A]'>{error}</p>}

				<div className='flex items-center justify-between pt-1'>
					{editing ? (
						<span className='text-xs text-muted-foreground'>
							{t('settings.models.keyStoredLocally')}
						</span>
					) : (
						<span />
					)}
					<div className='flex items-center gap-2'>
						{testOk === null && !testError && (
							<Button
								variant='ghost'
								size='sm'
								disabled={testing}
								onClick={() => void runTest()}
								className='h-8 rounded-lg border border-[#FFFFFF26] bg-[#FFFFFF0D]'
							>
								<PlugZap className='size-3.5 text-muted-foreground' />
								{testing
									? t('settings.models.testing')
									: t('settings.models.test')}
							</Button>
						)}
						<DialogClose
							render={
								<Button
									variant='ghost'
									size='sm'
									className='h-8 rounded-lg border border-[#FFFFFF26] bg-[#FFFFFF0D]'
								>
									{t('settings.models.cancel')}
								</Button>
							}
						/>
						<Button
							disabled={saving}
							onClick={() => void save()}
							className='h-8 rounded-lg'
						>
							<Check className='size-3.5' />
							{t('settings.models.save')}
						</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	)
}

function DeleteProviderDialog({
	provider,
	onClose,
	onDeleted
}: {
	provider: Provider | null
	onClose: () => void
	onDeleted: () => void
}) {
	const { t } = useTranslation()
	const [busy, setBusy] = useState(false)

	const confirm = async () => {
		if (!provider) return
		setBusy(true)
		try {
			await removeProvider(provider.id)
			onDeleted()
			onClose()
		} finally {
			setBusy(false)
		}
	}

	return (
		<Dialog open onOpenChange={open => !open && onClose()}>
			<DialogContent
				showCloseButton={false}
				className='gap-4 border-[#FFFFFF1F] bg-[#242424] p-6 sm:max-w-[400px]'
			>
				<DialogTitle className='text-[16px] font-medium text-foreground'>
					{t('settings.models.deleteProviderTitle', {
						name: provider?.name ?? ''
					})}
				</DialogTitle>
				<p className='text-[13px] text-muted-foreground'>
					{t('settings.models.deleteProviderDesc')}
				</p>
				<div className='flex justify-end gap-2'>
					<DialogClose
						render={
							<Button
								variant='ghost'
								size='sm'
								className='h-8 rounded-lg border border-[#FFFFFF26] bg-[#FFFFFF0D]'
							>
								{t('settings.models.cancel')}
							</Button>
						}
					/>
					<Button
						variant='destructive'
						size='sm'
						disabled={busy}
						onClick={() => void confirm()}
						className='h-8 rounded-lg'
					>
						<Trash2 className='size-3.5' />
						{t('settings.models.delete')}
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	)
}

function AddModelDialog({
	provider,
	onClose
}: {
	provider: Provider
	onClose: () => void
}) {
	const { t } = useTranslation()
	const enabledModels = useEnabledModels()
	const remoteByProvider = useModelsStore(state => state.remoteByProvider)

	const [mode, setMode] = useState<'list' | 'id'>('list')
	const [search, setSearch] = useState('')
	const [checked, setChecked] = useState<Set<string> | null>(null)
	const [modelId, setModelId] = useState('')
	const [error, setError] = useState<string | null>(null)
	const [busy, setBusy] = useState(false)

	const remote = remoteByProvider[provider.id] ?? []

	useEffect(() => {
		void fetchModels(provider.id)
	}, [provider.id])

	useEffect(() => {
		if (checked !== null) return
		setChecked(
			new Set(
				enabledModels
					.filter(item => item.providerId === provider.id)
					.map(item => item.modelId)
			)
		)
	}, [checked, enabledModels, provider.id])

	const candidates = useMemo(() => {
		const q = search.trim().toLowerCase()
		if (!q) return remote
		return remote.filter(
			item =>
				item.id.toLowerCase().includes(q) ||
				item.displayName.toLowerCase().includes(q)
		)
	}, [remote, search])

	const toggle = (id: string) => {
		setChecked(prev => {
			const next = new Set(prev ?? [])
			if (next.has(id)) next.delete(id)
			else next.add(id)
			return next
		})
	}

	const applyList = async () => {
		if (!checked) return
		setBusy(true)
		try {
			const enabled = new Set(
				enabledModels
					.filter(item => item.providerId === provider.id)
					.map(item => item.modelId)
			)
			for (const id of checked) {
				if (!enabled.has(id)) {
					await toggleModelEnabled({
						providerId: provider.id,
						modelId: id
					})
				}
			}
			onClose()
		} finally {
			setBusy(false)
		}
	}

	const applyId = async () => {
		const id = modelId.trim()
		if (!id) {
			setError(t('settings.models.idRequired'))
			return
		}
		setBusy(true)
		setError(null)
		try {
			await addModel({
				providerId: provider.id,
				id,
				displayName: resolveDisplayName(id, null)
			})
			await toggleModelEnabled({ providerId: provider.id, modelId: id })
			onClose()
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err))
		} finally {
			setBusy(false)
		}
	}

	const preview = modelId.trim() ? resolveDisplayName(modelId.trim(), null) : ''

	return (
		<Dialog open onOpenChange={open => !open && onClose()}>
			<DialogContent
				showCloseButton={false}
				className='gap-4 border-[#FFFFFF1F] bg-[#242424] p-[22px] sm:max-w-[600px]'
			>
				<div className='flex items-start justify-between'>
					<div className='flex flex-col gap-1'>
						<DialogTitle className='text-[18px] font-medium text-foreground'>
							{t('settings.models.addModelTitle', { provider: provider.name })}
						</DialogTitle>
						<p className='text-[13px] text-muted-foreground'>
							{t('settings.models.addModelSubtitle')}
						</p>
					</div>
					<DialogClose className='flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-white/10'>
						<X className='size-4' />
					</DialogClose>
				</div>

				<Tabs
					value={mode}
					onValueChange={value => setMode(value as 'list' | 'id')}
				>
					<TabsList variant='default' className='w-full bg-[#FFFFFF0A] dark:bg-[#FFFFFF0A]'>
						{(
							[
								{
									id: 'list',
									icon: ListPlus,
									label: t('settings.models.fromList')
								},
								{ id: 'id', icon: Hash, label: t('settings.models.byId') }
							] as const
						).map(option => (
							<TabsTrigger
								key={option.id}
								value={option.id}
								className='h-[30px] rounded-[7px] text-[13px]'
							>
								<option.icon className='size-3.5' />
								{option.label}
							</TabsTrigger>
						))}
					</TabsList>
				</Tabs>

				{mode === 'list' ? (
					<>
						<InputGroup className='rounded-lg border-[#FFFFFF26] bg-[#FFFFFF0D] shadow-none dark:bg-[#FFFFFF0D]'>
							<InputGroupAddon>
								<Search className='size-[15px]' />
							</InputGroupAddon>
							<InputGroupInput
								value={search}
								onChange={event => setSearch(event.target.value)}
								placeholder={t('settings.models.searchRemotePlaceholder', {
									count: remote.length
								})}
								className='text-[13px] placeholder:text-[#6B6B6B] md:text-[13px]'
							/>
						</InputGroup>
						<div className='flex max-h-[236px] flex-col gap-0.5 overflow-y-auto'>
							{candidates.map(item => {
								const on = checked?.has(item.id) ?? false
								return (
									<button
										key={item.id}
										type='button'
										onClick={() => toggle(item.id)}
										className={cn(
											'flex w-full items-center gap-2.5 rounded-[7px] p-2 text-left',
											on ? 'bg-[#FFFFFF0A]' : 'hover:bg-white/5'
										)}
									>
										<span
											className={cn(
												'flex size-4 shrink-0 items-center justify-center rounded border',
												on
													? 'border-transparent bg-[#E5E5E5]'
													: 'border-[#FFFFFF33]'
											)}
										>
											{on && <Check className='size-3 text-[#242424]' />}
										</span>
										<span className='flex min-w-0 flex-1 flex-col gap-0.5'>
											<span className='truncate text-[13.5px] font-medium text-foreground'>
												{item.displayName}
											</span>
											<span className='truncate text-xs text-muted-foreground'>
												{item.id}
											</span>
										</span>
									</button>
								)
							})}
							{candidates.length === 0 && (
								<p className='py-6 text-center text-[13px] text-muted-foreground'>
									{t('settings.models.noRemote')}
								</p>
							)}
						</div>
					</>
				) : (
					<div className='flex flex-col gap-3.5'>
						<Field label={t('settings.models.modelId')}>
							<Input
								value={modelId}
								onChange={event => setModelId(event.target.value)}
								placeholder='openai/gpt-5.2-turbo'
								spellCheck={false}
								className={fieldClass}
							/>
						</Field>
						<div className='flex gap-2 rounded-lg bg-[#7C9EFF14] p-2.5'>
							<Info className='size-3.5 shrink-0 text-[#7C9EFF]' />
							<p className='text-[12.5px] leading-[1.4] text-muted-foreground'>
								{t('settings.models.idHint')}
							</p>
						</div>
						{preview && (
							<div className='flex items-center gap-2.5 rounded-[9px] border border-[#4ADE8026] bg-[#4ADE800A] p-2.5'>
								<Check className='size-[15px] shrink-0 text-[#4ADE80]' />
								<div className='flex min-w-0 flex-1 flex-col gap-0.5'>
									<span className='truncate text-[13.5px] font-medium text-foreground'>
										{preview}
									</span>
									<span className='truncate text-[11.5px] text-muted-foreground'>
										{t('settings.models.previewAs', { name: preview })}
									</span>
								</div>
							</div>
						)}
						{error && <p className='text-[13px] text-[#F2555A]'>{error}</p>}
					</div>
				)}

				<div className='flex items-center justify-between'>
					<span className='text-[12.5px] text-muted-foreground'>
						{mode === 'list'
							? t('settings.models.selectedCount', {
									count: checked?.size ?? 0
								})
							: t('settings.models.providerLabel', {
									provider: provider.name
								})}
					</span>
					<div className='flex items-center gap-2'>
						<DialogClose
							render={
								<Button
									variant='ghost'
									size='sm'
									className='h-8 rounded-lg border border-[#FFFFFF26] bg-[#FFFFFF0D]'
								>
									{t('settings.models.cancel')}
								</Button>
							}
						/>
						<Button
							disabled={busy}
							onClick={() => void (mode === 'list' ? applyList() : applyId())}
							className='h-8 rounded-lg'
						>
							{mode === 'list' ? (
								<Check className='size-3.5' />
							) : (
								<Plus className='size-3.5' />
							)}
							{t('settings.models.add')}
						</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	)
}
