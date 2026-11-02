import OpenAI from 'openai'
import { type ZodType, toJSONSchema } from 'zod'
import { ApiError } from '@/lib/api'
import { resolveProvider } from '@/lib/ai/providers'

function stripFence(text: string): string {
  const trimmed = text.trim()
  if (!trimmed.startsWith('```')) return trimmed
  return trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim()
}

export type GenerateOptions<T> = {
  prompt: string
  schema: ZodType<T>
  system?: string
  temperature?: number
  /** Used as the json_schema name on strict providers. */
  schemaName?: string
}

export async function generateStructured<T>({
  prompt,
  schema,
  system,
  temperature = 0.4,
  schemaName = 'response',
}: GenerateOptions<T>): Promise<T> {
  const provider = resolveProvider()

  const client = new OpenAI({
    apiKey: provider.apiKey,
    baseURL: provider.baseURL,
  })

  // Strict mode constrains decoding to the schema. Everything else gets
  // json_object plus a prompt-level instruction and Zod as the net.
  const responseFormat = provider.supportsStrictJson
    ? ({
        type: 'json_schema' as const,
        json_schema: {
          name: schemaName,
          strict: true,
          schema: toJSONSchema(schema),
        },
      })
    : ({ type: 'json_object' as const })

  let text: string
  try {
    const completion = await client.chat.completions.create({
      model: provider.model,
      temperature,
      messages: [
        ...(system ? [{ role: 'system' as const, content: system }] : []),
        { role: 'user' as const, content: prompt },
      ],
      response_format: responseFormat,
    })
    text = completion.choices[0]?.message?.content ?? ''
  } catch (error) {
    console.error(`[${provider.name}] request failed:`, error)
    throw new ApiError(
      'AI_UNAVAILABLE',
      'The AI service is temporarily unavailable. Try again.',
      503,
    )
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(stripFence(text))
  } catch {
    console.error(`[${provider.name}] non-JSON response:`, text.slice(0, 500))
    throw new ApiError(
      'AI_INVALID_RESPONSE',
      'The AI returned an unreadable response. Try again.',
      502,
    )
  }

  const result = schema.safeParse(parsed)
  if (!result.success) {
    console.error(
      `[${provider.name}] schema validation failed:`,
      result.error.issues,
    )
    throw new ApiError(
      'AI_INVALID_RESPONSE',
      'The AI response did not match the expected format. Try again.',
      502,
    )
  }

  return result.data
}
