import * as updater from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'
import {
	resetUpdater,
	setUpdaterProgress,
	setUpdaterStatus
} from '@/app/store/updater'

let checking = false

export async function checkForUpdates(): Promise<boolean> {
	if (checking) return false
	checking = true
	setUpdaterStatus('checking', { error: null })
	try {
		const update = await updater.check()
		if (!update) {
			setUpdaterStatus('upToDate', { version: null })
			setTimeout(() => resetUpdater(), 4000)
			return false
		}
		setUpdaterStatus('available', { version: update.version })
		return true
	} catch (error) {
		const raw = error instanceof Error ? error.message : String(error)
		// No published release yet → latest.json 404 is not an error, just "up to date"
		if (
			raw.includes('Could not fetch a valid release JSON') ||
			raw.includes('404') ||
			raw.toLowerCase().includes('not found')
		) {
			setUpdaterStatus('upToDate', { version: null })
			setTimeout(() => resetUpdater(), 4000)
			return false
		}
		setUpdaterStatus('error', { error: raw })
		setTimeout(() => resetUpdater(), 5000)
		return false
	} finally {
		checking = false
	}
}

export async function downloadAndInstall(): Promise<void> {
	let update: Awaited<ReturnType<typeof updater.check>> = null
	try {
		update = await updater.check()
	} catch (error) {
		const raw = error instanceof Error ? error.message : String(error)
		if (
			raw.includes('Could not fetch a valid release JSON') ||
			raw.includes('404')
		) {
			setUpdaterStatus('upToDate', { version: null })
			setTimeout(() => resetUpdater(), 4000)
			return
		}
		setUpdaterStatus('error', { error: raw })
		return
	}
	if (!update) {
		setUpdaterStatus('upToDate')
		return
	}
	setUpdaterStatus('downloading', { progress: 0, version: update.version })
	let downloaded = 0
	let contentLength = 0
	await update.downloadAndInstall(event => {
		switch (event.event) {
			case 'Started':
				contentLength = event.data.contentLength ?? 0
				setUpdaterProgress(0)
				break
			case 'Progress':
				downloaded += event.data.chunkLength
				if (contentLength) {
					setUpdaterProgress(
						Math.round((downloaded / contentLength) * 100)
					)
				}
				break
			case 'Finished':
				setUpdaterProgress(100)
				setUpdaterStatus('ready', { progress: 100 })
				break
		}
	})
	await relaunch()
}

export function isChecking(): boolean {
	return checking
}
