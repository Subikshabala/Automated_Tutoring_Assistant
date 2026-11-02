import { z } from 'zod'
import { idSchema, slugSchema } from './common'

export const actionSchema = z.enum(['LEARN', 'PRACTISE', 'REVIEW'])

export const situationSchema = z.enum([
  'FIRST_STEP',
  'NEWLY_UNLOCKED',
  'READY',
  'GATEWAY',
  'NEARLY_THERE',
  'SHAKY',
  'BLOCKED_DOWNSTREAM',
  'FOUNDATIONAL_GAP',
])

export const recommendationSchema = z.object({
  conceptId: idSchema,
  conceptName: z.string().min(1),
  courseSlug: slugSchema,
  topicId: idSchema.nullable(),
  action: actionSchema,
  situation: situationSchema,
  reason: z.string().min(1),
  priority: z.number().min(0).max(100),
  masteryScore: z.number().min(0).max(100),
  unlocks: z.array(z.string()).default([]),
  prerequisites: z.array(z.string()).default([]),
})

export const courseProgressSchema = z.object({
  courseSlug: slugSchema,
  courseTitle: z.string().min(1),
  totalConcepts: z.number().int().min(0),
  startedConcepts: z.number().int().min(0),
  masteredConcepts: z.number().int().min(0),
  averageMastery: z.number().min(0).max(100),
  lastActivityAt: z.string().nullable(),
})

export const coachSummarySchema = z.object({
  headline: z.string().min(1),
  body: z.string().min(1),
})

export type LearningAction = z.infer<typeof actionSchema>
export type Recommendation = z.infer<typeof recommendationSchema>
export type CourseProgress = z.infer<typeof courseProgressSchema>
export type CoachSummary = z.infer<typeof coachSummarySchema>
