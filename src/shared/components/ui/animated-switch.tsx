import {
	useRef,
	useState,
	type AnimationEvent,
	type PropsWithChildren,
	type ReactNode
} from 'react'
import { cn } from '@/shared/lib/utils'

type Direction = 'forward' | 'back'

type NavAnimation = 'slide-fade' | 'fade'

const animations: Record<
	NavAnimation,
	Record<'enter' | 'exit', Record<Direction, string>>
> = {
	'slide-fade': {
		enter: {
			forward: 'fade-in slide-in-from-right-4',
			back: 'fade-in slide-in-from-left-4'
		},
		exit: {
			forward: 'fade-out slide-out-to-left-4',
			back: 'fade-out slide-out-to-right-4'
		}
	},
	fade: {
		enter: {
			forward: 'fade-in',
			back: 'fade-in'
		},
		exit: {
			forward: 'fade-out',
			back: 'fade-out'
		}
	}
}

interface ISnapshot {
	key: string
	node: ReactNode
}

export function AnimatedSwitch({
	viewKey,
	direction = 'forward',
	animation,
	className,
	children
}: PropsWithChildren & {
	viewKey: string
	direction?: Direction
	animation: NavAnimation
	className?: string
}) {
	const [previous, setPrevious] = useState<ISnapshot | null>(null)
	const rendered = useRef<ISnapshot>({ key: viewKey, node: children })
	const hasTransitioned = useRef(false)

	if (rendered.current.key !== viewKey) {
		setPrevious(rendered.current)
		hasTransitioned.current = true
	}
	rendered.current = { key: viewKey, node: children }

	const handleAnimationEnd = (event: AnimationEvent<HTMLDivElement>) => {
		if (event.target === event.currentTarget) setPrevious(null)
	}

	const { enter, exit } = animations[animation]

	return (
		<div
			className={cn(
				'relative flex flex-col flex-1 min-h-0 overflow-hidden',
				className
			)}
		>
			{previous && (
				<div
					key={previous.key}
					onAnimationEnd={handleAnimationEnd}
					className={cn(
						'absolute inset-0 flex flex-col animate-out fill-mode-both duration-200 ease-out',
						exit[direction]
					)}
				>
					{previous.node}
				</div>
			)}
			<div
				key={viewKey}
				className={cn(
					'flex flex-col flex-1 min-h-0 duration-200 ease-out',
					hasTransitioned.current && 'animate-in',
					hasTransitioned.current && enter[direction]
				)}
			>
				{children}
			</div>
		</div>
	)
}
