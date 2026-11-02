# Phase 4 — Assessment & Mastery

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` or `superpowers:executing-plans`. Steps use checkbox (`- [ ]`) syntax.

**Goal:** A learner generates a quiz for a topic, answers MCQ and short-answer questions, gets graded — MCQ deterministically, short answers semantically by Gemini — and sees their mastery score per concept update as a result.

**Architecture:** A generation service asks Gemini for questions scoped to specific concepts and validates them with Zod. Grading is split: MCQ comparison is pure and deterministic, short answers go to Gemini with a strict evaluation schema. Mastery is a pure scoring function applied to the stored counters, so the thresholds are unit-testable in isolation from both the DB and the model.

**Tech Stack:** Gemini · Zod · Prisma · Next.js Route Handlers · shadcn/ui

**Depends on:** Phase 3 complete (Gemini client and tutor service exist).

**Done when:** `/assessment/<id>` renders a generated quiz, submitting it produces per-question feedback, and `Mastery` rows for the involved concepts reflect the result.

---

## File Structure

| Path | Responsibility |
|---|---|
| `lib/schemas/assessment.ts` | Question, answer, submission, result contracts |
| `lib/ai/assessment.ts` | `generateQuestions`, `evaluateShortAnswer` |
| `lib/mastery.ts` | Pure mastery scoring and status thresholds |
| `lib/grading.ts` | Pure MCQ grading |
| `lib/repositories/assessment.ts` | Assessment + question + answer persistence |
| `lib/repositories/mastery.ts` | Mastery read/update |
| `app/api/assessments/generate/route.ts` | `POST` create an assessment |
| `app/api/assessments/[id]/route.ts` | `GET` fetch an assessment |
| `app/api/assessments/[id]/submit/route.ts` | `POST` grade a submission |
| `components/question-card.tsx` | One question, MCQ or short answer |
| `components/assessment-runner.tsx` | Quiz flow (client) |
| `components/assessment-result.tsx` | Score + per-question feedback |
| `app/assessment/[id]/page.tsx` | Assessment page |

---

## Task 1: Assessment schemas

**Files:**
- Create: `lib/schemas/assessment.ts`
- Test: `tests/lib/schemas-assessment.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/lib/schemas-assessment.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  generatedQuestionSchema,
  generatedQuizSchema,
  shortAnswerEvaluationSchema,
  submissionSchema,
} from '@/lib/schemas/assessment'

const mcq = {
  type: 'MCQ' as const,
  prompt: 'What is a token?',
  options: ['A subword unit', 'A whole word', 'A character', 'A sentence'],
  correctAnswer: 'A subword unit',
  explanation: 'Tokenizers emit subword units from a fixed vocabulary.',
  conceptName: 'Tokenization',
  difficulty: 'BEGINNER' as const,
}

const short = {
  type: 'SHORT_ANSWER' as const,
  prompt: 'Why do models use subwords rather than whole words?',
  options: [],
  correctAnswer: 'Subwords bound vocabulary size while still covering rare words.',
  explanation: 'A whole-word vocabulary cannot cover unseen words.',
  conceptName: 'Tokenization',
  difficulty: 'INTERMEDIATE' as const,
}

describe('generatedQuestionSchema', () => {
  it('accepts a well formed MCQ', () => {
    expect(generatedQuestionSchema.parse(mcq).type).toBe('MCQ')
  })

  it('accepts a well formed short answer question', () => {
    expect(generatedQuestionSchema.parse(short).type).toBe('SHORT_ANSWER')
  })

  it('rejects an MCQ with fewer than two options', () => {
    const result = generatedQuestionSchema.safeParse({
      ...mcq,
      options: ['only one'],
    })
    expect(result.success).toBe(false)
  })

  it('rejects an MCQ whose correctAnswer is not among the options', () => {
    const result = generatedQuestionSchema.safeParse({
      ...mcq,
      correctAnswer: 'Not in the list',
    })
    expect(result.success).toBe(false)
  })

  it('does not require correctAnswer to be in options for a short answer', () => {
    expect(generatedQuestionSchema.safeParse(short).success).toBe(true)
  })

  it('rejects an empty explanation', () => {
    expect(
      generatedQuestionSchema.safeParse({ ...mcq, explanation: '' }).success,
    ).toBe(false)
  })
})

describe('generatedQuizSchema', () => {
  it('accepts a quiz with questions', () => {
    expect(generatedQuizSchema.parse({ questions: [mcq, short] }).questions).toHaveLength(2)
  })

  it('rejects an empty quiz', () => {
    expect(generatedQuizSchema.safeParse({ questions: [] }).success).toBe(false)
  })

  it('rejects more than ten questions', () => {
    const questions = Array.from({ length: 11 }, () => mcq)
    expect(generatedQuizSchema.safeParse({ questions }).success).toBe(false)
  })
})

describe('shortAnswerEvaluationSchema', () => {
  const evaluation = {
    correctness: 0.8,
    understoodConcepts: ['Tokenization'],
    misunderstoodConcepts: [],
    missingPoints: ['Did not mention vocabulary size'],
    feedback: 'Close. You identified the coverage benefit but not the size bound.',
  }

  it('accepts a well formed evaluation', () => {
    expect(shortAnswerEvaluationSchema.parse(evaluation).correctness).toBe(0.8)
  })

  it('rejects correctness above 1', () => {
    expect(
      shortAnswerEvaluationSchema.safeParse({ ...evaluation, correctness: 1.5 })
        .success,
    ).toBe(false)
  })

  it('rejects correctness below 0', () => {
    expect(
      shortAnswerEvaluationSchema.safeParse({ ...evaluation, correctness: -0.1 })
        .success,
    ).toBe(false)
  })

  it('defaults the list fields to empty arrays', () => {
    const parsed = shortAnswerEvaluationSchema.parse({
      correctness: 1,
      feedback: 'Correct.',
    })
    expect(parsed.understoodConcepts).toEqual([])
    expect(parsed.misunderstoodConcepts).toEqual([])
    expect(parsed.missingPoints).toEqual([])
  })
})

