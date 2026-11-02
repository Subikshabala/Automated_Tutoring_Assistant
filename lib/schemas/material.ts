import { z } from 'zod'
import { idSchema } from './common'

export const materialStatusSchema = z.enum([
  'UPLOADED',
  'PROCESSING',
  'READY',
  'FAILED',
])

export const materialSummarySchema = z.object({
  id: idSchema,
  filename: z.string().min(1),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().min(0),
  status: materialStatusSchema,
  chunkCount: z.number().int().min(0),
  error: z.string().nullable(),
  createdAt: z.string(),
  suggestions: z.string().default(''),
})

export const materialQuerySchema = z.object({
  question: z.string().min(1).max(500),
})

export const groundedAnswerSchema = z.object({
  answer: z.string().min(1),
  foundInMaterial: z.boolean(),
  quotedPassages: z.array(z.string()).default([]),
})

export const suggestedQuestionsSchema = z.object({
  questions: z.array(z.string().min(1)).min(3).max(5),
})

export type SuggestedQuestions = z.infer<typeof suggestedQuestionsSchema>
export type MaterialStatus = z.infer<typeof materialStatusSchema>
export type MaterialSummary = z.infer<typeof materialSummarySchema>
export type GroundedAnswer = z.infer<typeof groundedAnswerSchema>
