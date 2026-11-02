import { env, pipeline, type FeatureExtractionPipeline } from '@huggingface/transformers'

/** all-MiniLM-L6-v2 output dimensionality. */
export const EMBEDDING_DIM = 384

const MODEL_ID = 'Xenova/all-MiniLM-L6-v2'

// Keep weights out of node_modules and out of git.
env.cacheDir = './.cache/transformers'
env.allowRemoteModels = true

type Cache = { embedder: Promise<FeatureExtractionPipeline> | undefined }
const globalForEmbed = globalThis as unknown as Cache

/**
 * Loads once per process. The promise itself is cached so concurrent
 * callers during the ~2s cold start share a single load.
 */
function getEmbedder(): Promise<FeatureExtractionPipeline> {
  globalForEmbed.embedder ??= pipeline('feature-extraction', MODEL_ID, {
    dtype: 'fp32',
  }) as unknown as Promise<FeatureExtractionPipeline>
  return globalForEmbed.embedder
}

export async function embedText(text: string): Promise<number[]> {
  const trimmed = text.trim()
  if (trimmed.length === 0) {
    throw new Error('Cannot embed empty text')
  }

  const embedder = await getEmbedder()
  const output = await embedder(trimmed, {
    pooling: 'mean',
    normalize: true,
  })

  return Array.from(output.data as Float32Array)
}

export async function embedBatch(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return []

  // @huggingface/transformers v3 handles batching differently,
  // process one at a time for reliability.
  const vectors: number[][] = []
  for (const text of texts) {
    vectors.push(await embedText(text))
  }
  return vectors
}

/** Vectors are pre-normalised, so this is effectively a dot product. */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0

  let dot = 0
  let magA = 0
  let magB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    magA += a[i] * a[i]
    magB += b[i] * b[i]
  }

  const denom = Math.sqrt(magA) * Math.sqrt(magB)
  return denom === 0 ? 0 : dot / denom
}
