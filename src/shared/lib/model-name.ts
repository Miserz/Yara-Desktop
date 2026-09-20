const ACRONYMS = new Set([
	'ai',
	'aws',
	'glm',
	'gpt',
	'hc',
	'i2v',
	'llm',
	'oss',
	'stt',
	't2v',
	'tts',
	'vl',
	'vlm'
])

const BRANDS: Record<string, string> = {
	codestral: 'Codestral',
	command: 'Command',
	deepresearch: 'Deep Research',
	deepseek: 'DeepSeek',
	devstral: 'Devstral',
	euryale: 'Euryale',
	gemma: 'Gemma',
	gemini: 'Gemini',
	granite: 'Granite',
	grok: 'Grok',
	hermes: 'Hermes',
	hunyuan: 'Hunyuan',
	inkling: 'Inkling',
	kimi: 'Kimi',
	kling: 'Kling',
	llama: 'Llama',
	longcat: 'LongCat',
	lyria: 'Lyria',
	mai: 'MAI',
	mercury: 'Mercury',
	mimo: 'MiMo',
	minimax: 'MiniMax',
	mistral: 'Mistral',
	mixtral: 'Mixtral',
	mt2: 'MT2',
	nemotron: 'Nemotron',
	nova: 'Nova',
	olmo: 'Olmo',
	palmyra: 'Palmyra',
	phi: 'Phi',
	qwen: 'Qwen',
	reka: 'Reka',
	seedance: 'Seedance',
	seedream: 'Seedream',
	solar: 'Solar',
	voxtral: 'Voxtral',
	wan: 'Wan'
}

const VARIANTS_LOWER = new Set(['free', 'batch'])

const capitalize = (token: string) => token.charAt(0).toUpperCase() + token.slice(1)

const isShortVersion = (token: string) =>
	/^\d{1,2}$/.test(token) && (token === '0' || !token.startsWith('0'))

function prettifyToken(token: string): string {
	if (/^\d+(\.\d+)?$/.test(token)) return token
	if (ACRONYMS.has(token)) return token.toUpperCase()
	if (/^a\d+b$/.test(token)) return token.toUpperCase()
	if (BRANDS[token]) return BRANDS[token]
	const size = token.match(/^(\d+(?:\.\d+)?)([btkmv])$/)
	if (size) return size[1] + size[2].toUpperCase()
	const leading = token.match(/^([a-z]+)(\d+(?:\.\d+)?)$/)
	if (leading) {
		const word = BRANDS[leading[1]] ?? capitalize(leading[1])
		return word + leading[2]
	}
	const trailing = token.match(/^(\d+)([a-z]{2,})$/)
	if (trailing) return trailing[1] + capitalize(trailing[2])
	return capitalize(token)
}

function prettifyBase(base: string): string {
	const tokens = base.split(/[-_\s]+/).filter(Boolean)
	const words: string[] = []
	for (let i = 0; i < tokens.length; i++) {
		const token = tokens[i]
		if (isShortVersion(token)) {
			let version = token
			let end = i
			while (end + 1 < tokens.length && isShortVersion(tokens[end + 1])) {
				version += '.' + tokens[end + 1]
				end++
			}
			if (end > i) {
				words.push(version)
				i = end
				continue
			}
			const previous = words[words.length - 1]
			if (previous && /\d$/.test(previous)) {
				words[words.length - 1] = `${previous}.${token}`
				continue
			}
		}
		if (/^0\d$/.test(token)) {
			let date = token
			let end = i
			while (end + 1 < tokens.length && /^\d{2}$/.test(tokens[end + 1])) {
				date += '-' + tokens[end + 1]
				end++
			}
			words.push(date)
			i = end
			continue
		}
		if (i === tokens.length - 1 && token.toLowerCase() === 'it') continue
		words.push(prettifyToken(token))
	}
	return words.join(' ')
}

export function prettifyModelId(id: string): string {
	let value = id.trim()
	if (!value) return id
	value = value.replace(/^~/, '')
	const slash = value.lastIndexOf('/')
	if (slash >= 0) value = value.slice(slash + 1)
	const [base, ...variants] = value.split(':')
	const pretty = prettifyBase(base)
	const suffix = variants
		.filter(Boolean)
		.map(variant =>
			VARIANTS_LOWER.has(variant.toLowerCase())
				? `(${variant.toLowerCase()})`
				: `(${capitalize(variant)})`
		)
		.join(' ')
	return `${pretty}${suffix ? ' ' + suffix : ''}`.trim() || id
}

export function resolveDisplayName(id: string, name?: string | null): string {
	const remote = name?.trim()
	if (remote && remote.toLowerCase() !== id.trim().toLowerCase()) return remote
	return prettifyModelId(id)
}
