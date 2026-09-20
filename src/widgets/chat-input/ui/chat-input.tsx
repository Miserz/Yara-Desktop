import {
	useEffect,
	useRef,
	useState,
	type ChangeEvent,
	type KeyboardEvent
} from 'react'
import {
	ArrowUp,
	Bot,
	ChevronDown,
	Square
} from 'lucide-react'
import { Button } from '@/shared/components'
import { useTranslation } from 'react-i18next'
import { useActiveModel, useModels } from '@/app/store/models'
import {
	closeModelPicker,
	toggleModelPicker,
	useModelPickerOpen
} from '@/app/store/model-picker'
import { sendMessage, stopGeneration, useIsStreaming } from '@/entities/message'
import { cn } from '@/shared/lib/utils'
import { ModelPickerCard } from './model-picker-card'

const MAX_HEIGHT = 200
const PICKER_ANIMATION_MS = 150

export function ChatInput() {
	const [query, setQuery] = useState('')
	const [pickerMounted, setPickerMounted] = useState(false)
	const [pickerClosing, setPickerClosing] = useState(false)
	const { t } = useTranslation()
	const textareaRef = useRef<HTMLTextAreaElement>(null)
	const containerRef = useRef<HTMLDivElement>(null)
	const closeTimerRef = useRef<number | undefined>(undefined)

	const activeModel = useActiveModel()
	const models = useModels()
	const isStreaming = useIsStreaming()
	const pickerOpen = useModelPickerOpen()

	const active = models.find(
		item =>
			item.providerId === activeModel?.providerId &&
			item.id === activeModel?.modelId
	)

	const canSend =
		!isStreaming && !!(activeModel && active) && query.trim().length > 0

	// The picker's open state lives in a store (the command menu opens it).
	// The card stays mounted while either the store wants it open or the
	// closing animation is still playing out; `pickerClosing` picks the
	// animation direction.
	useEffect(() => {
		if (pickerOpen) {
			window.clearTimeout(closeTimerRef.current)
			setPickerClosing(false)
			setPickerMounted(true)
		} else if (pickerMounted) {
			setPickerClosing(true)
			closeTimerRef.current = window.setTimeout(() => {
				setPickerMounted(false)
				setPickerClosing(false)
			}, PICKER_ANIMATION_MS)
		}
		// pickerMounted intentionally omitted: the effect reacts to store
		// changes; a stale mounted flag re-triggering is harmless (the
		// closing branch only runs when the store just flipped to closed).
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [pickerOpen])

	useEffect(() => {
		return () => window.clearTimeout(closeTimerRef.current)
	}, [])

	useEffect(() => {
		if (!pickerOpen) return
		const handlePointerDown = (event: PointerEvent) => {
			if (!containerRef.current?.contains(event.target as Node)) {
				closeModelPicker()
			}
		}
		document.addEventListener('pointerdown', handlePointerDown)
		return () => document.removeEventListener('pointerdown', handlePointerDown)
	}, [pickerOpen])

	const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
		setQuery(event.target.value)
		const textarea = textareaRef.current
		if (!textarea) return
		textarea.style.height = 'auto'
		textarea.style.height = `${Math.min(textarea.scrollHeight, MAX_HEIGHT)}px`
	}

	const resetInput = () => {
		setQuery('')
		const textarea = textareaRef.current
		if (!textarea) return
		textarea.style.height = 'auto'
	}

	const handleSubmit = () => {
		if (!canSend) return
		const text = query
		resetInput()
		void sendMessage(text)
	}

	const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
		if (event.key !== 'Enter' || event.shiftKey) return
		event.preventDefault()
		handleSubmit()
	}

	return (
		<div
			ref={containerRef}
			className='absolute bottom-0 left-1/2 z-40 w-110 -translate-x-1/2 mb-4 pointer-events-none'
		>
			{pickerMounted && (
				<div
					className={cn(
						'pointer-events-auto absolute bottom-full left-0 right-0 z-50 mb-2',
						pickerClosing
							? 'animate-out fade-out-0 slide-out-to-bottom-2 fill-mode-forwards duration-150'
							: 'animate-in fade-in-0 slide-in-from-bottom-2 duration-150'
					)}
				>
					<ModelPickerCard onClose={closeModelPicker} />
				</div>
			)}
			<div className='pointer-events-auto flex flex-col gap-4 bg-[rgba(35,35,35,0.8)] backdrop-blur-md border p-3 rounded-xl shadow-xl'>
				<textarea
					ref={textareaRef}
					value={query}
					onChange={handleChange}
					onKeyDown={handleKeyDown}
					placeholder={
						activeModel ? t('chat.placeholder') : t('chat.placeholderNoModel')
					}
					rows={1}
					className='max-h-50 resize-none overflow-y-auto bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none'
				/>
				<div className='flex items-center justify-between gap-1'>
					<Button
						variant='secondary'
						size='sm'
						className='h-8 max-w-50 shrink-0 rounded-full text-xs font-normal bg-foreground/5'
						onClick={toggleModelPicker}
					>
						<Bot className='size-4 shrink-0' />
						<span className='min-w-0 flex-1 truncate text-left'>
							{active ? active.displayName : t('chat.selectModel')}
						</span>
						<ChevronDown className='size-3.5 shrink-0 opacity-60' />
					</Button>
					{isStreaming ? (
						<Button
							size='icon-sm'
							className='rounded-full'
							variant='secondary'
							aria-label={t('chat.stopGeneration')}
							onClick={() => void stopGeneration()}
						>
							<Square className='size-3.5' />
						</Button>
					) : (
						<Button
							size='icon-sm'
							className='rounded-full'
							aria-label={t('chat.sendMessage')}
							disabled={!canSend}
							onClick={handleSubmit}
						>
							<ArrowUp />
						</Button>
					)}
				</div>
			</div>
		</div>
	)
}
