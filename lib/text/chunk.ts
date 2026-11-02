export const DEFAULT_CHUNK_SIZE = 1200
export const DEFAULT_OVERLAP = 200

export function cleanText(raw: string): string {
  return raw
    .replace(/\u0000/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[^\S\n]+/g, ' ')
    .trim()
}

/**
 * Splits text into word-aligned chunks of at most `size` characters,
 * with `overlap` characters of context repeated between neighbours.
 */
export function chunkText(
  text: string,
  size: number = DEFAULT_CHUNK_SIZE,
  overlap: number = DEFAULT_OVERLAP,
): string[] {
  const cleaned = cleanText(text)
  if (cleaned.length === 0) return []
  if (cleaned.length <= size) return [cleaned]

  // Guarantee forward progress even if the caller passes overlap >= size.
  const step = Math.max(1, size - Math.min(overlap, size - 1))

  const words = cleaned.split(' ')
  const chunks: string[] = []

  let current: string[] = []
  let currentLength = 0

  for (const word of words) {
    const addedLength = currentLength === 0 ? word.length : currentLength + 1 + word.length

    if (addedLength > size && current.length > 0) {
      chunks.push(current.join(' '))

      // Rebuild the tail of the previous chunk as the head of the next one.
      const tail: string[] = []
      let tailLength = 0
      for (let i = current.length - 1; i >= 0; i--) {
        const next = tailLength === 0 ? current[i].length : tailLength + 1 + current[i].length
        if (next > size - step) break
        tail.unshift(current[i])
        tailLength = next
      }

      current = [...tail, word]
      currentLength = tail.join(' ').length + (tail.length > 0 ? 1 : 0) + word.length
    } else {
      current.push(word)
      currentLength = addedLength
    }
  }

  if (current.length > 0) {
    chunks.push(current.join(' '))
  }

  return chunks.filter((c) => c.trim().length > 0)
}
