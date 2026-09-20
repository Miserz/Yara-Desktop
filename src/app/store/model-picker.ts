import { create, StateCreator } from 'zustand'

interface IInitialState {
	open: boolean
}

interface IActions {
	openPicker: () => void
	closePicker: () => void
	togglePicker: () => void
}

interface IModelPickerState extends IInitialState, IActions {}

const initialState: IInitialState = {
	open: false
}

const modelPickerStore: StateCreator<IModelPickerState> = set => ({
	...initialState,
	openPicker: () => set({ open: true }),
	closePicker: () => set({ open: false }),
	togglePicker: () => set(state => ({ open: !state.open }))
})

const useModelPickerStore = create<IModelPickerState>()(modelPickerStore)

export const useModelPickerOpen = () =>
	useModelPickerStore(state => state.open)

export const openModelPicker = () =>
	useModelPickerStore.getState().openPicker()
export const closeModelPicker = () =>
	useModelPickerStore.getState().closePicker()
export const toggleModelPicker = () =>
	useModelPickerStore.getState().togglePicker()
