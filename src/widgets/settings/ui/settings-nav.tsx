import { useTranslation } from 'react-i18next'
import { setSettingsSection, useSettingsSection } from '@/app/store/settings'
import { SidebarItem } from '@/widgets/sidebar'
import { settingsSections } from './settings-sections'

export function SettingsNav() {
	const section = useSettingsSection()
	const { t } = useTranslation()

	return (
		<div className='flex flex-col'>
			{settingsSections.map(item => (
				<SidebarItem
					key={item.id}
					icon={item.icon}
					text={t(`settings.${item.nameKey}`)}
					variant={section === item.id ? 'default' : 'ghost'}
					onClick={() => setSettingsSection(item.id)}
				/>
			))}
		</div>
	)
}
