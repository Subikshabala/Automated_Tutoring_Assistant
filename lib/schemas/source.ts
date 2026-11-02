import { z } from 'zod'
import { idSchema } from './common'

export const sourceStatusSchema = z.enum([
  'DRAFT',
  'INGESTED',
  'PROCESSED',
  'IN_REVIEW',
  'APPROVED',
  'PUBLISHED',
  'ARCHIVED',
])

export type SourceStatus = z.infer<typeof sourceStatusSchema>

/**
 * Tier 1 is a primary specification or peer-reviewed paper.
 * Tier 4 is a blog post or forum answer.
 */
export const authorityLevelSchema = z.number().int().min(1).max(4)

export const createSourceSchema = z.object({
  courseId: idSchema.nullable().optional(),
  topicId: idSchema.nullable().optional(),
  title: z.string().min(1).max(200),
  url: z.string().url().nullable().optional(),
  publisher: z.string().max(120).nullable().optional(),
  authorityLevel: authorityLevelSchema.default(4),
  publicationDate: z.string().datetime().nullable().optional(),
  version: z.string().max(40).nullable().optional(),
})

export const updateSourceStatusSchema = z.object({
  status: sourceStatusSchema,
})

const ALLOWED_TRANSITIONS: Record<SourceStatus, SourceStatus[]> = {
  DRAFT: ['INGESTED', 'ARCHIVED'],
  INGESTED: ['PROCESSED', 'ARCHIVED'],
  PROCESSED: ['IN_REVIEW', 'ARCHIVED'],
  IN_REVIEW: ['APPROVED', 'PROCESSED', 'ARCHIVED'],
  APPROVED: ['PUBLISHED', 'IN_REVIEW', 'ARCHIVED'],
  PUBLISHED: ['ARCHIVED', 'IN_REVIEW'],
  ARCHIVED: ['DRAFT'],
}

export function canTransition(from: SourceStatus, to: SourceStatus): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false
}

export function allowedTransitions(from: SourceStatus): SourceStatus[] {
  return ALLOWED_TRANSITIONS[from] ?? []
}
