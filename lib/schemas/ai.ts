import { z } from 'zod'

export const conceptExplanationSchema = z.object({
  title: z.string().min(1),
  simpleExplanation: z.string().min(1),
  whyItMatters: z.string().min(1),
  example: z.string().min(1),
  keyPoints: z.array(z.string().min(1)).min(2).max(6),
  checkQuestion: z.string().min(1),
})

export const tutorAnswerSchema = z.object({
  answer: z.string().min(1),
  relatedConcepts: z.array(z.string()).default([]),
  followUpQuestion: z.string().nullable().default(null),
})

export type ConceptExplanation = z.infer<typeof conceptExplanationSchema>
export type TutorAnswer = z.infer<typeof tutorAnswerSchema>
