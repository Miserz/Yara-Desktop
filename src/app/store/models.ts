import { create, StateCreator } from 'zustand'
import * as api from '@/shared/api/providers'
import type {
	ModelEntry,
	ModelRef,
	Provider,
	RemoteModel
} from '@/shared/api/providers'
import { resolveDisplayName } from '@/shared/lib/model-name'

type RemoteByProvider = Record<string, ModelEntry[]>

interface IInitialState {
	loaded: boolean
	syncing: boolean
	providers: Provider[]
	models: ModelEntry[]
	customModels: ModelEntry[]
	remoteByProvider: RemoteByProvider
	enabledModels: ModelRef[]
	activeModel: ModelRef | null
}

interface IActions {
	load: () => Promise<void>
	syncAll: () => Promise<void>
	syncProvider: (providerId: string) => Promise<boolean>
	prune: () => void
	addProvider: (provider: Omit<Provider, 'id'>) => Promise<Provider>
	updateProvider: (provider: Provider) => Promise<void>
	removeProvider: (id: string) => Promise<void>
	addModel: (model: ModelEntry) => Promise<void>
	removeModel: (providerId: string, modelId: string) => Promise<void>
	toggleModelEnabled: (model: ModelRef) => Promise<void>
	setActiveModel: (model: ModelRef | null) => Promise<void>
	testProvider: (baseUrl: string, apiKey: string) => Promise<void>
	fetchModels: (providerId: string) => Promise<boolean>
}

interface IModelsState extends IInitialState, IActions {}

const initialState: IInitialState = {
	loaded: false,
	syncing: false,
	providers: [],
	models: [],
	customModels: [],
	remoteByProvider: {},
	enabledModels: [],
	activeModel: null
}

const modelKey = (providerId: string, modelId: string) =>
	`${providerId}/${modelId}`

const toEntry = (providerId: string, remote: RemoteModel): ModelEntry => ({
	providerId,
	id: remote.id,
	displayName: resolveDisplayName(remote.id, remote.name)
})

const mergeModels = (
	remote: RemoteByProvider,
	customModels: ModelEntry[]
): ModelEntry[] => {
	const map = new Map<string, ModelEntry>()
	for (const entries of Object.values(remote))
		for (const model of entries)
			map.set(modelKey(model.providerId, model.id), model)
	for (const model of customModels)
		map.set(modelKey(model.providerId, model.id), model)
	return [...map.values()]
}

