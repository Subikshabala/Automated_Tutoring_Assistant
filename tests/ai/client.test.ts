import { beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

const create = vi.fn()

vi.mock('openai', () => ({
  default: class {
    chat = { completions: { create } }
  },
}))

const schema = z.object({ answer: z.string().min(1) })

beforeEach(() => {
  vi.resetModules()
  create.mockReset()
  for (const k of [
    'GROQ_API_KEY',
    'GEMINI_API_KEY',
    'LLM_PROVIDER',
    'LLM_MODEL',
  ]) {
    delete process.env[k]
  }
  process.env.GROQ_API_KEY = 'gsk_test'
})

async function subject() {
  return import('@/lib/ai/client')
}

describe('generateStructured', () => {
  it('returns parsed data for a valid model response', async () => {
    create.mockResolvedValue({
      choices: [{ message: { content: '{"answer":"yes"}' } }],
    })
    const { generateStructured } = await subject()
    await expect(
      generateStructured({ prompt: 'p', schema }),
    ).resolves.toEqual({ answer: 'yes' })
  })

  it('strips a markdown code fence before parsing', async () => {
    create.mockResolvedValue({
      choices: [{ message: { content: '```json\n{"answer":"yes"}\n```' } }],
    })
    const { generateStructured } = await subject()
    await expect(
      generateStructured({ prompt: 'p', schema }),
    ).resolves.toEqual({ answer: 'yes' })
  })

  it('throws AI_INVALID_RESPONSE when the model returns non-json', async () => {
    create.mockResolvedValue({
      choices: [{ message: { content: 'sorry, I cannot' } }],
    })
    const { generateStructured } = await subject()
    await expect(
      generateStructured({ prompt: 'p', schema }),
    ).rejects.toMatchObject({ code: 'AI_INVALID_RESPONSE' })
  })

  it('throws AI_INVALID_RESPONSE when json fails schema validation', async () => {
    create.mockResolvedValue({
      choices: [{ message: { content: '{"answer":""}' } }],
    })
    const { generateStructured } = await subject()
    await expect(
      generateStructured({ prompt: 'p', schema }),
    ).rejects.toMatchObject({ code: 'AI_INVALID_RESPONSE' })
  })

  it('throws AI_UNAVAILABLE when the sdk call rejects', async () => {
    create.mockRejectedValue(new Error('network down'))
    const { generateStructured } = await subject()
    await expect(
      generateStructured({ prompt: 'p', schema }),
    ).rejects.toMatchObject({ code: 'AI_UNAVAILABLE' })
  })

  it('throws AI_NOT_CONFIGURED when the api key is absent', async () => {
    delete process.env.GROQ_API_KEY
    const { generateStructured } = await subject()
    await expect(
      generateStructured({ prompt: 'p', schema }),
    ).rejects.toMatchObject({ code: 'AI_NOT_CONFIGURED' })
  })

  it('passes the system message through when provided', async () => {
    create.mockResolvedValue({
      choices: [{ message: { content: '{"answer":"yes"}' } }],
    })
    const { generateStructured } = await subject()
    await generateStructured({ prompt: 'p', schema, system: 'be terse' })
    const call = create.mock.calls[0][0]
    expect(call.messages[0]).toEqual({ role: 'system', content: 'be terse' })
  })

  it('uses strict json_schema on groq', async () => {
    process.env.LLM_PROVIDER = 'groq'
    process.env.GROQ_API_KEY = 'gsk_test'
    create.mockResolvedValue({
      choices: [{ message: { content: '{"answer":"y"}' } }],
    })
    const { generateStructured } = await subject()
    await generateStructured({ prompt: 'p', schema })
    expect(create.mock.calls[0][0].response_format.type).toBe('json_schema')
  })

  it('falls back to json_object on gemini', async () => {
    process.env.LLM_PROVIDER = 'gemini'
    process.env.GEMINI_API_KEY = 'test'
    create.mockResolvedValue({
      choices: [{ message: { content: '{"answer":"y"}' } }],
    })
    const { generateStructured } = await subject()
    await generateStructured({ prompt: 'p', schema })
    expect(create.mock.calls[0][0].response_format.type).toBe('json_object')
  })
})
