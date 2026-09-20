import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { MarkdownContent } from './markdown-content'

interface IProps {
	reasoning: string
	/** While streaming reasoning, the block stays open and shows a hint. */
	streaming: boolean
}

export function ThinkingBlock({ reasoning, streaming }: IProps) {
	const { t } = useTranslation()
	const [open, setOpen] = useState(true)

	return (
		<div className='mb-3'>
			<button
				type='button'
				onClick={() => setOpen(value => !value)}
				className='flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground'
			>
				<ChevronDown
					className={`size-3.5 transition-transform ${open ? '' : '-rotate-90'}`}
				/>
				{streaming ? t('message.thinkingLabel') : t('message.thoughtProcess')}
			</button>
			{open && (
				<div className='mt-2 border-l-2 border-border pl-3 text-muted-foreground'>
					<MarkdownContent content={reasoning} />
				</div>
			)}
		</div>
	)
}
