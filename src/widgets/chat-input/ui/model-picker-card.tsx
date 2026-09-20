import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
	setActiveModel,
	useActiveModel,
	useEnabledModels,
	useModels,
	useProviders
} from '@/app/store/models'
import type { ModelEntry } from '@/shared/api/providers'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/components'

interface IProps {
	onClose: () => void
}

export function ModelPickerCard({ onClose }: IProps) {
	const providers = useProviders()
	const models = useModels()
	const enabledModels = useEnabledModels()
	const activeModel = useActiveModel()
	const { t } = useTranslation()

	const [query, setQuery] = useState('')
	const inputRef = useRef<HTMLInputElement>(null)

	useEffect(() => {
		inputRef.current?.focus()
	}, [])

	const enabled = useMemo(() => {
		const refs = new Set(
			enabledModels.map(item => `${item.providerId}/${item.modelId}`)
		)
		return models.filter(item => refs.has(`${item.providerId}/${item.id}`))
	}, [models, enabledModels])

	const filtered = useMemo(() => {
		const q = query.trim().toLowerCase()
		if (!q) return enabled
		return enabled.filter(
			item =>
				item.displayName.toLowerCase().includes(q) ||
				item.id.toLowerCase().includes(q)
		)
	}, [enabled, query])

	const groups = useMemo(
		() =>
			providers
				.map(provider => ({
					provider,
					items: filtered.filter(item => item.providerId === provider.id)
				}))
				.filter(group => group.items.length > 0),
		[providers, filtered]
	)

	const isActive = (model: ModelEntry) =>
		activeModel?.providerId === model.providerId &&
		activeModel?.modelId === model.id

	const handleSelect = (model: ModelEntry) => {
		setActiveModel({ providerId: model.providerId, modelId: model.id })
		onClose()
	}

	return (
		<div className='flex flex-col rounded-xl border bg-[rgba(35,35,35,0.8)] p-2 shadow-xl backdrop-blur-md'>
			<div className='flex items-center gap-2 border-b border-border px-2 pt-1 pb-2'>
				<Search className='size-4 shrink-0 text-muted-foreground' />
				<input
					ref={inputRef}
					value={query}
					onChange={event => setQuery(event.target.value)}
					onKeyDown={event => {
						if (event.key === 'Escape') onClose()
					}}
					placeholder={t('modelPicker.search')}
					className='w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground'
				/>
			</div>
			<div className='no-scrollbar mt-1 max-h-64 overflow-y-auto'>
				{enabled.length === 0 ? (
					<div className='px-2 py-6 text-center text-sm text-muted-foreground'>
						{t('modelPicker.noEnabled')}
					</div>
				) : filtered.length === 0 ? (
					<div className='px-2 py-6 text-center text-sm text-muted-foreground'>
						{t('modelPicker.noFound')}
					</div>
				) : (
					groups.map(({ provider, items }) => (
						<div key={provider.id} className='p-1'>
							<div className='px-2 py-1.5 text-xs font-medium text-muted-foreground'>
								{provider.name}
							</div>
							{items.map(model => (
								<Button
									className='w-full text-left'
									variant='ghost'
									onClick={() => handleSelect(model)}
								>
									<span className='min-w-0 flex-1 truncate'>
										{model.displayName}
									</span>
									<Check
										className={cn(
											'size-4 shrink-0',
											isActive(model) ? 'opacity-100' : 'opacity-0'
										)}
									/>
								</Button>
							))}
						</div>
					))
				)}
			</div>
		</div>
	)
}
