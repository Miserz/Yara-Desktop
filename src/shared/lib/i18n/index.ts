import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './locales/en.json'
import ru from './locales/ru.json'

export const LANGUAGES = ['en', 'ru'] as const
export type Language = (typeof LANGUAGES)[number]

export const LANGUAGE_NAMES: Record<Language, string> = {
	en: 'English',
	ru: 'Русский'
}

const STORAGE_KEY = 'language'

const resolveInitialLanguage = (): Language => {
	const stored = localStorage.getItem(STORAGE_KEY)
	if (stored === 'en' || stored === 'ru') return stored
	const browser = navigator.language.split('-')[0]
	return browser === 'ru' ? 'ru' : 'en'
}

i18n.use(initReactI18next).init({
	resources: {
		en: { translation: en },
		ru: { translation: ru }
	},
	lng: resolveInitialLanguage(),
	fallbackLng: 'en',
	interpolation: { escapeValue: false }
})

export const changeLanguage = (language: Language) => {
	localStorage.setItem(STORAGE_KEY, language)
	void i18n.changeLanguage(language)
}

export const getCurrentLanguage = (): Language =>
	i18n.language === 'ru' ? 'ru' : 'en'

export default i18n
