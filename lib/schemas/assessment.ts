import { z } from 'zod'
import { difficultySchema, idSchema } from './common'

export const questionTypeSchema = z.enum(['MCQ', 'SHORT_ANSWER', 'SCENARIO'])

export const generatedQuestionSchema = z.preprocess(
  (val) => {
    if (!val || typeof val !== 'object') return val
    const q = val as Record<string, unknown>
    if (q.type === 'MCQ' && Array.isArray(q.options) && typeof q.correctAnswer === 'string') {
      const opts = q.options.map((o) => (typeof o === 'string' ? o.trim() : String(o)))
      const ans = q.correctAnswer.trim()
      if (opts.includes(ans)) {
        return { ...q, options: opts, correctAnswer: ans }
      }
      const letterIndex = ['a', 'b', 'c', 'd'].indexOf(ans.toLowerCase().replace(/[^a-d]/g, ''))
      if (letterIndex >= 0 && letterIndex < opts.length && ans.length <= 3) {
        return { ...q, options: opts, correctAnswer: opts[letterIndex] }
      }
      const clean = (s: string) => s.toLowerCase().replace(/[^\w\s]/g, '').trim()
      const found = opts.find((o) => clean(o) === clean(ans))
      if (found) {
        return { ...q, options: opts, correctAnswer: found }
      }
      return { ...q, options: opts, correctAnswer: ans }
    }
    return val
  },
  z
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
    ),
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
  kind: z.string().default('practice'),
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
