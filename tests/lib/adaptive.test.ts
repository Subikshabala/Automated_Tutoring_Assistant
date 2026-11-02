import { describe, expect, it } from 'vitest'
import { classifySituation, isReady, reasonFor, recommend } from '@/lib/adaptive'
import type { ConceptGraph } from '@/lib/schemas/concept'
import type { MasteryWithConcept } from '@/lib/repositories/mastery'

function concept(id: string, name: string, topicId: string | null = 't1') {
  return {
    id,
    courseId: 'course1',
    topicId,
    name,
    definition: 'd',
    difficulty: 'BEGINNER' as const,
    objectives: [],
  }
}

function prereq(fromId: string, toId: string) {
  return {
    id: `${fromId}->${toId}`,
    fromId,
    toId,
    type: 'PREREQUISITE_OF' as const,
    strength: 1,
  }
}

function mastery(
  conceptId: string,
  conceptName: string,
  score: number,
  status: MasteryWithConcept['status'],
): MasteryWithConcept {
  return {
    conceptId,
    conceptName,
    masteryScore: score,
    confidenceScore: 0.5,
    attemptCount: 2,
    correctCount: 1,
    incorrectCount: 1,
    status,
    lastAssessmentAt: new Date(),
  }
}

// a -> b -> c  (a is a prerequisite of b, b of c)
const graph: ConceptGraph = {
  concepts: [concept('a', 'Alpha'), concept('b', 'Beta'), concept('c', 'Gamma')],
  relationships: [prereq('a', 'b'), prereq('b', 'c')],
}

describe('isReady', () => {
  it('returns true for a concept with no prerequisites', () => {
    expect(isReady('a', graph, new Map())).toBe(true)
  })

  it('returns false when a prerequisite is unstarted', () => {
    expect(isReady('b', graph, new Map())).toBe(false)
  })

  it('returns false when a prerequisite is below the readiness threshold', () => {
    const scores = new Map([['a', 40]])
    expect(isReady('b', graph, scores)).toBe(false)
  })

  it('returns true when a prerequisite is at the readiness threshold', () => {
    const scores = new Map([['a', 65]])
    expect(isReady('b', graph, scores)).toBe(true)
  })

  it('requires every prerequisite, not just one', () => {
    const wide: ConceptGraph = {
      concepts: [concept('a', 'A'), concept('b', 'B'), concept('z', 'Z')],
      relationships: [prereq('a', 'z'), prereq('b', 'z')],
    }
    expect(isReady('z', wide, new Map([['a', 90]]))).toBe(false)
    expect(isReady('z', wide, new Map([['a', 90], ['b', 90]]))).toBe(true)
  })
})

describe('recommend', () => {
  it('recommends only the ready root concept for a brand new learner', () => {
    const results = recommend(graph, [], 'generative-ai')
    expect(results.map((r) => r.conceptName)).toEqual(['Alpha'])
  })

  it('labels an unstarted ready concept as LEARN', () => {
    const results = recommend(graph, [], 'generative-ai')
    expect(results[0].action).toBe('LEARN')
  })

  it('unlocks the next concept once its prerequisite is strong enough', () => {
    const records = [mastery('a', 'Alpha', 85, 'MASTERED')]
    const results = recommend(graph, records, 'generative-ai')
    expect(results.map((r) => r.conceptName)).toContain('Beta')
  })

  it('does not recommend a mastered concept', () => {
    const records = [mastery('a', 'Alpha', 85, 'MASTERED')]
    const results = recommend(graph, records, 'generative-ai')
    expect(results.map((r) => r.conceptName)).not.toContain('Alpha')
  })

  it('labels a weak concept as REVIEW', () => {
    const records = [mastery('a', 'Alpha', 30, 'NEEDS_REVIEW')]
    const results = recommend(graph, records, 'generative-ai')
    const alpha = results.find((r) => r.conceptName === 'Alpha')
    expect(alpha!.action).toBe('REVIEW')
  })

  it('labels a mid-range concept as PRACTISE', () => {
    const records = [mastery('a', 'Alpha', 70, 'PRACTICING')]
    const results = recommend(graph, records, 'generative-ai')
    const alpha = results.find((r) => r.conceptName === 'Alpha')
    expect(alpha!.action).toBe('PRACTISE')
  })

  it('ranks a REVIEW above a LEARN', () => {
    const records = [mastery('a', 'Alpha', 25, 'NEEDS_REVIEW')]
    const results = recommend(graph, records, 'generative-ai')
    expect(results[0].action).toBe('REVIEW')
  })

  it('gives every recommendation a non-empty reason', () => {
    const records = [mastery('a', 'Alpha', 30, 'NEEDS_REVIEW')]
    for (const result of recommend(graph, records, 'generative-ai')) {
      expect(result.reason.length).toBeGreaterThan(0)
    }
  })

  it('names the downstream dependent in a weak-concept reason', () => {
    const records = [mastery('a', 'Alpha', 25, 'NEEDS_REVIEW')]
    const results = recommend(graph, records, 'generative-ai')
    expect(results[0].reason.toLowerCase()).toContain('beta')
  })

  it('sorts results by descending priority', () => {
    const records = [
      mastery('a', 'Alpha', 30, 'NEEDS_REVIEW'),
      mastery('b', 'Beta', 70, 'PRACTICING'),
    ]
    const results = recommend(graph, records, 'generative-ai')
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].priority).toBeGreaterThanOrEqual(results[i].priority)
    }
  })

  it('respects the limit argument', () => {
    const wide: ConceptGraph = {
      concepts: Array.from({ length: 10 }, (_, i) =>
        concept(`n${i}`, `Node ${i}`),
      ),
      relationships: [],
    }
    expect(recommend(wide, [], 'generative-ai', 3)).toHaveLength(3)
  })

  it('returns an empty array when every concept is mastered', () => {
    const records = [
      mastery('a', 'Alpha', 90, 'MASTERED'),
      mastery('b', 'Beta', 90, 'MASTERED'),
      mastery('c', 'Gamma', 90, 'MASTERED'),
    ]
    expect(recommend(graph, records, 'generative-ai')).toEqual([])
  })

  it('carries the course slug through to every recommendation', () => {
    for (const result of recommend(graph, [], 'generative-ai')) {
      expect(result.courseSlug).toBe('generative-ai')
    }
  })

  it('handles a graph with no concepts', () => {
    expect(
      recommend({ concepts: [], relationships: [] }, [], 'generative-ai'),
    ).toEqual([])
  })
})

