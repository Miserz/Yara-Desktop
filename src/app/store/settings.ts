import { create, StateCreator } from 'zustand'

export type View = 'chat' | 'settings'

export type SettingsSection = 'general' | 'appearance' | 'models' | 'about'

interface IActions {
	openSettings: () => void
	closeSettings: () => void
	setSection: (section: SettingsSection) => void
}

interface IInitialState {
	view: View
	section: SettingsSection
}

interface ISettingsState extends IInitialState, IActions {}

const initialState: IInitialState = {
	view: 'chat',
	section: 'general'
}

const settingsStore: StateCreator<ISettingsState> = set => ({
	...initialState,
	openSettings: () => set({ view: 'settings' }),
	closeSettings: () => set({ view: 'chat' }),
	setSection: section => set({ section })
})

const useSettingsStore = create<ISettingsState>()(settingsStore)

export const useView = () => useSettingsStore(state => state.view)
export const useSettingsSection = () => useSettingsStore(state => state.section)
export const openSettings = () => useSettingsStore.getState().openSettings
export const closeSettings = () => useSettingsStore.getState().closeSettings
export const setSettingsSection = (section: SettingsSection) =>
	useSettingsStore.getState().setSection(section)
