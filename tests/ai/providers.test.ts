import { beforeEach, describe, expect, it, vi } from 'vitest'

beforeEach(() => {
  vi.resetModules()
  for (const k of ['GROQ_API_KEY', 'GEMINI_API_KEY', 'LLM_PROVIDER', 'LLM_MODEL']) {
    delete process.env[k]
  }
})

describe('resolveProvider', () => {
  it('defaults to groq', async () => {
    process.env.GROQ_API_KEY = 'gsk_test'
    const { resolveProvider } = await import('@/lib/ai/providers')
    expect(resolveProvider().name).toBe('groq')
  })

  it('honours LLM_PROVIDER', async () => {
    process.env.LLM_PROVIDER = 'gemini'
    process.env.GEMINI_API_KEY = 'test'
    const { resolveProvider } = await import('@/lib/ai/providers')
    expect(resolveProvider().baseURL).toContain('generativelanguage')
  })

  it('throws AI_NOT_CONFIGURED when the key is missing', async () => {
    process.env.LLM_PROVIDER = 'groq'
    const { resolveProvider } = await import('@/lib/ai/providers')
    expect(() => resolveProvider()).toThrowError(/GROQ_API_KEY/)
  })

  it('throws for an unknown provider name', async () => {
    process.env.LLM_PROVIDER = 'wizard'
    const { resolveProvider } = await import('@/lib/ai/providers')
    expect(() => resolveProvider()).toThrowError(/wizard/)
  })

  it('does not require a key for ollama', async () => {
    process.env.LLM_PROVIDER = 'ollama'
    const { resolveProvider } = await import('@/lib/ai/providers')
    expect(resolveProvider().apiKey).toBe('ollama')
  })

  it('falls back to the provider default model', async () => {
    process.env.GROQ_API_KEY = 'gsk_test'
    const { resolveProvider } = await import('@/lib/ai/providers')
    expect(resolveProvider().model).toBe('openai/gpt-oss-20b')
  })

  it('honours LLM_MODEL over the default', async () => {
    process.env.GROQ_API_KEY = 'gsk_test'
    process.env.LLM_MODEL = 'qwen/qwen3.8-27b'
    const { resolveProvider } = await import('@/lib/ai/providers')
    expect(resolveProvider().model).toBe('qwen/qwen3.8-27b')
  })

  it('reports strict json support per provider', async () => {
    process.env.GROQ_API_KEY = 'gsk_test'
    const { resolveProvider } = await import('@/lib/ai/providers')
    expect(resolveProvider().supportsStrictJson).toBe(true)
  })
})
