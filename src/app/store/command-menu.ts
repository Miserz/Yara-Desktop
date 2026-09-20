import { create, StateCreator } from 'zustand'

interface IInitialState {
	open: boolean
	/** True when opened via the search entries (Ctrl+F / sidebar item). */
	searchFirst: boolean
}

interface IActions {
	openCommands: () => void
	openSearch: () => void
	close: () => void
}

interface ICommandMenuState extends IInitialState, IActions {}

const initialState: IInitialState = {
	open: false,
	searchFirst: false
}

const commandMenuStore: StateCreator<ICommandMenuState> = set => ({
	...initialState,
	openCommands: () => set({ open: true, searchFirst: false }),
	openSearch: () => set({ open: true, searchFirst: true }),
	close: () => set({ open: false })
})

const useCommandMenuStore = create<ICommandMenuState>()(commandMenuStore)

export const useCommandMenuOpen = () =>
	useCommandMenuStore(state => state.open)
export const useSearchFirst = () =>
	useCommandMenuStore(state => state.searchFirst)

export const openCommandMenu = () =>
	useCommandMenuStore.getState().openCommands()
export const openCommandSearch = () =>
	useCommandMenuStore.getState().openSearch()
export const closeCommandMenu = () => useCommandMenuStore.getState().close()