const modelsStore: StateCreator<IModelsState> = (set, get) => ({
	...initialState,
	load: async () => {
		const data = await api.getProvidersData()
		set({
			providers: data.providers,
			customModels: data.customModels,
			enabledModels: data.enabledModels,
			activeModel: data.activeModel,
			models: mergeModels({}, data.customModels),
			loaded: true
		})
		await get().syncAll()
	},
	syncAll: async () => {
		const providers = get().providers
		if (!providers.length) return
		set({ syncing: true })
		await Promise.allSettled(
			providers.map(provider => get().syncProvider(provider.id))
		)
		set({ syncing: false })
		get().prune()
	},
	syncProvider: async providerId => {
		const provider = get().providers.find(item => item.id === providerId)
		if (!provider) return false
		try {
			const remote = await api.fetchRemoteModels(providerId)
			set(state => {
				const remoteByProvider = {
					...state.remoteByProvider,
					[providerId]: remote.map(item => toEntry(providerId, item))
				}
				return {
					remoteByProvider,
					models: mergeModels(remoteByProvider, state.customModels)
				}
			})
			return true
		} catch {
			// keep the previously synced list on transient failures
			return false
		}
	},
	prune: () => {
		const state = get()
		const keys = new Set(
			state.models.map(item => modelKey(item.providerId, item.id))
		)
		const synced = new Set(Object.keys(state.remoteByProvider))
		const enabledModels = state.enabledModels.filter(
			item =>
				!synced.has(item.providerId) ||
				keys.has(modelKey(item.providerId, item.modelId))
		)
		const activeValid =
			!state.activeModel ||
			!synced.has(state.activeModel.providerId) ||
			keys.has(
				modelKey(state.activeModel.providerId, state.activeModel.modelId)
			)
		if (enabledModels.length !== state.enabledModels.length) {
			set({ enabledModels })
			void api.setEnabledModels(enabledModels).catch(() => {})
		}
		if (!activeValid && state.activeModel) {
			set({ activeModel: null })
			void api.setActiveModel(null).catch(() => {})
		}
	},
	addProvider: async provider => {
		const created = await api.addProvider(provider)
		set(state => ({ providers: [...state.providers, created] }))
		void get()
			.syncProvider(created.id)
			.then(() => get().prune())
		return created
	},
	updateProvider: async provider => {
		await api.updateProvider(provider)
		set(state => ({
			providers: state.providers.map(item =>
				item.id === provider.id ? provider : item
			)
		}))
		void get()
			.syncProvider(provider.id)
			.then(() => get().prune())
	},
	removeProvider: async id => {
		await api.removeProvider(id)
		set(state => {
			const remoteByProvider = { ...state.remoteByProvider }
			delete remoteByProvider[id]
			const customModels = state.customModels.filter(
				item => item.providerId !== id
			)
			return {
				providers: state.providers.filter(item => item.id !== id),
				remoteByProvider,
				customModels,
				models: mergeModels(remoteByProvider, customModels),
				enabledModels: state.enabledModels.filter(
					item => item.providerId !== id
				),
				activeModel:
					state.activeModel?.providerId === id ? null : state.activeModel
			}
		})
	},
	addModel: async model => {
		const exists = get().customModels.some(
			item =>
				item.providerId === model.providerId && item.id === model.id
		)
		if (exists) return
		await api.addModel(model)
		set(state => {
			const customModels = [...state.customModels, model]
			return {
				customModels,
				models: mergeModels(state.remoteByProvider, customModels)
			}
		})
	},
	removeModel: async (providerId, modelId) => {
		const isCustom = get().customModels.some(
			item => item.providerId === providerId && item.id === modelId
		)
		if (!isCustom) return
		await api.removeModel(providerId, modelId)
		set(state => {
			const customModels = state.customModels.filter(
				item =>
					!(item.providerId === providerId && item.id === modelId)
			)
			return {
				customModels,
				models: mergeModels(state.remoteByProvider, customModels)
			}
		})
		get().prune()
	},
	toggleModelEnabled: async model => {
		const enabled = !get().enabledModels.some(
			item =>
				item.providerId === model.providerId &&
				item.modelId === model.modelId
		)
		await api.setModelEnabled(model.providerId, model.modelId, enabled)
		set(state => ({
			enabledModels: enabled
				? [...state.enabledModels, model]
				: state.enabledModels.filter(
						item =>
							!(
								item.providerId === model.providerId &&
								item.modelId === model.modelId
							)
					),
			activeModel:
				!enabled &&
				state.activeModel?.providerId === model.providerId &&
				state.activeModel?.modelId === model.modelId
					? null
					: state.activeModel
		}))
	},
	setActiveModel: async model => {
		await api.setActiveModel(model)
		set({ activeModel: model })
	},
	testProvider: async (baseUrl, apiKey) => {
		await api.testProvider(baseUrl, apiKey)
	},
	fetchModels: async providerId => {
		const ok = await get().syncProvider(providerId)
		get().prune()
		return ok
	}
})

const useModelsStore = create<IModelsState>()(modelsStore)

/** Imperative access for non-React code (other stores, listeners). */
export { useModelsStore }

export const useProviders = () => useModelsStore(state => state.providers)
export const useModels = () => useModelsStore(state => state.models)
export const useCustomModels = () =>
	useModelsStore(state => state.customModels)
export const useSyncing = () => useModelsStore(state => state.syncing)
export const useEnabledModels = () =>
	useModelsStore(state => state.enabledModels)
export const useActiveModel = () => useModelsStore(state => state.activeModel)

export const loadProvidersData = () => useModelsStore.getState().load()
export const syncAllModels = () => useModelsStore.getState().syncAll()
export const addProvider = (provider: Omit<Provider, 'id'>) =>
	useModelsStore.getState().addProvider(provider)
export const updateProvider = (provider: Provider) =>
	useModelsStore.getState().updateProvider(provider)
export const removeProvider = (id: string) =>
	useModelsStore.getState().removeProvider(id)
export const addModel = (model: ModelEntry) =>
	useModelsStore.getState().addModel(model)
export const removeModel = (providerId: string, modelId: string) =>
	useModelsStore.getState().removeModel(providerId, modelId)
export const toggleModelEnabled = (model: ModelRef) =>
	useModelsStore.getState().toggleModelEnabled(model)
export const setActiveModel = (model: ModelRef | null) =>
	useModelsStore.getState().setActiveModel(model)
export const testProvider = (baseUrl: string, apiKey: string) =>
	useModelsStore.getState().testProvider(baseUrl, apiKey)
export const fetchModels = (providerId: string) =>
	useModelsStore.getState().fetchModels(providerId)
