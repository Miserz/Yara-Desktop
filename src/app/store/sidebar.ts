import { create, StateCreator } from 'zustand'
import { persist } from 'zustand/middleware'

interface IActions {
	toggle: () => void
}

interface IInitialState {
	open: boolean
}

interface ISidebarState extends IInitialState, IActions {}

const initialState: IInitialState = {
	open: true
}

const sidebarStore: StateCreator<ISidebarState> = set => ({
	...initialState,
	toggle: () => set(state => ({ open: !state.open }))
})

export const useSidebarStore = create<ISidebarState>()(
	persist(sidebarStore, { name: 'sidebar' })
)

export const useOpen = () => useSidebarStore(state => state.open)
export const toggleSidebar = () => useSidebarStore.getState().toggle
