import { Accordion as AccordionPrimitive } from '@base-ui/react/accordion'

import { cn } from '@/shared/lib/utils'
import { ChevronDownIcon, ChevronUpIcon } from 'lucide-react'

function Accordion({ className, ...props }: AccordionPrimitive.Root.Props) {
	return (
		<AccordionPrimitive.Root
			data-slot='accordion'
			className={cn('flex w-full flex-col', className)}
			{...props}
		/>
	)
}

function AccordionItem({ className, ...props }: AccordionPrimitive.Item.Props) {
	return (
		<AccordionPrimitive.Item
			data-slot='accordion-item'
			className={cn(className)}
			{...props}
		/>
	)
}

function AccordionTrigger({
	className,
	children,
	...props
}: AccordionPrimitive.Trigger.Props) {
	return (
		<AccordionPrimitive.Header className='flex'>
			<AccordionPrimitive.Trigger
				data-slot='accordion-trigger'
				className={cn(
					'group/accordion-trigger relative flex flex-1 items-start rounded-md px-3 py-2 gap-5 text-sm font-medium transition-all outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:after:border-ring aria-disabled:pointer-events-none aria-disabled:opacity-50 **:data-[slot=accordion-trigger-icon]:size-4',
					className
				)}
				{...props}
			>
				<ChevronDownIcon
					data-slot='accordion-trigger-icon'
					className='pointer-events-none shrink-0 group-aria-expanded/accordion-trigger:hidden'
				/>
				<ChevronUpIcon
					data-slot='accordion-trigger-icon'
					className='pointer-events-none hidden shrink-0 group-aria-expanded/accordion-trigger:inline'
				/>
				{children}
			</AccordionPrimitive.Trigger>
		</AccordionPrimitive.Header>
	)
}

function AccordionContent({
	className,
	children,
	...props
}: AccordionPrimitive.Panel.Props) {
	return (
		<AccordionPrimitive.Panel
			data-slot='accordion-content'
			className='overflow-hidden text-sm data-open:animate-accordion-down data-closed:animate-accordion-up'
			{...props}
		>
			<div
				className={cn(
					'flex h-(--accordion-panel-height) pt-0 pb-2 data-ending-style:h-0 data-starting-style:h-0 [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-foreground [&_p:not(:last-child)]:mb-4'
				)}
			>
				<span className='relative w-4 shrink-0 before:absolute before:inset-0 before:w-px before:bg-border before:h-full before:place-self-center ml-3 mr-2' />
				<div className={cn('flex-1', className)}>{children}</div>
			</div>
		</AccordionPrimitive.Panel>
	)
}

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent }
