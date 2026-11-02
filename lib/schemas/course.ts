import { z } from 'zod'
import { difficultySchema, idSchema, slugSchema } from './common'

export const courseSummarySchema = z.object({
  id: idSchema,
  slug: slugSchema,
  title: z.string().min(1),
  description: z.string().min(1),
  category: z.string().min(1),
  difficulty: difficultySchema,
  estimatedHours: z.number().int().min(0),
  moduleCount: z.number().int().min(0),
  conceptCount: z.number().int().min(0),
})

export const topicSummarySchema = z.object({
  id: idSchema,
  title: z.string().min(1),
  description: z.string(),
  order: z.number().int().min(0),
  conceptCount: z.number().int().min(0),
})

export const moduleSummarySchema = z.object({
  id: idSchema,
  title: z.string().min(1),
  description: z.string(),
  order: z.number().int().min(0),
  topics: z.array(topicSummarySchema),
})

export const courseDetailSchema = courseSummarySchema.extend({
  modules: z.array(moduleSummarySchema),
})

export type CourseSummary = z.infer<typeof courseSummarySchema>
export type ModuleSummary = z.infer<typeof moduleSummarySchema>
export type TopicSummary = z.infer<typeof topicSummarySchema>
export type CourseDetail = z.infer<typeof courseDetailSchema>
