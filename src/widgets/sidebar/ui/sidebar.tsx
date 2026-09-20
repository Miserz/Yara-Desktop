import { LucideIcon } from 'lucide-react'
import { ComponentProps, PropsWithChildren } from 'react'
import { cn } from '@/shared/lib/utils'
import { Button, Kbd, KbdGroup } from '@/shared/components'

export function Sidebar({
	children,
	open = true
}: PropsWithChildren & { open?: boolean }) {
	return (
		<aside
			className={cn(
				'flex flex-col h-full shrink-0 overflow-hidden transition-all duration-300',
				open ? 'w-64 opacity-100 mr-2' : 'w-0 opacity-0 mr-0'
			)}
		>
			{children}
		</aside>
	)
}

export function SidebarHeader({
	children,
	className
}: PropsWithChildren & { className?: string }) {
	return <div className={cn('flex flex-col', className)}>{children}</div>
}

export function SidebarBody({
	children,
	className
}: PropsWithChildren & { className?: string }) {
	return (
		<div
			className={cn('flex flex-col flex-1 min-h-0 overflow-y-auto', className)}
		>
			{children}
		</div>
	)
}

export function SidebarFooter({
	children,
	className
}: PropsWithChildren & { className?: string }) {
	return <div className={cn('flex flex-col', className)}>{children}</div>
}

export function SidebarItem({
	icon: Icon,
	text,
	kbds,
	active,
	...props
}: {
	icon: LucideIcon
	text: string
	kbds?: string[]
	active?: boolean
} & ComponentProps<typeof Button>) {
	return (
		<Button
			animated
			variant={active ? 'default' : 'ghost'}
			className='justify-start gap-2 px-3'
			{...props}
		>
			<Icon />
			<span>{text}</span>
			{kbds && (
				<KbdGroup className='ml-auto'>
					{kbds.map(kbd => (
						<Kbd
							key={kbd}
							className={active ? 'bg-primary-foreground/5' : 'bg-foreground/5'}
						>
							{kbd}
						</Kbd>
					))}
				</KbdGroup>
			)}
		</Button>
	)
}
