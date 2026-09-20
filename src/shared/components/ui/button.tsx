import { Button as ButtonPrimitive } from '@base-ui/react/button'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/shared/lib/utils'

/**
 * Every variant paints its background (and the outline variant its border)
 * on a ::before layer instead of the element itself. `animated` only picks
 * the layer's behavior:
 *  - false (default): static fill with a smooth color hover
 *  - true: scale-x animation — the layer grows in on hover and compresses
 *    on press; variants with a resting fill (default/destructive) keep it
 *    visible and compress on press instead of hiding.
 */
const LAYER =
	'relative isolate before:absolute before:inset-0 before:-z-1 before:rounded-[inherit] before:transition-colors before:duration-300'

/** Compress-on-press for variants with a resting background. */
const LAYER_PRESS =
	'before:transition-all before:duration-300 before:ease-out hover:active:before:scale-x-90'

/** Grow-in on hover for variants without a resting background. */
const LAYER_GROW =
	'before:origin-center before:scale-x-80 before:opacity-0 before:transition-all before:duration-300 before:ease-out hover:before:scale-x-100 hover:before:opacity-100 hover:active:before:scale-x-90'

const buttonVariants = cva(
	"group/button inline-flex shrink-0 items-center justify-center rounded-md border border-transparent text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5",
	{
		variants: {
			variant: {
				default:
					'text-primary-foreground before:bg-primary hover:before:bg-primary/80',
				outline:
					'text-foreground before:border before:border-border before:bg-foreground/5 before:shadow-xs hover:before:bg-muted/10 hover:text-foreground aria-expanded:before:bg-muted aria-expanded:text-foreground dark:before:border-input dark:before:bg-input/30 dark:hover:before:bg-input/50',
				secondary:
					'text-secondary-foreground before:bg-foreground/5 hover:before:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)] aria-expanded:before:bg-secondary aria-expanded:text-secondary-foreground',
				ghost:
					'hover:before:bg-foreground/5 hover:text-foreground aria-expanded:before:bg-muted aria-expanded:text-foreground dark:hover:before:bg-foreground/5',
				destructive:
					'text-destructive before:bg-destructive/10 hover:before:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:before:bg-destructive/20 dark:hover:before:bg-destructive/30 dark:focus-visible:ring-destructive/40',
				link: 'text-primary underline-offset-4 hover:underline'
			},
			size: {
				default:
					'h-9 gap-1.5 px-2.5 in-data-[slot=button-group]:rounded-md has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2',
				xs: "h-6 gap-1 rounded-[min(var(--radius-md),8px)] px-2 text-xs in-data-[slot=button-group]:rounded-md has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
				sm: 'h-8 gap-1 rounded-[min(var(--radius-md),10px)] px-2.5 in-data-[slot=button-group]:rounded-md has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5',
				lg: 'h-10 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2',
				icon: 'size-9',
				'icon-xs':
					"size-6 rounded-[min(var(--radius-md),8px)] in-data-[slot=button-group]:rounded-md [&_svg:not([class*='size-'])]:size-4",
				'icon-sm':
					'size-8 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-md',
				'icon-lg': 'size-10'
			},
			animated: {
				true: '',
				false: ''
			}
		},
		compoundVariants: [
			// The layer itself lives on every variant via the base; `animated`
			// only swaps the layer's interaction model.
			{
				variant: ['default', 'destructive'],
				animated: false,
				class: LAYER
			},
			{
				variant: ['outline', 'secondary', 'ghost'],
				animated: false,
				class: LAYER
			},
			// Resting-fill variants: keep the fill, compress on press.
			{
				variant: ['default', 'destructive'],
				animated: true,
				class: `${LAYER} ${LAYER_PRESS}`
			},
			// Transparent variants: the layer grows in on hover.
			{
				variant: ['outline', 'secondary', 'ghost'],
				animated: true,
				class: `${LAYER} ${LAYER_GROW}`
			}
		],
		defaultVariants: {
			variant: 'default',
			size: 'default',
			animated: false
		}
	}
)

function Button({
	className,
	variant = 'default',
	size = 'default',
	animated = false,
	...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
	return (
		<ButtonPrimitive
			data-slot='button'
			className={cn(buttonVariants({ variant, size, animated, className }))}
			{...props}
		/>
	)
}

export { Button, buttonVariants }
