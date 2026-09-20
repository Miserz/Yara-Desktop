import { invoke } from '@tauri-apps/api/core'

export interface Provider {
	id: string
	name: string
	baseUrl: string
	apiKey: string
}

export interface ModelEntry {
	providerId: string
	id: string
	displayName: string
}

export interface RemoteModel {
	id: string
	name?: string | null
}

export interface ModelRef {
	providerId: string
	modelId: string
}

export interface ProvidersData {
	providers: Provider[]
	customModels: ModelEntry[]
	enabledModels: ModelRef[]
	activeModel: ModelRef | null
}

export const getProvidersData = () => invoke<ProvidersData>('get_data')

export const addProvider = (provider: Omit<Provider, 'id'>) =>
	invoke<Provider>('add_provider', provider)

export const updateProvider = (provider: Provider) =>
	invoke('update_provider', { provider })

export const removeProvider = (id: string) => invoke('remove_provider', { id })

export const addModel = (model: ModelEntry) => invoke('add_model', { model })

export const removeModel = (providerId: string, modelId: string) =>
	invoke('remove_model', { providerId, modelId })

export const setActiveModel = (model: ModelRef | null) =>
	invoke('set_active_model', { model })

export const setModelEnabled = (
	providerId: string,
	modelId: string,
	enabled: boolean
) => invoke('set_model_enabled', { providerId, modelId, enabled })

export const setEnabledModels = (models: ModelRef[]) =>
	invoke('set_enabled_models', { models })

export const fetchRemoteModels = (providerId: string) =>
	invoke<RemoteModel[]>('fetch_remote_models', { providerId })

export const testProvider = (baseUrl: string, apiKey: string) =>
	invoke('test_provider', { baseUrl, apiKey })