describe('submissionSchema', () => {
  it('accepts a list of responses', () => {
    const parsed = submissionSchema.parse({
      responses: [{ questionId: 'q1', response: 'A subword unit' }],
    })
    expect(parsed.responses).toHaveLength(1)
  })

  it('rejects an empty responses array', () => {
    expect(submissionSchema.safeParse({ responses: [] }).success).toBe(false)
  })

  it('allows an empty response string for a skipped question', () => {
    expect(
      submissionSchema.safeParse({
        responses: [{ questionId: 'q1', response: '' }],
      }).success,
    ).toBe(true)
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm test tests/lib/schemas-assessment.test.ts`
Expected: FAIL — `Cannot find module '@/lib/schemas/assessment'`.

- [ ] **Step 3: Create `lib/schemas/assessment.ts`**

```ts
import { z } from 'zod'
import { difficultySchema, idSchema } from './common'

export const questionTypeSchema = z.enum(['MCQ', 'SHORT_ANSWER', 'SCENARIO'])

export const generatedQuestionSchema = z
  .object({
    type: questionTypeSchema,
    prompt: z.string().min(1),
    options: z.array(z.string().min(1)).default([]),
    correctAnswer: z.string().min(1),
    explanation: z.string().min(1),
    conceptName: z.string().min(1),
    difficulty: difficultySchema,
  })
  .refine(
    (q) => q.type !== 'MCQ' || q.options.length >= 2,
    { message: 'MCQ questions need at least two options', path: ['options'] },
  )
  .refine(
    (q) => q.type !== 'MCQ' || q.options.includes(q.correctAnswer),
    {
      message: 'correctAnswer must be one of the options',
      path: ['correctAnswer'],
    },
  )

export const generatedQuizSchema = z.object({
  questions: z.array(generatedQuestionSchema).min(1).max(10),
})

export const shortAnswerEvaluationSchema = z.object({
  correctness: z.number().min(0).max(1),
  understoodConcepts: z.array(z.string()).default([]),
  misunderstoodConcepts: z.array(z.string()).default([]),
  missingPoints: z.array(z.string()).default([]),
  feedback: z.string().min(1),
})

export const submissionSchema = z.object({
  responses: z
    .array(
      z.object({
        questionId: idSchema,
        response: z.string(),
      }),
    )
    .min(1),
})

export const questionDtoSchema = z.object({
  id: idSchema,
  conceptId: idSchema,
  conceptName: z.string(),
  type: questionTypeSchema,
  prompt: z.string(),
  options: z.array(z.string()),
  difficulty: difficultySchema,
  order: z.number().int(),
})

export const assessmentDtoSchema = z.object({
  id: idSchema,
  topicTitle: z.string().nullable(),
  courseSlug: z.string().nullable(),
  score: z.number().nullable(),
  submittedAt: z.string().nullable(),
  questions: z.array(questionDtoSchema),
})

export type GeneratedQuestion = z.infer<typeof generatedQuestionSchema>
export type GeneratedQuiz = z.infer<typeof generatedQuizSchema>
export type ShortAnswerEvaluation = z.infer<typeof shortAnswerEvaluationSchema>
export type Submission = z.infer<typeof submissionSchema>
export type QuestionDto = z.infer<typeof questionDtoSchema>
export type AssessmentDto = z.infer<typeof assessmentDtoSchema>
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npm test tests/lib/schemas-assessment.test.ts`
Expected: PASS — `16 passed`.

- [ ] **Step 5: Commit**

```bash
git add lib/schemas/assessment.ts tests/lib/schemas-assessment.test.ts
git commit -m "feat(assessment): add zod contracts for questions, evaluation and submission"
```

---

## Task 2: Deterministic MCQ grading

Pure function, no DB, no model. The one part of grading that must never be probabilistic.

**Files:**
- Create: `lib/grading.ts`
- Test: `tests/lib/grading.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/lib/grading.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { gradeMcq } from '@/lib/grading'

describe('gradeMcq', () => {
  it('scores an exact match as fully correct', () => {
    expect(gradeMcq('A subword unit', 'A subword unit')).toEqual({
      isCorrect: true,
      score: 1,
    })
  })

  it('scores a mismatch as incorrect', () => {
    expect(gradeMcq('A whole word', 'A subword unit')).toEqual({
      isCorrect: false,
      score: 0,
    })
  })

  it('ignores surrounding whitespace', () => {
    expect(gradeMcq('  A subword unit  ', 'A subword unit').isCorrect).toBe(true)
  })

  it('ignores case differences', () => {
    expect(gradeMcq('a SUBWORD unit', 'A subword unit').isCorrect).toBe(true)
  })

  it('treats an empty response as incorrect', () => {
    expect(gradeMcq('', 'A subword unit')).toEqual({
      isCorrect: false,
      score: 0,
    })
  })

  it('does not treat a substring as a match', () => {
    expect(gradeMcq('subword', 'A subword unit').isCorrect).toBe(false)
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm test tests/lib/grading.test.ts`
Expected: FAIL — `Cannot find module '@/lib/grading'`.

- [ ] **Step 3: Create `lib/grading.ts`**

```ts
export type GradeResult = {
  isCorrect: boolean
  score: number
}

function normalise(value: string): string {
  return value.trim().toLowerCase()
}

export function gradeMcq(response: string, correctAnswer: string): GradeResult {
  const isCorrect =
    normalise(response).length > 0 &&
    normalise(response) === normalise(correctAnswer)
  return { isCorrect, score: isCorrect ? 1 : 0 }
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npm test tests/lib/grading.test.ts`
Expected: PASS — `6 passed`.

- [ ] **Step 5: Commit**

```bash
git add lib/grading.ts tests/lib/grading.test.ts
git commit -m "feat(assessment): add deterministic mcq grading"
```

---

## Task 3: Mastery scoring

Also pure. The architecture document specifies the thresholds; this encodes them once.

**Files:**
- Create: `lib/mastery.ts`
- Test: `tests/lib/mastery.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/lib/mastery.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  applyAttempt,
  masteryStatusFor,
  recommendationFor,
} from '@/lib/mastery'

const fresh = {
  masteryScore: 0,
  confidenceScore: 0,
  attemptCount: 0,
  correctCount: 0,
  incorrectCount: 0,
}

describe('masteryStatusFor', () => {
  it('returns NOT_STARTED with no attempts', () => {
    expect(masteryStatusFor(0, 0)).toBe('NOT_STARTED')
  })

  it('returns NEEDS_REVIEW below 50', () => {
    expect(masteryStatusFor(30, 3)).toBe('NEEDS_REVIEW')
  })

  it('returns LEARNING from 50 to 64', () => {
    expect(masteryStatusFor(55, 3)).toBe('LEARNING')
  })

  it('returns PRACTICING from 65 to 79', () => {
    expect(masteryStatusFor(70, 3)).toBe('PRACTICING')
  })

  it('returns MASTERED at 80 and above', () => {
    expect(masteryStatusFor(80, 3)).toBe('MASTERED')
  })

  it('does not award MASTERED on a single attempt', () => {
    expect(masteryStatusFor(100, 1)).toBe('PRACTICING')
  })
})

describe('applyAttempt', () => {
  it('sets the score to 100 after one fully correct attempt', () => {
    const next = applyAttempt(fresh, 1)
    expect(next.masteryScore).toBe(100)
    expect(next.correctCount).toBe(1)
    expect(next.attemptCount).toBe(1)
  })

  it('sets the score to 0 after one fully incorrect attempt', () => {
    const next = applyAttempt(fresh, 0)
    expect(next.masteryScore).toBe(0)
    expect(next.incorrectCount).toBe(1)
  })

  it('counts a partial score above 0.5 as correct', () => {
    const next = applyAttempt(fresh, 0.8)
    expect(next.correctCount).toBe(1)
    expect(next.incorrectCount).toBe(0)
  })

  it('counts a partial score at or below 0.5 as incorrect', () => {
    const next = applyAttempt(fresh, 0.5)
    expect(next.correctCount).toBe(0)
    expect(next.incorrectCount).toBe(1)
  })

  it('weights recent attempts more heavily than old ones', () => {
    const afterFailure = applyAttempt(fresh, 0)
    const afterSuccess = applyAttempt(afterFailure, 1)
    expect(afterSuccess.masteryScore).toBeGreaterThan(50)
  })

  it('keeps the score within 0 and 100', () => {
    let state = fresh
    for (let i = 0; i < 10; i++) state = applyAttempt(state, 1)
    expect(state.masteryScore).toBeLessThanOrEqual(100)

    let low = fresh
    for (let i = 0; i < 10; i++) low = applyAttempt(low, 0)
    expect(low.masteryScore).toBeGreaterThanOrEqual(0)
  })

  it('raises confidence as attempts accumulate', () => {
    const one = applyAttempt(fresh, 1)
    const two = applyAttempt(one, 1)
    expect(two.confidenceScore).toBeGreaterThan(one.confidenceScore)
  })

  it('caps confidence at 1', () => {
    let state = fresh
    for (let i = 0; i < 20; i++) state = applyAttempt(state, 1)
    expect(state.confidenceScore).toBeLessThanOrEqual(1)
  })
})

describe('recommendationFor', () => {
  it('recommends advancing at 80 and above', () => {
    expect(recommendationFor(85)).toBe('ADVANCE')
  })

  it('recommends practice between 50 and 79', () => {
    expect(recommendationFor(60)).toBe('PRACTICE')
  })

  it('recommends reteaching below 50', () => {
    expect(recommendationFor(30)).toBe('RETEACH')
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm test tests/lib/mastery.test.ts`
Expected: FAIL — `Cannot find module '@/lib/mastery'`.

- [ ] **Step 3: Create `lib/mastery.ts`**

```ts
import type { MasteryStatus } from '@/lib/schemas/common'

export type MasteryState = {
  masteryScore: number
  confidenceScore: number
  attemptCount: number
  correctCount: number
  incorrectCount: number
}

export type Recommendation = 'ADVANCE' | 'PRACTICE' | 'RETEACH'

/** Weight given to the newest attempt. Older attempts decay geometrically. */
const RECENCY_WEIGHT = 0.4

/** Attempts needed before MASTERED can be awarded. */
const MASTERY_MIN_ATTEMPTS = 2

export function masteryStatusFor(
  score: number,
  attemptCount: number,
): MasteryStatus {
  if (attemptCount === 0) return 'NOT_STARTED'
  if (score < 50) return 'NEEDS_REVIEW'
  if (score < 65) return 'LEARNING'
  if (score < 80) return 'PRACTICING'
  return attemptCount >= MASTERY_MIN_ATTEMPTS ? 'MASTERED' : 'PRACTICING'
}

/**
 * Exponential moving average over attempt scores.
 * `attemptScore` is 0..1; `masteryScore` is 0..100.
 */
export function applyAttempt(
  state: MasteryState,
  attemptScore: number,
): MasteryState {
  const clamped = Math.min(1, Math.max(0, attemptScore))
  const asPercent = clamped * 100

  const masteryScore =
    state.attemptCount === 0
      ? asPercent
      : state.masteryScore * (1 - RECENCY_WEIGHT) + asPercent * RECENCY_WEIGHT

  const attemptCount = state.attemptCount + 1
  const wasCorrect = clamped > 0.5

  return {
    masteryScore: Math.min(100, Math.max(0, Math.round(masteryScore))),
    confidenceScore: Math.min(1, attemptCount / 5),
    attemptCount,
    correctCount: state.correctCount + (wasCorrect ? 1 : 0),
    incorrectCount: state.incorrectCount + (wasCorrect ? 0 : 1),
  }
}

export function recommendationFor(score: number): Recommendation {
  if (score >= 80) return 'ADVANCE'
  if (score >= 50) return 'PRACTICE'
  return 'RETEACH'
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npm test tests/lib/mastery.test.ts`
Expected: PASS — `17 passed`.

- [ ] **Step 5: Commit**

```bash
git add lib/mastery.ts tests/lib/mastery.test.ts
git commit -m "feat(mastery): add pure mastery scoring with recency weighting"
```

---

## Task 4: Question generation and answer evaluation

**Files:**
- Modify: `lib/ai/prompts.ts`
- Create: `lib/ai/assessment.ts`
- Test: `tests/ai/assessment.test.ts`

- [ ] **Step 1: Append the prompts to `lib/ai/prompts.ts`**

```ts
export type QuizRequest = {
  courseTitle: string
  topicTitle: string
  concepts: { name: string; definition: string }[]
  questionCount: number
}

export function quizPrompt(request: QuizRequest): string {
  const concepts = request.concepts
    .map((c) => `- ${c.name}: ${c.definition}`)
    .join('\n')

  return `Write a short quiz that tests understanding, not recall.

Course: ${request.courseTitle}
Topic: ${request.topicTitle}

Concepts to test (use the exact names in conceptName):
${concepts}

Produce exactly ${request.questionCount} questions.
Roughly two thirds MCQ and one third SHORT_ANSWER.
Every question must target exactly one of the concepts listed above.
MCQ distractors must be plausible — not obviously wrong.

Return JSON:
{
  "questions": [
    {
      "type": "MCQ" | "SHORT_ANSWER",
      "prompt": "the question text",
      "options": ["4 options for MCQ, empty array for SHORT_ANSWER"],
      "correctAnswer": "the exact correct option for MCQ, or a model answer for SHORT_ANSWER",
      "explanation": "why that answer is right, in 1-2 sentences",
      "conceptName": "exact concept name from the list above",
      "difficulty": "BEGINNER" | "INTERMEDIATE" | "ADVANCED"
    }
  ]
}`
}

export type EvaluationRequest = {
  conceptName: string
  conceptDefinition: string
  question: string
  modelAnswer: string
  learnerAnswer: string
}

export function evaluationPrompt(request: EvaluationRequest): string {
  return `Grade a learner's short answer. Judge understanding, not wording.

Concept: ${request.conceptName}
Definition: ${request.conceptDefinition}
Question: ${request.question}
Model answer: ${request.modelAnswer}
Learner answer: ${request.learnerAnswer}

Award partial credit. A learner who grasps the idea but phrases it differently
should score high. A learner who uses the right words without the idea should not.

Return JSON:
{
  "correctness": 0.0 to 1.0,
  "understoodConcepts": ["what they clearly grasped"],
  "misunderstoodConcepts": ["what they got wrong, if anything"],
  "missingPoints": ["important points they omitted"],
  "feedback": "2-3 sentences addressed to the learner, specific and kind but honest"
}`
}
```

- [ ] **Step 2: Write the failing test**

Create `tests/ai/assessment.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const generateStructured = vi.fn()
vi.mock('@/lib/ai/gemini', () => ({ generateStructured }))

const quiz = {
  questions: [
    {
      type: 'MCQ' as const,
      prompt: 'What is a token?',
      options: ['A subword unit', 'A whole word', 'A character', 'A sentence'],
      correctAnswer: 'A subword unit',
      explanation: 'Tokenizers emit subword units.',
      conceptName: 'Tokenization',
      difficulty: 'BEGINNER' as const,
    },
  ],
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('generateQuestions', () => {
  it('returns the validated quiz', async () => {
    generateStructured.mockResolvedValue(quiz)
    const { generateQuestions } = await import('@/lib/ai/assessment')
    const result = await generateQuestions({
      courseTitle: 'Generative AI Foundations',
      topicTitle: 'Text Representation',
      concepts: [{ name: 'Tokenization', definition: 'Splitting text.' }],
      questionCount: 1,
    })
    expect(result.questions).toHaveLength(1)
  })

  it('includes every concept name in the prompt', async () => {
    generateStructured.mockResolvedValue(quiz)
    const { generateQuestions } = await import('@/lib/ai/assessment')
    await generateQuestions({
      courseTitle: 'C',
      topicTitle: 'T',
      concepts: [
        { name: 'Tokenization', definition: 'a' },
        { name: 'Embeddings', definition: 'b' },
      ],
      questionCount: 2,
    })
    const { prompt } = generateStructured.mock.calls[0][0]
    expect(prompt).toContain('Tokenization')
    expect(prompt).toContain('Embeddings')
  })

  it('uses a low temperature for consistency', async () => {
    generateStructured.mockResolvedValue(quiz)
    const { generateQuestions } = await import('@/lib/ai/assessment')
    await generateQuestions({
      courseTitle: 'C',
      topicTitle: 'T',
      concepts: [{ name: 'X', definition: 'y' }],
      questionCount: 1,
    })
    expect(generateStructured.mock.calls[0][0].temperature).toBeLessThanOrEqual(0.4)
  })
})

describe('evaluateShortAnswer', () => {
  const evaluation = {
    correctness: 0.8,
    understoodConcepts: ['Tokenization'],
    misunderstoodConcepts: [],
    missingPoints: [],
    feedback: 'Good.',
  }

  it('returns the validated evaluation', async () => {
    generateStructured.mockResolvedValue(evaluation)
    const { evaluateShortAnswer } = await import('@/lib/ai/assessment')
    const result = await evaluateShortAnswer({
      conceptName: 'Tokenization',
      conceptDefinition: 'Splitting text.',
      question: 'Why subwords?',
      modelAnswer: 'Coverage and vocabulary size.',
      learnerAnswer: 'So rare words still work.',
    })
    expect(result.correctness).toBe(0.8)
  })

  it('includes the learner answer in the prompt', async () => {
    generateStructured.mockResolvedValue(evaluation)
    const { evaluateShortAnswer } = await import('@/lib/ai/assessment')
    await evaluateShortAnswer({
      conceptName: 'Tokenization',
      conceptDefinition: 'd',
      question: 'q',
      modelAnswer: 'm',
      learnerAnswer: 'my unique answer text',
    })
    expect(generateStructured.mock.calls[0][0].prompt).toContain(
      'my unique answer text',
    )
  })

  it('returns zero without calling the model for a blank answer', async () => {
    const { evaluateShortAnswer } = await import('@/lib/ai/assessment')
    const result = await evaluateShortAnswer({
      conceptName: 'Tokenization',
      conceptDefinition: 'd',
      question: 'q',
      modelAnswer: 'm',
      learnerAnswer: '   ',
    })
    expect(result.correctness).toBe(0)
    expect(generateStructured).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 3: Run it to confirm it fails**

Run: `npm test tests/ai/assessment.test.ts`
Expected: FAIL — `Cannot find module '@/lib/ai/assessment'`.

- [ ] **Step 4: Create `lib/ai/assessment.ts`**

```ts
import { generateStructured } from '@/lib/ai/gemini'
import {
  evaluationPrompt,
  quizPrompt,
  TUTOR_SYSTEM,
  type EvaluationRequest,
  type QuizRequest,
} from '@/lib/ai/prompts'
import {
  generatedQuizSchema,
  shortAnswerEvaluationSchema,
  type GeneratedQuiz,
  type ShortAnswerEvaluation,
} from '@/lib/schemas/assessment'

export async function generateQuestions(
  request: QuizRequest,
): Promise<GeneratedQuiz> {
  return generateStructured({
    prompt: quizPrompt(request),
    schema: generatedQuizSchema,
    system: TUTOR_SYSTEM,
    temperature: 0.4,
  })
}

export async function evaluateShortAnswer(
  request: EvaluationRequest,
): Promise<ShortAnswerEvaluation> {
  if (request.learnerAnswer.trim().length === 0) {
    return {
      correctness: 0,
      understoodConcepts: [],
      misunderstoodConcepts: [],
      missingPoints: [],
      feedback: 'No answer was given for this question.',
    }
  }

  return generateStructured({
    prompt: evaluationPrompt(request),
    schema: shortAnswerEvaluationSchema,
    system: TUTOR_SYSTEM,
    temperature: 0.2,
  })
}
```

- [ ] **Step 5: Run the test to confirm it passes**

Run: `npm test tests/ai/assessment.test.ts`
Expected: PASS — `6 passed`.

- [ ] **Step 6: Commit**

```bash
git add lib/ai/assessment.ts lib/ai/prompts.ts tests/ai/assessment.test.ts
git commit -m "feat(assessment): add question generation and short answer evaluation"
```

---

## Task 5: Mastery repository

**Files:**
- Create: `lib/repositories/mastery.ts`
- Test: `tests/repositories/mastery.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/repositories/mastery.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import prisma from '@/lib/prisma'
import {
  getMastery,
  listMasteryForCourse,
  recordAttempt,
} from '@/lib/repositories/mastery'

const TEST_USER = 'mastery-test-user'

async function conceptId(name: string) {
  const concept = await prisma.concept.findFirstOrThrow({ where: { name } })
  return concept.id
}

beforeEach(async () => {
  await prisma.user.upsert({
    where: { id: TEST_USER },
    create: {
      id: TEST_USER,
      email: 'mastery-test@example.com',
      passwordHash: 'x',
      name: 'Mastery Test',
    },
    update: {},
  })
})

afterEach(async () => {
  await prisma.mastery.deleteMany({ where: { userId: TEST_USER } })
})

describe('getMastery', () => {
  it('returns null when the learner has no record for the concept', async () => {
    await expect(
      getMastery(TEST_USER, await conceptId('Tokenization')),
    ).resolves.toBeNull()
  })
})

describe('recordAttempt', () => {
  it('creates a record on the first attempt', async () => {
    const id = await conceptId('Tokenization')
    const result = await recordAttempt(TEST_USER, id, 1)
    expect(result.masteryScore).toBe(100)
    expect(result.attemptCount).toBe(1)
  })

  it('sets the status to PRACTICING after one perfect attempt', async () => {
    const id = await conceptId('Tokenization')
    const result = await recordAttempt(TEST_USER, id, 1)
    expect(result.status).toBe('PRACTICING')
  })

  it('awards MASTERED after two perfect attempts', async () => {
    const id = await conceptId('Tokenization')
    await recordAttempt(TEST_USER, id, 1)
    const result = await recordAttempt(TEST_USER, id, 1)
    expect(result.status).toBe('MASTERED')
  })

  it('sets NEEDS_REVIEW after a failed attempt', async () => {
    const id = await conceptId('Tokenization')
    const result = await recordAttempt(TEST_USER, id, 0)
    expect(result.status).toBe('NEEDS_REVIEW')
  })

  it('accumulates attempt counts across calls', async () => {
    const id = await conceptId('Tokenization')
    await recordAttempt(TEST_USER, id, 1)
    await recordAttempt(TEST_USER, id, 0)
    const result = await recordAttempt(TEST_USER, id, 1)
    expect(result.attemptCount).toBe(3)
    expect(result.correctCount).toBe(2)
    expect(result.incorrectCount).toBe(1)
  })

  it('stamps lastAssessmentAt', async () => {
    const id = await conceptId('Tokenization')
    const result = await recordAttempt(TEST_USER, id, 1)
    expect(result.lastAssessmentAt).toBeInstanceOf(Date)
  })
})

describe('listMasteryForCourse', () => {
  it('returns only concepts the learner has attempted', async () => {
    const id = await conceptId('Tokenization')
    await recordAttempt(TEST_USER, id, 1)
    const rows = await listMasteryForCourse(TEST_USER, 'generative-ai')
    expect(rows).toHaveLength(1)
    expect(rows[0].conceptName).toBe('Tokenization')
  })

  it('returns an empty array for an untouched course', async () => {
    await expect(
      listMasteryForCourse(TEST_USER, 'ai-agents'),
    ).resolves.toEqual([])
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm test tests/repositories/mastery.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `lib/repositories/mastery.ts`**

```ts
import prisma from '@/lib/prisma'
import { applyAttempt, masteryStatusFor, type MasteryState } from '@/lib/mastery'
import type { MasteryStatus } from '@/lib/schemas/common'

export type MasteryRecord = MasteryState & {
  conceptId: string
  status: MasteryStatus
  lastAssessmentAt: Date | null
}

export type MasteryWithConcept = MasteryRecord & {
  conceptName: string
}

export async function getMastery(
  userId: string,
  conceptId: string,
): Promise<MasteryRecord | null> {
  const row = await prisma.mastery.findUnique({
    where: { userId_conceptId: { userId, conceptId } },
  })
  if (!row) return null

  return {
    conceptId: row.conceptId,
    masteryScore: row.masteryScore,
    confidenceScore: row.confidenceScore,
    attemptCount: row.attemptCount,
    correctCount: row.correctCount,
    incorrectCount: row.incorrectCount,
    status: row.status,
    lastAssessmentAt: row.lastAssessmentAt,
  }
}

export async function recordAttempt(
  userId: string,
  conceptId: string,
  attemptScore: number,
): Promise<MasteryRecord> {
  const existing = await getMastery(userId, conceptId)

  const previous: MasteryState = existing ?? {
    masteryScore: 0,
    confidenceScore: 0,
    attemptCount: 0,
    correctCount: 0,
    incorrectCount: 0,
  }

  const next = applyAttempt(previous, attemptScore)
  const status = masteryStatusFor(next.masteryScore, next.attemptCount)
  const now = new Date()

  const row = await prisma.mastery.upsert({
    where: { userId_conceptId: { userId, conceptId } },
    create: {
      userId,
      conceptId,
      ...next,
      status,
      lastAssessmentAt: now,
      lastInteractionAt: now,
    },
    update: {
      ...next,
      status,
      lastAssessmentAt: now,
      lastInteractionAt: now,
    },
  })

  return {
    conceptId: row.conceptId,
    masteryScore: row.masteryScore,
    confidenceScore: row.confidenceScore,
    attemptCount: row.attemptCount,
    correctCount: row.correctCount,
    incorrectCount: row.incorrectCount,
    status: row.status,
    lastAssessmentAt: row.lastAssessmentAt,
  }
}

export async function listMasteryForCourse(
  userId: string,
  courseSlug: string,
): Promise<MasteryWithConcept[]> {
  const rows = await prisma.mastery.findMany({
    where: { userId, concept: { course: { slug: courseSlug } } },
    include: { concept: { select: { name: true } } },
    orderBy: { lastInteractionAt: 'desc' },
  })

  return rows.map((row) => ({
    conceptId: row.conceptId,
    conceptName: row.concept.name,
    masteryScore: row.masteryScore,
    confidenceScore: row.confidenceScore,
    attemptCount: row.attemptCount,
    correctCount: row.correctCount,
    incorrectCount: row.incorrectCount,
    status: row.status,
    lastAssessmentAt: row.lastAssessmentAt,
  }))
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npm test tests/repositories/mastery.test.ts`
Expected: PASS — `9 passed`.

- [ ] **Step 5: Commit**

```bash
git add lib/repositories/mastery.ts tests/repositories/mastery.test.ts
git commit -m "feat(mastery): add mastery repository with attempt recording"
```

---

## Task 6: Assessment repository

**Files:**
- Create: `lib/repositories/assessment.ts`
- Test: `tests/repositories/assessment.test.ts`

Until Phase 8 adds real auth, a single demo user stands in. It is created here and reused by every later phase.

- [ ] **Step 1: Write the failing test**

Create `tests/repositories/assessment.test.ts`:

```ts
import { afterEach, describe, expect, it } from 'vitest'
import prisma from '@/lib/prisma'
import {
  createAssessment,
  ensureDemoUser,
  findAssessment,
  saveAnswers,
} from '@/lib/repositories/assessment'

async function topicId() {
  const topic = await prisma.topic.findFirstOrThrow({
    where: { title: 'Text Representation' },
  })
  return topic.id
}

async function conceptIdByName(name: string) {
  const concept = await prisma.concept.findFirstOrThrow({ where: { name } })
  return concept.id
}

afterEach(async () => {
  const user = await ensureDemoUser()
  await prisma.assessment.deleteMany({ where: { userId: user.id } })
})

describe('ensureDemoUser', () => {
  it('creates the demo user when absent', async () => {
    const user = await ensureDemoUser()
    expect(user.email).toBe('demo@adaptive.local')
  })

  it('is idempotent', async () => {
    const first = await ensureDemoUser()
    const second = await ensureDemoUser()
    expect(second.id).toBe(first.id)
  })
})

describe('createAssessment', () => {
  it('persists the assessment with its questions', async () => {
    const user = await ensureDemoUser()
    const assessment = await createAssessment({
      userId: user.id,
      topicId: await topicId(),
      questions: [
        {
          conceptId: await conceptIdByName('Tokenization'),
          type: 'MCQ',
          prompt: 'What is a token?',
          options: ['A subword unit', 'A whole word'],
          correctAnswer: 'A subword unit',
          explanation: 'Subword units.',
          difficulty: 'BEGINNER',
        },
      ],
    })
    expect(assessment.questions).toHaveLength(1)
    expect(assessment.questions[0].prompt).toBe('What is a token?')
  })

  it('orders questions as given', async () => {
    const user = await ensureDemoUser()
    const cid = await conceptIdByName('Tokenization')
    const assessment = await createAssessment({
      userId: user.id,
      topicId: await topicId(),
      questions: [
        { conceptId: cid, type: 'MCQ', prompt: 'first', options: ['a', 'b'], correctAnswer: 'a', explanation: 'e', difficulty: 'BEGINNER' },
        { conceptId: cid, type: 'MCQ', prompt: 'second', options: ['a', 'b'], correctAnswer: 'a', explanation: 'e', difficulty: 'BEGINNER' },
      ],
    })
    expect(assessment.questions.map((q) => q.prompt)).toEqual(['first', 'second'])
  })
})

describe('findAssessment', () => {
  it('returns the assessment without leaking correct answers', async () => {
    const user = await ensureDemoUser()
    const created = await createAssessment({
      userId: user.id,
      topicId: await topicId(),
      questions: [
        {
          conceptId: await conceptIdByName('Tokenization'),
          type: 'MCQ',
          prompt: 'What is a token?',
          options: ['A subword unit', 'A whole word'],
          correctAnswer: 'A subword unit',
          explanation: 'Subword units.',
          difficulty: 'BEGINNER',
        },
      ],
    })

    const found = await findAssessment(created.id)
    expect(found).not.toBeNull()
    expect(found!.questions[0]).not.toHaveProperty('correctAnswer')
    expect(found!.questions[0]).not.toHaveProperty('explanation')
  })

  it('returns null for an unknown id', async () => {
    await expect(findAssessment('nope')).resolves.toBeNull()
  })
})

describe('saveAnswers', () => {
  it('persists answers and the overall score', async () => {
    const user = await ensureDemoUser()
    const created = await createAssessment({
      userId: user.id,
      topicId: await topicId(),
      questions: [
        {
          conceptId: await conceptIdByName('Tokenization'),
          type: 'MCQ',
          prompt: 'q',
          options: ['a', 'b'],
          correctAnswer: 'a',
          explanation: 'e',
          difficulty: 'BEGINNER',
        },
      ],
    })

    await saveAnswers(created.id, 75, [
      {
        questionId: created.questions[0].id,
        response: 'a',
        isCorrect: true,
        score: 1,
        feedback: 'Correct.',
      },
    ])

    const row = await prisma.assessment.findUniqueOrThrow({
      where: { id: created.id },
      include: { answers: true },
    })
    expect(row.score).toBe(75)
    expect(row.submittedAt).not.toBeNull()
    expect(row.answers).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm test tests/repositories/assessment.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `lib/repositories/assessment.ts`**

```ts
import prisma from '@/lib/prisma'
import { readStringArray, writeStringArray } from '@/lib/json-array'
import type { Difficulty } from '@/lib/schemas/common'
import type { QuestionDto } from '@/lib/schemas/assessment'

const DEMO_EMAIL = 'demo@adaptive.local'

/**
 * Stand-in learner until Phase 8 introduces real auth.
 * Every phase before that reads and writes against this user.
 */
export async function ensureDemoUser() {
  return prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    create: {
      email: DEMO_EMAIL,
      passwordHash: 'unset',
      name: 'Demo Learner',
    },
    update: {},
  })
}

export type NewQuestion = {
  conceptId: string
  type: 'MCQ' | 'SHORT_ANSWER' | 'SCENARIO'
  prompt: string
  options: string[]
  correctAnswer: string
  explanation: string
  difficulty: Difficulty
}

export type StoredAssessment = {
  id: string
  topicTitle: string | null
  courseSlug: string | null
  score: number | null
  submittedAt: string | null
  questions: QuestionDto[]
}

export async function createAssessment(input: {
  userId: string
  topicId: string
  questions: NewQuestion[]
}): Promise<StoredAssessment> {
  const topic = await prisma.topic.findUnique({
    where: { id: input.topicId },
    select: {
      module: { select: { courseId: true } },
    },
  })

  const assessment = await prisma.assessment.create({
    data: {
      userId: input.userId,
      topicId: input.topicId,
      courseId: topic?.module.courseId ?? null,
      kind: 'practice',
      questions: {
        create: input.questions.map((q, index) => ({
          conceptId: q.conceptId,
          type: q.type,
          prompt: q.prompt,
          options: writeStringArray(q.options),
          correctAnswer: q.correctAnswer,
          explanation: q.explanation,
          difficulty: q.difficulty,
          order: index,
        })),
      },
    },
  })

  const found = await findAssessment(assessment.id)
  if (!found) throw new Error('Assessment vanished immediately after creation')
  return found
}

/** Never returns correctAnswer or explanation — those must not reach the client before submission. */
export async function findAssessment(
  id: string,
): Promise<StoredAssessment | null> {
  const row = await prisma.assessment.findUnique({
    where: { id },
    include: {
      questions: {
        orderBy: { order: 'asc' },
        include: { concept: { select: { name: true } } },
      },
    },
  })
  if (!row) return null

  const topic = row.topicId
    ? await prisma.topic.findUnique({
        where: { id: row.topicId },
        select: {
          title: true,
          module: { select: { course: { select: { slug: true } } } },
        },
      })
    : null

  return {
    id: row.id,
    topicTitle: topic?.title ?? null,
    courseSlug: topic?.module.course.slug ?? null,
    score: row.score,
    submittedAt: row.submittedAt?.toISOString() ?? null,
    questions: row.questions.map((q) => ({
      id: q.id,
      conceptId: q.conceptId,
      conceptName: q.concept.name,
      type: q.type,
      prompt: q.prompt,
      options: readStringArray(q.options),
      difficulty: q.difficulty,
      order: q.order,
    })),
  }
}

/** Full question rows including the answer key — server-side grading only. */
export async function findQuestionsForGrading(assessmentId: string) {
  const rows = await prisma.question.findMany({
    where: { assessmentId },
    include: { concept: { select: { id: true, name: true, definition: true } } },
    orderBy: { order: 'asc' },
  })
  return rows.map((q) => ({
    id: q.id,
    type: q.type,
    prompt: q.prompt,
    correctAnswer: q.correctAnswer,
    explanation: q.explanation,
    conceptId: q.concept.id,
    conceptName: q.concept.name,
    conceptDefinition: q.concept.definition,
  }))
}

export async function saveAnswers(
  assessmentId: string,
  score: number,
  answers: {
    questionId: string
    response: string
    isCorrect: boolean
    score: number
    feedback: string
  }[],
): Promise<void> {
  await prisma.$transaction([
    prisma.answer.deleteMany({ where: { assessmentId } }),
    prisma.answer.createMany({
      data: answers.map((a) => ({ assessmentId, ...a })),
    }),
    prisma.assessment.update({
      where: { id: assessmentId },
      data: { score, submittedAt: new Date() },
    }),
  ])
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npm test tests/repositories/assessment.test.ts`
Expected: PASS — `7 passed`.

- [ ] **Step 5: Commit**

```bash
git add lib/repositories/assessment.ts tests/repositories/assessment.test.ts
git commit -m "feat(assessment): add assessment repository with answer-key isolation"
```

---

## Task 7: Grading service

This is where the three pieces — deterministic MCQ, semantic short answer, mastery update — come together.

**Files:**
- Create: `lib/assessment-service.ts`
- Test: `tests/lib/assessment-service.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/lib/assessment-service.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const findQuestionsForGrading = vi.fn()
const saveAnswers = vi.fn()
const recordAttempt = vi.fn()
const evaluateShortAnswer = vi.fn()

vi.mock('@/lib/repositories/assessment', () => ({
  findQuestionsForGrading,
  saveAnswers,
}))
vi.mock('@/lib/repositories/mastery', () => ({ recordAttempt }))
vi.mock('@/lib/ai/assessment', () => ({ evaluateShortAnswer }))

const mcqQuestion = {
  id: 'q1',
  type: 'MCQ' as const,
  prompt: 'What is a token?',
  correctAnswer: 'A subword unit',
  explanation: 'Subword units.',
  conceptId: 'c1',
  conceptName: 'Tokenization',
  conceptDefinition: 'Splitting text.',
}

const shortQuestion = {
  id: 'q2',
  type: 'SHORT_ANSWER' as const,
  prompt: 'Why subwords?',
  correctAnswer: 'Coverage and size.',
  explanation: 'Both matter.',
  conceptId: 'c1',
  conceptName: 'Tokenization',
  conceptDefinition: 'Splitting text.',
}

beforeEach(() => {
  vi.clearAllMocks()
  recordAttempt.mockResolvedValue({ masteryScore: 100, status: 'PRACTICING' })
})

describe('gradeSubmission', () => {
  it('grades a correct MCQ without calling the model', async () => {
    findQuestionsForGrading.mockResolvedValue([mcqQuestion])
    const { gradeSubmission } = await import('@/lib/assessment-service')
    const result = await gradeSubmission('a1', 'u1', [
      { questionId: 'q1', response: 'A subword unit' },
    ])
    expect(result.results[0].isCorrect).toBe(true)
    expect(result.results[0].score).toBe(1)
    expect(evaluateShortAnswer).not.toHaveBeenCalled()
  })

  it('grades an incorrect MCQ', async () => {
    findQuestionsForGrading.mockResolvedValue([mcqQuestion])
    const { gradeSubmission } = await import('@/lib/assessment-service')
    const result = await gradeSubmission('a1', 'u1', [
      { questionId: 'q1', response: 'A whole word' },
    ])
    expect(result.results[0].isCorrect).toBe(false)
  })

  it('returns the correct answer and explanation after grading', async () => {
    findQuestionsForGrading.mockResolvedValue([mcqQuestion])
    const { gradeSubmission } = await import('@/lib/assessment-service')
    const result = await gradeSubmission('a1', 'u1', [
      { questionId: 'q1', response: 'A whole word' },
    ])
    expect(result.results[0].correctAnswer).toBe('A subword unit')
    expect(result.results[0].explanation).toBe('Subword units.')
  })

  it('sends short answers to the model', async () => {
    findQuestionsForGrading.mockResolvedValue([shortQuestion])
    evaluateShortAnswer.mockResolvedValue({
      correctness: 0.75,
      understoodConcepts: [],
      misunderstoodConcepts: [],
      missingPoints: [],
      feedback: 'Close.',
    })
    const { gradeSubmission } = await import('@/lib/assessment-service')
    const result = await gradeSubmission('a1', 'u1', [
      { questionId: 'q2', response: 'Rare words still work.' },
    ])
    expect(evaluateShortAnswer).toHaveBeenCalledOnce()
    expect(result.results[0].score).toBe(0.75)
    expect(result.results[0].isCorrect).toBe(true)
  })

  it('computes the overall score as a percentage', async () => {
    findQuestionsForGrading.mockResolvedValue([mcqQuestion, shortQuestion])
    evaluateShortAnswer.mockResolvedValue({
      correctness: 0.5,
      understoodConcepts: [],
      misunderstoodConcepts: [],
      missingPoints: [],
      feedback: 'Partial.',
    })
    const { gradeSubmission } = await import('@/lib/assessment-service')
    const result = await gradeSubmission('a1', 'u1', [
      { questionId: 'q1', response: 'A subword unit' },
      { questionId: 'q2', response: 'something' },
    ])
    expect(result.score).toBe(75)
  })

  it('records one mastery attempt per concept, averaging its questions', async () => {
    findQuestionsForGrading.mockResolvedValue([mcqQuestion, shortQuestion])
    evaluateShortAnswer.mockResolvedValue({
      correctness: 0.5,
      understoodConcepts: [],
      misunderstoodConcepts: [],
      missingPoints: [],
      feedback: 'Partial.',
    })
    const { gradeSubmission } = await import('@/lib/assessment-service')
    await gradeSubmission('a1', 'u1', [
      { questionId: 'q1', response: 'A subword unit' },
      { questionId: 'q2', response: 'something' },
    ])
    expect(recordAttempt).toHaveBeenCalledTimes(1)
    expect(recordAttempt).toHaveBeenCalledWith('u1', 'c1', 0.75)
  })

  it('persists the answers', async () => {
    findQuestionsForGrading.mockResolvedValue([mcqQuestion])
    const { gradeSubmission } = await import('@/lib/assessment-service')
    await gradeSubmission('a1', 'u1', [
      { questionId: 'q1', response: 'A subword unit' },
    ])
    expect(saveAnswers).toHaveBeenCalledWith('a1', 100, expect.any(Array))
  })

  it('scores an unanswered question as zero', async () => {
    findQuestionsForGrading.mockResolvedValue([mcqQuestion])
    const { gradeSubmission } = await import('@/lib/assessment-service')
    const result = await gradeSubmission('a1', 'u1', [])
    expect(result.results[0].score).toBe(0)
    expect(result.score).toBe(0)
  })

  it('throws NOT_FOUND when the assessment has no questions', async () => {
    findQuestionsForGrading.mockResolvedValue([])
    const { gradeSubmission } = await import('@/lib/assessment-service')
    await expect(gradeSubmission('a1', 'u1', [])).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm test tests/lib/assessment-service.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `lib/assessment-service.ts`**

```ts
import { ApiError } from '@/lib/api'
import { gradeMcq } from '@/lib/grading'
import { evaluateShortAnswer } from '@/lib/ai/assessment'
import {
  findQuestionsForGrading,
  saveAnswers,
} from '@/lib/repositories/assessment'
import { recordAttempt } from '@/lib/repositories/mastery'

export type QuestionResult = {
  questionId: string
  conceptId: string
  conceptName: string
  response: string
  isCorrect: boolean
  score: number
  correctAnswer: string
  explanation: string
  feedback: string
}

export type GradedSubmission = {
  score: number
  results: QuestionResult[]
}

export async function gradeSubmission(
  assessmentId: string,
  userId: string,
  responses: { questionId: string; response: string }[],
): Promise<GradedSubmission> {
  const questions = await findQuestionsForGrading(assessmentId)
  if (questions.length === 0) {
    throw new ApiError('NOT_FOUND', 'Assessment has no questions', 404)
  }

  const responseByQuestion = new Map(
    responses.map((r) => [r.questionId, r.response]),
  )

  const results: QuestionResult[] = []

  for (const question of questions) {
    const response = responseByQuestion.get(question.id) ?? ''

    let score: number
    let feedback: string

    if (question.type === 'MCQ') {
      const graded = gradeMcq(response, question.correctAnswer)
      score = graded.score
      feedback = graded.isCorrect ? 'Correct.' : question.explanation
    } else {
      const evaluation = await evaluateShortAnswer({
        conceptName: question.conceptName,
        conceptDefinition: question.conceptDefinition,
        question: question.prompt,
        modelAnswer: question.correctAnswer,
        learnerAnswer: response,
      })
      score = evaluation.correctness
      feedback = evaluation.feedback
    }

    results.push({
      questionId: question.id,
      conceptId: question.conceptId,
      conceptName: question.conceptName,
      response,
      isCorrect: score > 0.5,
      score,
      correctAnswer: question.correctAnswer,
      explanation: question.explanation,
      feedback,
    })
  }

  const totalScore = results.reduce((sum, r) => sum + r.score, 0)
  const score = Math.round((totalScore / results.length) * 100)

  await saveAnswers(
    assessmentId,
    score,
    results.map((r) => ({
      questionId: r.questionId,
      response: r.response,
      isCorrect: r.isCorrect,
      score: r.score,
      feedback: r.feedback,
    })),
  )

  // One mastery attempt per concept, averaged across that concept's questions.
  const byConcept = new Map<string, number[]>()
  for (const result of results) {
    const bucket = byConcept.get(result.conceptId)
    if (bucket) {
      bucket.push(result.score)
    } else {
      byConcept.set(result.conceptId, [result.score])
    }
  }

  for (const [conceptId, scores] of byConcept) {
    const average = scores.reduce((a, b) => a + b, 0) / scores.length
    await recordAttempt(userId, conceptId, average)
  }

  return { score, results }
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npm test tests/lib/assessment-service.test.ts`
Expected: PASS — `9 passed`.

- [ ] **Step 5: Commit**

```bash
git add lib/assessment-service.ts tests/lib/assessment-service.test.ts
git commit -m "feat(assessment): add grading service that updates mastery"
```

---

## Task 8: Assessment endpoints

**Files:**
- Create: `app/api/assessments/generate/route.ts`
- Create: `app/api/assessments/[id]/route.ts`
- Create: `app/api/assessments/[id]/submit/route.ts`
- Test: `tests/api/assessments.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/api/assessments.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const generateQuestions = vi.fn()
const createAssessment = vi.fn()
const findAssessment = vi.fn()
const ensureDemoUser = vi.fn()
const gradeSubmission = vi.fn()
const findTopicWithConcepts = vi.fn()

vi.mock('@/lib/ai/assessment', () => ({ generateQuestions }))
vi.mock('@/lib/repositories/assessment', () => ({
  createAssessment,
  findAssessment,
  ensureDemoUser,
}))
vi.mock('@/lib/assessment-service', () => ({ gradeSubmission }))
vi.mock('@/lib/repositories/concept', () => ({ findTopicWithConcepts }))

function post(body: unknown) {
  return new Request('http://t/api', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  ensureDemoUser.mockResolvedValue({ id: 'u1' })
})

describe('POST /api/assessments/generate', () => {
  it('creates an assessment from generated questions', async () => {
    findTopicWithConcepts.mockResolvedValue({
      id: 't1',
      title: 'Text Representation',
      courseTitle: 'Generative AI Foundations',
      concepts: [{ id: 'c1', name: 'Tokenization', definition: 'd' }],
    })
    generateQuestions.mockResolvedValue({
      questions: [
        {
          type: 'MCQ',
          prompt: 'q',
          options: ['a', 'b'],
          correctAnswer: 'a',
          explanation: 'e',
          conceptName: 'Tokenization',
          difficulty: 'BEGINNER',
        },
      ],
    })
    createAssessment.mockResolvedValue({ id: 'a1', questions: [] })

    const { POST } = await import('@/app/api/assessments/generate/route')
    const res = await POST(post({ topicId: 't1' }))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.data.id).toBe('a1')
  })

  it('returns 404 for an unknown topic', async () => {
    findTopicWithConcepts.mockResolvedValue(null)
    const { POST } = await import('@/app/api/assessments/generate/route')
    const res = await POST(post({ topicId: 'nope' }))
    expect(res.status).toBe(404)
  })

  it('rejects a missing topicId with 400', async () => {
    const { POST } = await import('@/app/api/assessments/generate/route')
    const res = await POST(post({}))
    expect(res.status).toBe(400)
  })

  it('drops generated questions that name an unknown concept', async () => {
    findTopicWithConcepts.mockResolvedValue({
      id: 't1',
      title: 'T',
      courseTitle: 'C',
      concepts: [{ id: 'c1', name: 'Tokenization', definition: 'd' }],
    })
    generateQuestions.mockResolvedValue({
      questions: [
        { type: 'MCQ', prompt: 'keep', options: ['a', 'b'], correctAnswer: 'a', explanation: 'e', conceptName: 'Tokenization', difficulty: 'BEGINNER' },
        { type: 'MCQ', prompt: 'drop', options: ['a', 'b'], correctAnswer: 'a', explanation: 'e', conceptName: 'Nonexistent', difficulty: 'BEGINNER' },
      ],
    })
    createAssessment.mockResolvedValue({ id: 'a1', questions: [] })

    const { POST } = await import('@/app/api/assessments/generate/route')
    await POST(post({ topicId: 't1' }))

    const { questions } = createAssessment.mock.calls[0][0]
    expect(questions).toHaveLength(1)
    expect(questions[0].prompt).toBe('keep')
  })
})

describe('GET /api/assessments/[id]', () => {
  it('returns the assessment', async () => {
    findAssessment.mockResolvedValue({ id: 'a1', questions: [] })
    const { GET } = await import('@/app/api/assessments/[id]/route')
    const res = await GET(new Request('http://t'), {
      params: Promise.resolve({ id: 'a1' }),
    })
    expect(res.status).toBe(200)
  })

  it('returns 404 for an unknown id', async () => {
    findAssessment.mockResolvedValue(null)
    const { GET } = await import('@/app/api/assessments/[id]/route')
    const res = await GET(new Request('http://t'), {
      params: Promise.resolve({ id: 'nope' }),
    })
    expect(res.status).toBe(404)
  })
})

describe('POST /api/assessments/[id]/submit', () => {
  it('returns the graded result', async () => {
    gradeSubmission.mockResolvedValue({ score: 100, results: [] })
    const { POST } = await import('@/app/api/assessments/[id]/submit/route')
    const res = await POST(
      post({ responses: [{ questionId: 'q1', response: 'a' }] }),
      { params: Promise.resolve({ id: 'a1' }) },
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.score).toBe(100)
  })

  it('rejects an empty responses array with 400', async () => {
    const { POST } = await import('@/app/api/assessments/[id]/submit/route')
    const res = await POST(post({ responses: [] }), {
      params: Promise.resolve({ id: 'a1' }),
    })
    expect(res.status).toBe(400)
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm test tests/api/assessments.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `app/api/assessments/generate/route.ts`**

The model is asked to tag each question with a concept name; the server maps those names back to real ids and discards anything it cannot resolve. This is the validation boundary between model output and the database.

```ts
import { z } from 'zod'
import { ApiError, handle, ok, parseJson } from '@/lib/api'
import { generateQuestions } from '@/lib/ai/assessment'
import {
  createAssessment,
  ensureDemoUser,
  type NewQuestion,
} from '@/lib/repositories/assessment'
import { findTopicWithConcepts } from '@/lib/repositories/concept'

const bodySchema = z.object({
  topicId: z.string().min(1),
  questionCount: z.number().int().min(1).max(10).default(5),
})

export async function POST(request: Request) {
  return handle(async () => {
    const { topicId, questionCount } = await parseJson(request, bodySchema)

    const topic = await findTopicWithConcepts(topicId)
    if (!topic) {
      throw new ApiError('NOT_FOUND', `No topic with id "${topicId}"`, 404)
    }

    const quiz = await generateQuestions({
      courseTitle: topic.courseTitle,
      topicTitle: topic.title,
      concepts: topic.concepts.map((c) => ({
        name: c.name,
        definition: c.definition,
      })),
      questionCount,
    })

    const conceptIdByName = new Map(topic.concepts.map((c) => [c.name, c.id]))

    const questions: NewQuestion[] = []
    for (const q of quiz.questions) {
      const conceptId = conceptIdByName.get(q.conceptName)
      if (!conceptId) {
        console.warn(`Dropping question for unknown concept "${q.conceptName}"`)
        continue
      }
      questions.push({
        conceptId,
        type: q.type,
        prompt: q.prompt,
        options: q.options,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
        difficulty: q.difficulty,
      })
    }

    if (questions.length === 0) {
      throw new ApiError(
        'AI_INVALID_RESPONSE',
        'The generated questions did not match any concept in this topic. Try again.',
        502,
      )
    }

    const user = await ensureDemoUser()
    const assessment = await createAssessment({
      userId: user.id,
      topicId,
      questions,
    })

    return ok(assessment, 201)
  })
}
```

- [ ] **Step 4: Create `app/api/assessments/[id]/route.ts`**

```ts
import { ApiError, handle, ok } from '@/lib/api'
import { findAssessment } from '@/lib/repositories/assessment'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const { id } = await params
    const assessment = await findAssessment(id)
    if (!assessment) {
      throw new ApiError('NOT_FOUND', `No assessment with id "${id}"`, 404)
    }
    return ok(assessment)
  })
}
```

- [ ] **Step 5: Create `app/api/assessments/[id]/submit/route.ts`**

```ts
import { handle, ok, parseJson } from '@/lib/api'
import { submissionSchema } from '@/lib/schemas/assessment'
import { gradeSubmission } from '@/lib/assessment-service'
import { ensureDemoUser } from '@/lib/repositories/assessment'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const { id } = await params
    const { responses } = await parseJson(request, submissionSchema)
    const user = await ensureDemoUser()
    const result = await gradeSubmission(id, user.id, responses)
    return ok(result)
  })
}
```

- [ ] **Step 6: Run the test to confirm it passes**

Run: `npm test tests/api/assessments.test.ts`
Expected: PASS — `8 passed`.

- [ ] **Step 7: Commit**

```bash
git add app/api/assessments tests/api/assessments.test.ts
git commit -m "feat(api): add assessment generate, fetch and submit endpoints"
```

---

## Task 9: Question card

**Files:**
- Create: `components/question-card.tsx`
- Test: `tests/components/question-card.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/components/question-card.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { QuestionCard } from '@/components/question-card'
import type { QuestionDto } from '@/lib/schemas/assessment'

const mcq: QuestionDto = {
  id: 'q1',
  conceptId: 'c1',
  conceptName: 'Tokenization',
  type: 'MCQ',
  prompt: 'What is a token?',
  options: ['A subword unit', 'A whole word'],
  difficulty: 'BEGINNER',
  order: 0,
}

const short: QuestionDto = {
  ...mcq,
  id: 'q2',
  type: 'SHORT_ANSWER',
  prompt: 'Why subwords?',
  options: [],
}

describe('QuestionCard', () => {
  it('renders the prompt', () => {
    render(
      <QuestionCard question={mcq} index={0} value="" onChange={() => {}} />,
    )
    expect(screen.getByText('What is a token?')).toBeInTheDocument()
  })

  it('renders the question number', () => {
    render(
      <QuestionCard question={mcq} index={2} value="" onChange={() => {}} />,
    )
    expect(screen.getByText('Question 3')).toBeInTheDocument()
  })

  it('renders the concept name as a badge', () => {
    render(
      <QuestionCard question={mcq} index={0} value="" onChange={() => {}} />,
    )
    expect(screen.getByText('Tokenization')).toBeInTheDocument()
  })

  it('renders one radio per MCQ option', () => {
    render(
      <QuestionCard question={mcq} index={0} value="" onChange={() => {}} />,
    )
    expect(screen.getAllByRole('radio')).toHaveLength(2)
  })

  it('calls onChange with the chosen option', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(
      <QuestionCard question={mcq} index={0} value="" onChange={onChange} />,
    )
    await user.click(screen.getByLabelText('A subword unit'))
    expect(onChange).toHaveBeenCalledWith('A subword unit')
  })

  it('renders a textarea for a short answer question', () => {
    render(
      <QuestionCard question={short} index={0} value="" onChange={() => {}} />,
    )
    expect(screen.getByRole('textbox')).toBeInTheDocument()
    expect(screen.queryAllByRole('radio')).toHaveLength(0)
  })

  it('calls onChange as the learner types a short answer', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(
      <QuestionCard question={short} index={0} value="" onChange={onChange} />,
    )
    await user.type(screen.getByRole('textbox'), 'x')
    expect(onChange).toHaveBeenCalledWith('x')
  })
})
```

- [ ] **Step 2: Add the radio group component**

Run: `npx shadcn@latest add radio-group --yes`

- [ ] **Step 3: Run the test to confirm it fails**

Run: `npm test tests/components/question-card.test.tsx`
Expected: FAIL — `Cannot find module '@/components/question-card'`.

- [ ] **Step 4: Create `components/question-card.tsx`**

```tsx
'use client'

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import type { QuestionDto } from '@/lib/schemas/assessment'

export function QuestionCard({
  question,
  index,
  value,
  onChange,
}: {
  question: QuestionDto
  index: number
  value: string
  onChange: (value: string) => void
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Question {index + 1}
          </CardTitle>
          <Badge variant="outline">{question.conceptName}</Badge>
        </div>
        <p className="text-base leading-relaxed">{question.prompt}</p>
      </CardHeader>

      <CardContent>
        {question.type === 'MCQ' ? (
          <RadioGroup value={value} onValueChange={onChange} className="gap-2">
            {question.options.map((option) => (
              <div
                key={option}
                className="flex items-center gap-3 rounded-lg border px-4 py-3 transition-colors hover:bg-accent"
              >
                <RadioGroupItem value={option} id={`${question.id}-${option}`} />
                <Label
                  htmlFor={`${question.id}-${option}`}
                  className="flex-1 cursor-pointer font-normal"
                >
                  {option}
                </Label>
              </div>
            ))}
          </RadioGroup>
        ) : (
          <Textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Write your answer in your own words..."
            rows={4}
            className="resize-none"
          />
        )}
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 5: Run the test to confirm it passes**

Run: `npm test tests/components/question-card.test.tsx`
Expected: PASS — `7 passed`.

- [ ] **Step 6: Commit**

```bash
git add components/question-card.tsx components/ui/radio-group.tsx tests/components/question-card.test.tsx
git commit -m "feat(ui): add question card for mcq and short answer"
```

---

## Task 10: Result view

**Files:**
- Create: `components/assessment-result.tsx`
- Test: `tests/components/assessment-result.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/components/assessment-result.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AssessmentResult } from '@/components/assessment-result'

const results = [
  {
    questionId: 'q1',
    conceptId: 'c1',
    conceptName: 'Tokenization',
    response: 'A subword unit',
    isCorrect: true,
    score: 1,
    correctAnswer: 'A subword unit',
    explanation: 'Tokenizers emit subword units.',
    feedback: 'Correct.',
  },
  {
    questionId: 'q2',
    conceptId: 'c1',
    conceptName: 'Tokenization',
    response: 'Wrong thing',
    isCorrect: false,
    score: 0,
    correctAnswer: 'A subword unit',
    explanation: 'Tokenizers emit subword units.',
    feedback: 'Not quite — reread the definition.',
  },
]

describe('AssessmentResult', () => {
  it('renders the overall score', () => {
    render(<AssessmentResult score={50} results={results} />)
    expect(screen.getByText('50%')).toBeInTheDocument()
  })

  it('renders the correct-count summary', () => {
    render(<AssessmentResult score={50} results={results} />)
    expect(screen.getByText('1 of 2 correct')).toBeInTheDocument()
  })

  it('shows an advance message at 80 and above', () => {
    render(<AssessmentResult score={90} results={results} />)
    expect(screen.getByText(/ready to move on/i)).toBeInTheDocument()
  })

  it('shows a practice message between 50 and 79', () => {
    render(<AssessmentResult score={60} results={results} />)
    expect(screen.getByText(/more practice/i)).toBeInTheDocument()
  })

  it('shows a reteach message below 50', () => {
    render(<AssessmentResult score={30} results={results} />)
    expect(screen.getByText(/revisit/i)).toBeInTheDocument()
  })

  it('renders the learner response for each question', () => {
    render(<AssessmentResult score={50} results={results} />)
    expect(screen.getByText('Wrong thing')).toBeInTheDocument()
  })

  it('renders the correct answer for an incorrect question', () => {
    render(<AssessmentResult score={50} results={results} />)
    expect(screen.getByText('A subword unit')).toBeInTheDocument()
  })

  it('renders the feedback for every question', () => {
    render(<AssessmentResult score={50} results={results} />)
    expect(
      screen.getByText('Not quite — reread the definition.'),
    ).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm test tests/components/assessment-result.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `components/assessment-result.tsx`**

```tsx
import { Check, X } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { recommendationFor } from '@/lib/mastery'
import type { QuestionResult } from '@/lib/assessment-service'

const HEADLINE: Record<ReturnType<typeof recommendationFor>, string> = {
  ADVANCE: 'You are ready to move on',
  PRACTICE: 'Solid start — a little more practice',
  RETEACH: 'Worth a revisit',
}

const SUBLINE: Record<ReturnType<typeof recommendationFor>, string> = {
  ADVANCE: 'You handled these concepts well. The next topic is open.',
  PRACTICE: 'The shape is there. Another pass will lock it in.',
  RETEACH: 'Reread the explanations below, then try again.',
}

export function AssessmentResult({
  score,
  results,
}: {
  score: number
  results: QuestionResult[]
}) {
  const correct = results.filter((r) => r.isCorrect).length
  const recommendation = recommendationFor(score)

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">{HEADLINE[recommendation]}</CardTitle>
          <CardDescription>{SUBLINE[recommendation]}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <span className="text-4xl font-semibold tabular-nums">{score}%</span>
            <span className="text-sm text-muted-foreground">
              {correct} of {results.length} correct
            </span>
          </div>
          <Progress value={score} />
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3">
        {results.map((result, index) => (
          <Card key={result.questionId}>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'flex size-5 items-center justify-center rounded-full',
                      result.isCorrect
                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                        : 'bg-destructive/15 text-destructive',
                    )}
                  >
                    {result.isCorrect ? (
                      <Check data-icon className="size-3" />
                    ) : (
                      <X data-icon className="size-3" />
                    )}
                  </span>
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Question {index + 1}
                  </CardTitle>
                </div>
                <Badge variant="outline">{result.conceptName}</Badge>
              </div>
            </CardHeader>

            <CardContent className="flex flex-col gap-3 text-sm">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Your answer
                </span>
                <p className={cn(!result.response && 'italic text-muted-foreground')}>
                  {result.response || 'No answer given'}
                </p>
              </div>

              {!result.isCorrect && (
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Correct answer
                  </span>
                  <p>{result.correctAnswer}</p>
                </div>
              )}

              <Separator />

              <p className="leading-relaxed text-muted-foreground">
                {result.feedback}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npm test tests/components/assessment-result.test.tsx`
Expected: PASS — `8 passed`.

- [ ] **Step 5: Commit**

```bash
git add components/assessment-result.tsx tests/components/assessment-result.test.tsx
git commit -m "feat(ui): add assessment result view with per-question feedback"
```

---

## Task 11: Assessment runner and page

**Files:**
- Create: `components/assessment-runner.tsx`
- Create: `app/assessment/[id]/page.tsx`
- Create: `components/start-assessment-button.tsx`
- Modify: `app/learn/[slug]/[topicId]/page.tsx`

- [ ] **Step 1: Create `components/assessment-runner.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Spinner } from '@/components/ui/spinner'
import { Progress } from '@/components/ui/progress'
import { QuestionCard } from '@/components/question-card'
import { AssessmentResult } from '@/components/assessment-result'
import { apiFetch } from '@/lib/fetcher'
import type { AssessmentDto } from '@/lib/schemas/assessment'
import type { GradedSubmission } from '@/lib/assessment-service'

export function AssessmentRunner({ assessment }: { assessment: AssessmentDto }) {
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [result, setResult] = useState<GradedSubmission | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const answered = assessment.questions.filter(
    (q) => (answers[q.id] ?? '').trim().length > 0,
  ).length
  const total = assessment.questions.length

  async function submit() {
    setPending(true)
    setError(null)
    try {
      const graded = await apiFetch<GradedSubmission>(
        `/api/assessments/${assessment.id}/submit`,
        {
          method: 'POST',
          json: {
            responses: assessment.questions.map((q) => ({
              questionId: q.id,
              response: answers[q.id] ?? '',
            })),
          },
        },
      )
      setResult(graded)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not submit your answers')
    } finally {
      setPending(false)
    }
  }

  if (result) {
    return <AssessmentResult score={result.score} results={result.results} />
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {answered} of {total} answered
          </span>
          <span className="tabular-nums">
            {Math.round((answered / total) * 100)}%
          </span>
        </div>
        <Progress value={(answered / total) * 100} />
      </div>

      {assessment.questions.map((question, index) => (
        <QuestionCard
          key={question.id}
          question={question}
          index={index}
          value={answers[question.id] ?? ''}
          onChange={(value) =>
            setAnswers((prev) => ({ ...prev, [question.id]: value }))
          }
        />
      ))}

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Button
        onClick={() => void submit()}
        disabled={pending || answered === 0}
        size="lg"
        className="self-start"
      >
        {pending ? <Spinner data-icon /> : <Send data-icon />}
        {pending ? 'Grading your answers' : 'Submit answers'}
      </Button>
    </div>
  )
}
```

- [ ] **Step 2: Create `app/assessment/[id]/page.tsx`**

```tsx
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { AssessmentRunner } from '@/components/assessment-runner'
import { findAssessment } from '@/lib/repositories/assessment'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Assessment — Adaptive',
}

export default async function AssessmentPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const assessment = await findAssessment(id)

  if (!assessment) notFound()

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link href="/explore" />}>Explore</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Assessment</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {assessment.topicTitle ?? 'Practice assessment'}
        </h1>
        <p className="text-sm text-muted-foreground">
          {assessment.questions.length} questions. Short answers are graded on
          understanding, not wording.
        </p>
      </header>

      <AssessmentRunner assessment={assessment} />
    </div>
  )
}
```

- [ ] **Step 3: Create `components/start-assessment-button.tsx`**

```tsx
'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { ClipboardCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/fetcher'

export function StartAssessmentButton({ topicId }: { topicId: string }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)

  async function start() {
    setPending(true)
    try {
      const assessment = await apiFetch<{ id: string }>(
        '/api/assessments/generate',
        { method: 'POST', json: { topicId, questionCount: 5 } },
      )
      router.push(`/assessment/${assessment.id}`)
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : 'Could not create an assessment',
      )
      setPending(false)
    }
  }

  return (
    <Button onClick={() => void start()} disabled={pending} variant="outline">
      {pending ? <Spinner data-icon /> : <ClipboardCheck data-icon />}
      {pending ? 'Writing questions' : 'Test yourself'}
    </Button>
  )
}
```

- [ ] **Step 4: Add the button to the learn page**

In `app/learn/[slug]/[topicId]/page.tsx`, add the import:

```tsx
import { StartAssessmentButton } from '@/components/start-assessment-button'
```

Then replace the closing `</header>` with:

```tsx
        <div className="pt-2">
          <StartAssessmentButton topicId={topic.id} />
        </div>
      </header>
```

- [ ] **Step 5: Smoke-test the full loop**

Run: `npm run dev`, open `/learn/generative-ai/<topicId>`, click **Test yourself**.
Expected: after a few seconds you land on `/assessment/<id>` with 5 questions — a mix of MCQ and short answer, each badged with its concept. Answer them, submit. Grading takes a few seconds (short answers go to the model). You get a score, a recommendation headline, and per-question feedback.

- [ ] **Step 6: Verify mastery was written**

Run: `npx prisma db execute --stdin <<< "SELECT c.name, m.masteryScore, m.status, m.attemptCount FROM Mastery m JOIN Concept c ON c.id = m.conceptId;"`
Expected: one row per concept that appeared in the quiz, with a plausible score and a status other than `NOT_STARTED`.

- [ ] **Step 7: Verify answer keys never reach the client**

In the browser devtools Network tab, inspect the `GET /api/assessments/<id>` response.
Expected: no `correctAnswer` and no `explanation` field on any question.

- [ ] **Step 8: Full verification**

Run: `npm run typecheck && npm run lint && npm test`
Expected: all three exit 0.

- [ ] **Step 9: Commit**

```bash
git add components/assessment-runner.tsx components/start-assessment-button.tsx "app/assessment" "app/learn/[slug]/[topicId]/page.tsx"
git commit -m "feat(assessment): add quiz runner, assessment page and start button"
```

---

## Phase 4 Exit Checklist

- [ ] MCQ grading is deterministic and case/whitespace insensitive
- [ ] Short answers are graded by Gemini with partial credit
- [ ] A blank short answer scores 0 without a model call
- [ ] `correctAnswer` and `explanation` never appear in the pre-submission API response
- [ ] Generated questions naming an unknown concept are dropped, not stored
- [ ] Mastery rows are created and updated, one attempt per concept per submission
- [ ] MASTERED requires at least two attempts
- [ ] Result view shows score, recommendation and per-question feedback
- [ ] `npm run typecheck`, `npm run lint`, `npm test` all exit 0

Update `PROGRESS.md`, then proceed to [`phase-05-materials-rag.md`](./phase-05-materials-rag.md).
