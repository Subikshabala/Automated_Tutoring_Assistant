import { ApiError } from '@/lib/api'

export type ProviderName =
  | 'groq'
  | 'gemini'
  | 'openrouter'
  | 'cerebras'
  | 'ollama'

type ProviderSpec = {
  baseURL: string
  envKey: string
  defaultModel: string
  /** Constrained decoding against a JSON schema, not just "valid JSON". */
  supportsStrictJson: boolean
  /** Local providers need no credential. */
  keyless?: boolean
}

const PROVIDERS: Record<ProviderName, ProviderSpec> = {
  groq: {
    baseURL: 'https://api.groq.com/openai/v1',
    envKey: 'GROQ_API_KEY',
    defaultModel: 'openai/gpt-oss-20b',
    supportsStrictJson: true,
  },
  gemini: {
    baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
    envKey: 'GEMINI_API_KEY',
    defaultModel: 'gemini-2.5-flash',
    supportsStrictJson: false,
  },
  openrouter: {
    baseURL: 'https://openrouter.ai/api/v1',
    envKey: 'OPENROUTER_API_KEY',
    defaultModel: 'meta-llama/llama-3.3-70b-instruct:free',
    supportsStrictJson: false,
  },
  cerebras: {
    baseURL: 'https://api.cerebras.ai/v1',
    envKey: 'CEREBRAS_API_KEY',
    defaultModel: 'qwen-3.8-27b',
    supportsStrictJson: false,
  },
  ollama: {
    baseURL: 'http://localhost:11434/v1',
    envKey: 'OLLAMA_API_KEY',
    defaultModel: 'qwen2.5:7b',
    supportsStrictJson: false,
    keyless: true,
  },
}

export type ResolvedProvider = {
  name: ProviderName
  baseURL: string
  apiKey: string
  model: string
  supportsStrictJson: boolean
}

export function resolveProvider(): ResolvedProvider {
  const name = (process.env.LLM_PROVIDER ?? 'groq') as ProviderName
  const spec = PROVIDERS[name]

  if (!spec) {
    throw new ApiError(
      'AI_NOT_CONFIGURED',
      `Unknown LLM_PROVIDER "${name}". Expected one of: ${Object.keys(PROVIDERS).join(', ')}`,
      500,
    )
  }

  const apiKey = process.env[spec.envKey] ?? (spec.keyless ? 'ollama' : '')
  if (!apiKey) {
    throw new ApiError(
      'AI_NOT_CONFIGURED',
      `${spec.envKey} is not set. Get a free key and add it to .env`,
      500,
    )
  }

  return {
    name,
    baseURL: spec.baseURL,
    apiKey,
    model: process.env.LLM_MODEL ?? spec.defaultModel,
    supportsStrictJson: spec.supportsStrictJson,
  }
}
