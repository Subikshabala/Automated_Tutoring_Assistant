import { z } from 'zod'

export const idSchema = z.string().min(1, 'id is required')

export const slugSchema = z
  .string()
  .min(1)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'must be a lowercase hyphenated slug')

export const difficultySchema = z.enum([
  'BEGINNER',
  'INTERMEDIATE',
  'ADVANCED',
])

export const masteryStatusSchema = z.enum([
  'NOT_STARTED',
  'LEARNING',
  'PRACTICING',
  'MASTERED',
  'NEEDS_REVIEW',
])

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
})

export type Difficulty = z.infer<typeof difficultySchema>
export type MasteryStatus = z.infer<typeof masteryStatusSchema>
export type Pagination = z.infer<typeof paginationSchema>
