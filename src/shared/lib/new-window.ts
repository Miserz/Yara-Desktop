import { WebviewWindow } from '@tauri-apps/api/webviewWindow'

/** Spawns another main-app window (label suffixed to share capabilities). */
export const openNewAppWindow = () => {
	const label = `main-${Date.now()}`
	new WebviewWindow(label, {
		title: 'Yara',
		width: 1200,
		height: 800,
		decorations: false,
		transparent: true
	})
}
