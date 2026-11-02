import { z } from 'zod'
import { idSchema, slugSchema } from './common'
import { relationshipTypeSchema } from './concept'

export const studentNodeSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1).max(80),
  x: z.number().default(0),
  y: z.number().default(0),
})

export const studentEdgeSchema = z.object({
  id: z.string().min(1),
  fromId: z.string().min(1),
  toId: z.string().min(1),
  type: relationshipTypeSchema.default('RELATED_TO'),
})

export const saveMapSchema = z
  .object({
    id: idSchema.optional(),
    courseSlug: slugSchema,
    title: z.string().min(1).max(120),
    nodes: z.array(studentNodeSchema).min(1).max(60),
    edges: z.array(studentEdgeSchema).max(200).default([]),
  })
  .refine(
    (map) => {
      const ids = new Set(map.nodes.map((n) => n.id))
      return map.edges.every((e) => ids.has(e.fromId) && ids.has(e.toId))
    },
    {
      message: 'Every edge must connect two nodes present in the map',
      path: ['edges'],
    },
  )

export const mapFeedbackSchema = z.object({
  summary: z.string().min(1),
  strengths: z.array(z.string()).default([]),
  gaps: z.array(z.string()).default([]),
  nextStep: z.string().min(1),
})

export type StudentNode = z.infer<typeof studentNodeSchema>
export type StudentEdge = z.infer<typeof studentEdgeSchema>
export type SaveMapInput = z.infer<typeof saveMapSchema>
export type MapFeedback = z.infer<typeof mapFeedbackSchema>
