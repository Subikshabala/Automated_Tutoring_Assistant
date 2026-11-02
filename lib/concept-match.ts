/**
 * Resiliently matches a raw concept name returned by an LLM to a concept in the given list.
 * Handles exact matches, definitions appended with colons, depth markers like (depth 0),
 * quotes, and prefixes. Returns null only if no plausible match is found.
 */
export function findMatchingConceptId(
  rawConceptName: string,
  concepts: { id: string; name: string }[],
): string | null {
  if (!rawConceptName || concepts.length === 0) return null

  const normalize = (name: string) =>
    name
      .trim()
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()

  const rawNorm = normalize(rawConceptName)

  // 1. Direct normalized equality
  const direct = concepts.find((c) => normalize(c.name) === rawNorm)
  if (direct) return direct.id

  // 2. Extract concept name part before colon, hyphen, or parentheses
  // e.g. "Attention: A mechanism..." -> "Attention"
  // e.g. "Tokenization (depth 0): ..." -> "Tokenization"
  // e.g. "Concept: Tokenization" -> "Tokenization"
  const stripped = rawConceptName
    .replace(/^concept\s*[:\-]\s*/i, '')
    .split(/[:\-\(]/)[0]
    .replace(/["'`]/g, '')
    .trim()
  const strippedNorm = normalize(stripped)

  if (strippedNorm.length > 0) {
    const strippedMatch = concepts.find((c) => normalize(c.name) === strippedNorm)
    if (strippedMatch) return strippedMatch.id
  }

  // 3. Substring match: check if a concept name matches as a distinct prefix or substring
  // Sort longer names first so "Zero Trust Network" matches before "Zero Trust"
  const sorted = [...concepts].sort((a, b) => b.name.length - a.name.length)
  for (const c of sorted) {
    const cNorm = normalize(c.name)
    if (cNorm.length > 2 && (rawNorm.startsWith(cNorm) || rawNorm.includes(cNorm))) {
      return c.id
    }
  }

  // 4. Also check if strippedNorm is contained in cNorm
  if (strippedNorm.length > 2) {
    for (const c of sorted) {
      const cNorm = normalize(c.name)
      if (cNorm.includes(strippedNorm)) {
        return c.id
      }
    }
  }

  return null
}
