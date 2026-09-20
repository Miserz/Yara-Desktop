import {
	Brain,
	Info,
	Paintbrush,
	Settings,
	type LucideIcon
} from 'lucide-react'
import type { SettingsSection } from '@/app/store/settings'

export interface ISettingsSection {
	id: SettingsSection
	/** i18n key under `settings.*` resolving to the section name. */
	nameKey: string
	icon: LucideIcon
}

export const settingsSections: ISettingsSection[] = [
	{ id: 'general', nameKey: 'general', icon: Settings },
	{ id: 'appearance', nameKey: 'appearance', icon: Paintbrush },
	{ id: 'models', nameKey: 'models', icon: Brain },
	{ id: 'about', nameKey: 'about', icon: Info }
]
