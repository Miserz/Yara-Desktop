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
		setUpdaterStatus('error', {
			error: error instanceof Error ? error.message : String(error)
		})
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
		setUpdaterStatus('error', {
			error: error instanceof Error ? error.message : String(error)
		})
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
