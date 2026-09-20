import { useTranslation } from 'react-i18next'
import { useSettingsSection } from '@/app/store/settings'
import { settingsSections } from './settings-sections'

export function SettingsContent() {
	const section = useSettingsSection()
	const { t } = useTranslation()
	const current = settingsSections.find(item => item.id === section)

	return (
		<div
			key={section}
			className='flex flex-col flex-1 overflow-y-auto p-8 animate-in fade-in duration-200'
		>
			<h1 className='text-2xl font-medium text-foreground'>
				{current ? t(`settings.${current.nameKey}`) : ''}
			</h1>
			<p className='mt-2 text-sm text-muted-foreground'>
				{t('settings.emptySection', {
					name: current ? t(`settings.${current.nameKey}`) : ''
				})}
			</p>
		</div>
	)
}
