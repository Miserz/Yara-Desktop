import { useTranslation } from 'react-i18next'

export function Welcome() {
	const { t } = useTranslation()

	return (
		<div className='text-center'>
			<h1 className='text-6xl text-foreground'>{t('welcome.title')}</h1>
			<h2 className='text-6xl text-foreground/20'>{t('welcome.subtitle')}</h2>
		</div>
	)
}
