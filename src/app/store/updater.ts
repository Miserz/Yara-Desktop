import { create, type StateCreator } from 'zustand'

export type UpdaterStatus =
	| 'idle'
	| 'checking'
	| 'available'
	| 'downloading'
	| 'ready'
	| 'upToDate'
	| 'error'

interface IInitialState {
	status: UpdaterStatus
	version: string | null
	error: string | null
	progress: number
}

interface IActions {
	setStatus: (status: UpdaterStatus, patch?: Partial<IInitialState>) => void
	setProgress: (progress: number) => void
	reset: () => void
}

interface IUpdaterState extends IInitialState, IActions {}

const initialState: IInitialState = {
	status: 'idle',
	version: null,
	error: null,
	progress: 0
}

const updaterStore: StateCreator<IUpdaterState> = set => ({
	...initialState,
	setStatus: (status, patch) => set({ status, ...patch }),
	setProgress: progress => set({ progress }),
	reset: () => set(initialState)
})

export const useUpdaterStore = create<IUpdaterState>()(updaterStore)

export const useUpdaterStatus = () => useUpdaterStore(s => s.status)
export const useUpdaterVersion = () => useUpdaterStore(s => s.version)
export const useUpdaterProgress = () => useUpdaterStore(s => s.progress)
export const useUpdaterError = () => useUpdaterStore(s => s.error)

export const setUpdaterStatus = (
	status: UpdaterStatus,
	patch?: Partial<IInitialState>
) => useUpdaterStore.getState().setStatus(status, patch)
export const setUpdaterProgress = (progress: number) =>
	useUpdaterStore.getState().setProgress(progress)
export const resetUpdater = () => useUpdaterStore.getState().reset()
