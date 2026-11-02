import { z } from 'zod'
import { difficultySchema, idSchema } from './common'

export const relationshipTypeSchema = z.enum([
  'PREREQUISITE_OF',
  'RELATED_TO',
  'PART_OF',
  'LEADS_TO',
])

export const conceptSchema = z.object({
  id: idSchema,
  courseId: idSchema,
  moduleId: idSchema.nullable().optional(),
  topicId: idSchema.nullable().optional(),
  name: z.string().min(1),
  definition: z.string().min(1),
  difficulty: difficultySchema,
  objectives: z.array(z.string()).default([]),
})

export const conceptRelationshipSchema = z.object({
  id: idSchema,
  fromId: idSchema,
  toId: idSchema,
  type: relationshipTypeSchema,
  strength: z.number().min(0).max(1).default(1),
})

export const conceptGraphSchema = z.object({
  concepts: z.array(conceptSchema),
  relationships: z.array(conceptRelationshipSchema),
})

export type RelationshipType = z.infer<typeof relationshipTypeSchema>
export type ConceptDto = z.infer<typeof conceptSchema>
export type ConceptRelationshipDto = z.infer<typeof conceptRelationshipSchema>
export type ConceptGraph = z.infer<typeof conceptGraphSchema>
