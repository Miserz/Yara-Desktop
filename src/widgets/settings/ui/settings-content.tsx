import { useTranslation } from 'react-i18next'
import { useSettingsSection } from '@/app/store/settings'
import { settingsSections } from './settings-sections'
import { AboutSection } from './about-section'
import { GeneralSection } from './general-section'
import { ModelsSection } from './models-section'

export function SettingsContent() {
	const section = useSettingsSection()
	const { t } = useTranslation()
	const current = settingsSections.find(item => item.id === section)

	return (
		<div
			key={section}
			className='flex flex-1 flex-col overflow-y-auto p-8 animate-in fade-in duration-200'
		>
			<div className='mx-auto flex w-full max-w-3xl flex-col gap-6'>
				<h1 className='text-2xl font-medium text-foreground'>
					{current ? t(`settings.${current.nameKey}.title`) : ''}
				</h1>
				{section === 'general' && <GeneralSection />}
				{section === 'models' && <ModelsSection />}
				{section === 'about' && <AboutSection />}
				{(section === 'appearance' || !current) && (
					<p className='mt-2 text-sm text-muted-foreground'>
						{t('settings.emptySection', {
							name: current ? t(`settings.${current.nameKey}.title`) : ''
						})}
					</p>
				)}
			</div>
		</div>
	)
}
