import { cn } from '@/shared/lib/utils'

interface IProps {
	checked: boolean
	onChange: (checked: boolean) => void
	label: string
}

export function SettingToggle({ checked, onChange, label }: IProps) {
	return (
		<button
			type='button'
			role='switch'
			aria-checked={checked}
			aria-label={label}
			onClick={() => onChange(!checked)}
			className={cn(
				'relative h-5 w-[34px] shrink-0 rounded-full transition-colors',
				checked ? 'bg-[#E5E5E5]' : 'bg-[#FFFFFF26]'
			)}
		>
			<span
				className={cn(
					'absolute top-0.5 size-4 rounded-full transition-all',
					checked ? 'left-4 bg-[#242424]' : 'left-0.5 bg-[#E5E5E5]'
				)}
			/>
		</button>
	)
}
