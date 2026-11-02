# A1 — AI Provider Swap

**Blocks:** every AI feature. Do this first (alongside A2).

**Problem:** `gemini-2.0-flash` was shut down by Google. Every call now 404s:

```
This model models/gemini-2.0-flash is no longer available.
Please update your code to use models/gemini-3.8-flash
```

Dead right now: learn explanations, tutor chat, assessment grading, coach summary, map feedback, material Q&A.

**Decision:** do not just swap the model id. Replace `@google/genai` with the `openai` SDK pointed at a configurable `baseURL`. Every provider worth using is OpenAI-compatible, so the provider becomes a `.env` change.

**Default: Groq.** Free, no credit card, ~30 RPM / 1K RPD, 500+ tokens/sec, and **strict JSON schema mode** — the model is constrained during decoding so it cannot emit malformed JSON.

---

## Provider options (all OpenAI-compatible)

| Provider | Base URL | Free tier | JSON |
|---|---|---|---|
| **Groq** | `https://api.groq.com/openai/v1` | 30 RPM, 1K RPD, no card | Strict schema |
| Gemini | `https://generativelanguage.googleapis.com/v1beta/openai/` | ~15 RPM, 1.5K RPD | `json_object` |
| OpenRouter | `https://openrouter.ai/api/v1` | `:free` models | Model-dependent |
| Cerebras | `https://api.cerebras.ai/v1` | $5 credit | `json_object` |
| Ollama | `http://localhost:11434/v1` | Unlimited, local | `json_object` |

Get a Groq key at [console.groq.com](https://console.groq.com) — GitHub sign-in, no card.

> GitHub Models was retired 2026-07-30. Mistral and Together have no meaningful free API tier.

---

## Task 1: Install and configure

- [ ] **Step 1: Install the SDK**

```bash
npm install openai
```

- [ ] **Step 2: Rewrite `.env.example`**

```bash
# SQLite database file.
DATABASE_URL="file:./dev.db"

# --- LLM provider -----------------------------------------------------
# One of: groq | gemini | openrouter | cerebras | ollama
LLM_PROVIDER="groq"

# Model id for the chosen provider. See the table in
# docs/superpowers/plans/v2/A1-ai-provider-swap.md
LLM_MODEL="openai/gpt-oss-20b"

# Only the key for your chosen provider needs a value.
GROQ_API_KEY=""
GEMINI_API_KEY=""
OPENROUTER_API_KEY=""
CEREBRAS_API_KEY=""

# Secret for signing session JWTs. Generate with: openssl rand -base64 32
JWT_SECRET=""
```

- [ ] **Step 3: Update your real `.env`**

Keep `DATABASE_URL` and `JWT_SECRET`. Add:

```bash
LLM_PROVIDER="groq"
LLM_MODEL="openai/gpt-oss-20b"
GROQ_API_KEY="gsk_your_key_here"
```

Leave the old `GEMINI_API_KEY` in place — it still works as a fallback provider.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json .env.example
git commit -m "chore(ai): add openai sdk and multi-provider env config"
```

---

## Task 2: Provider registry

**Files:** create `lib/ai/providers.ts`, test `tests/ai/providers.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { beforeEach, describe, expect, it } from 'vitest'

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
```

Add `import { vi } from 'vitest'` to the import line.

- [ ] **Step 2: Run it — expect module-not-found**

```bash
npx vitest run tests/ai/providers.test.ts --fileParallelism=false
```

- [ ] **Step 3: Create `lib/ai/providers.ts`**

```ts
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
```

- [ ] **Step 4: Tests pass (8), then commit**

```bash
git add lib/ai/providers.ts tests/ai/providers.test.ts
git commit -m "feat(ai): add provider registry with env-driven selection"
```

---

## Task 3: Rewrite the client

**Files:** rewrite `lib/ai/gemini.ts` → `lib/ai/client.ts`, update `tests/ai/gemini.test.ts` → `tests/ai/client.test.ts`

The public contract (`generateStructured({ prompt, schema, system, temperature })`) does not change, so no caller needs editing.

- [ ] **Step 1: Add a Zod→JSON-Schema converter**

```bash
npm install zod-to-json-schema
```

- [ ] **Step 2: Create `lib/ai/client.ts`**

```ts
import OpenAI from 'openai'
import type { ZodType } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'
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
          schema: zodToJsonSchema(schema, { target: 'openApi3' }),
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
```

- [ ] **Step 3: Re-point every import**

```bash
grep -rln "@/lib/ai/gemini" --include="*.ts" --include="*.tsx" lib app tests \
  | xargs sed -i "s|@/lib/ai/gemini|@/lib/ai/client|g"
git rm lib/ai/gemini.ts
git mv tests/ai/gemini.test.ts tests/ai/client.test.ts
```

- [ ] **Step 4: Rewrite the client test**

Mock `openai` instead of `@google/genai`. Keep every existing case — strip fence, non-JSON, schema failure, SDK rejection, missing key — and add:

```ts
vi.mock('openai', () => ({
  default: class {
    chat = { completions: { create } }
  },
}))
```

Add two cases:

```ts
it('uses strict json_schema on groq', async () => {
  process.env.LLM_PROVIDER = 'groq'
  process.env.GROQ_API_KEY = 'gsk_test'
  create.mockResolvedValue({ choices: [{ message: { content: '{"answer":"y"}' } }] })
  const { generateStructured } = await import('@/lib/ai/client')
  await generateStructured({ prompt: 'p', schema })
  expect(create.mock.calls[0][0].response_format.type).toBe('json_schema')
})

it('falls back to json_object on gemini', async () => {
  process.env.LLM_PROVIDER = 'gemini'
  process.env.GEMINI_API_KEY = 'test'
  create.mockResolvedValue({ choices: [{ message: { content: '{"answer":"y"}' } }] })
  const { generateStructured } = await import('@/lib/ai/client')
  await generateStructured({ prompt: 'p', schema })
  expect(create.mock.calls[0][0].response_format.type).toBe('json_object')
})
```

- [ ] **Step 5: Drop the dead dependency**

```bash
npm uninstall @google/genai
```

- [ ] **Step 6: Remove the stale model constant**

`lib/ai/tutor.ts` has its own `DEFAULT_MODEL = 'gemini-2.0-flash'` used when stamping the explanation cache. Replace:

```ts
import { resolveProvider } from '@/lib/ai/providers'
// ...
await saveExplanation(conceptId, explanation, resolveProvider().model)
```

Delete the `DEFAULT_MODEL` constant and the `process.env.GEMINI_MODEL` reference.

- [ ] **Step 7: Verify**

```bash
npm run typecheck
npx eslint app/ lib/ components/ hooks/ tests/
npm test -- --fileParallelism=false
```

- [ ] **Step 8: Live smoke test**

```bash
npm run dev
```

Sign in, open any topic under `/learn`. A real explanation should render in a few seconds. Then ask the tutor a question.

If you see `AI_NOT_CONFIGURED`, your `GROQ_API_KEY` is missing. If `AI_UNAVAILABLE`, check the server log — the provider name is prefixed on every error.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(ai): replace @google/genai with provider-agnostic openai client"
```

---

## Exit checklist

- [ ] `npm run dev` → a learn page renders a real generated explanation
- [ ] Tutor chat answers a follow-up
- [ ] Switching `LLM_PROVIDER=gemini` in `.env` works without a code change
- [ ] `grep -rn "gemini-2.0-flash" lib app` returns nothing
- [ ] `grep -rn "@google/genai" lib app` returns nothing
- [ ] All four verification commands pass