describe('classifySituation', () => {
  it('calls the very first concept FIRST_STEP', () => {
    expect(
      classifySituation({
        score: 0, started: false, totalStarted: 0, unlocksCount: 1, prerequisiteCount: 0,
      }),
    ).toBe('FIRST_STEP')
  })

  it('calls a high-leverage unstarted concept GATEWAY', () => {
    expect(
      classifySituation({
        score: 0, started: false, totalStarted: 5, unlocksCount: 3, prerequisiteCount: 1,
      }),
    ).toBe('GATEWAY')
  })

  it('calls an ordinary unstarted concept READY', () => {
    expect(
      classifySituation({
        score: 0, started: false, totalStarted: 5, unlocksCount: 1, prerequisiteCount: 1,
      }),
    ).toBe('READY')
  })

  it('calls 65-79 NEARLY_THERE', () => {
    expect(
      classifySituation({
        score: 72, started: true, totalStarted: 3, unlocksCount: 0, prerequisiteCount: 1,
      }),
    ).toBe('NEARLY_THERE')
  })

  it('calls 50-64 SHAKY', () => {
    expect(
      classifySituation({
        score: 58, started: true, totalStarted: 3, unlocksCount: 0, prerequisiteCount: 1,
      }),
    ).toBe('SHAKY')
  })

  it('calls a weak concept with dependents BLOCKED_DOWNSTREAM', () => {
    expect(
      classifySituation({
        score: 30, started: true, totalStarted: 3, unlocksCount: 2, prerequisiteCount: 0,
      }),
    ).toBe('BLOCKED_DOWNSTREAM')
  })

  it('calls a weak leaf concept FOUNDATIONAL_GAP', () => {
    expect(
      classifySituation({
        score: 30, started: true, totalStarted: 3, unlocksCount: 0, prerequisiteCount: 1,
      }),
    ).toBe('FOUNDATIONAL_GAP')
  })
})

describe('reasonFor variety', () => {
  const base = {
    conceptName: 'Attention', score: 0, unlocks: [], prerequisites: [], index: 0,
  }

  it('writes a distinct sentence per situation', () => {
    const sentences = new Set([
      reasonFor('FIRST_STEP', base),
      reasonFor('GATEWAY', { ...base, unlocks: ['A', 'B', 'C'] }),
      reasonFor('READY', base),
      reasonFor('NEARLY_THERE', { ...base, score: 72 }),
      reasonFor('SHAKY', { ...base, score: 58 }),
      reasonFor('BLOCKED_DOWNSTREAM', { ...base, score: 30, unlocks: ['X'] }),
      reasonFor('FOUNDATIONAL_GAP', { ...base, score: 30 }),
    ])
    expect(sentences.size).toBe(7)
  })

  it('varies phrasing for repeated situations in one list', () => {
    const first = reasonFor('READY', { ...base, index: 0 })
    const second = reasonFor('READY', { ...base, conceptName: 'Embeddings', index: 1 })
    const third = reasonFor('READY', { ...base, conceptName: 'Tokenization', index: 2 })
    expect(new Set([first, second, third]).size).toBe(3)
  })

  it('names the concept', () => {
    expect(reasonFor('READY', base)).toContain('Attention')
  })

  it('names what is unlocked when relevant', () => {
    const r = reasonFor('GATEWAY', { ...base, unlocks: ['Tool Calling', 'Guardrails', 'Reflection'] })
    expect(r).toContain('Tool Calling')
  })

  it('names the prerequisite that just cleared', () => {
    const r = reasonFor('NEWLY_UNLOCKED', { ...base, prerequisites: ['ReAct Pattern'] })
    expect(r).toContain('ReAct Pattern')
  })

  it('includes the score where it is informative', () => {
    expect(reasonFor('NEARLY_THERE', { ...base, score: 72 })).toContain('72')
  })

  it('omits the score for unstarted concepts', () => {
    expect(reasonFor('READY', base)).not.toContain('0')
  })

  it('never exceeds two sentences', () => {
    for (const s of ['FIRST_STEP', 'GATEWAY', 'READY', 'NEARLY_THERE', 'SHAKY', 'BLOCKED_DOWNSTREAM', 'FOUNDATIONAL_GAP'] as const) {
      const sentences = reasonFor(s, { ...base, score: 50, unlocks: ['X'], prerequisites: ['Y'] })
        .split(/[.!?]\s/)
        .filter(Boolean)
      expect(sentences.length).toBeLessThanOrEqual(2)
    }
  })
})
