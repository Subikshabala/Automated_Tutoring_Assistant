import { z } from 'zod'
import { handle, ok, parseJson } from '@/lib/api'
import { answerQuestion } from '@/lib/ai/tutor'

const bodySchema = z.object({
  conceptId: z.string().min(1),
  question: z.string().min(1).max(1000),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().min(1),
      }),
    )
    .max(20)
    .default([]),
})

export async function POST(request: Request) {
  return handle(async () => {
    const { conceptId, question, history } = await parseJson(request, bodySchema)
    const answer = await answerQuestion(conceptId, question, history)
    return ok(answer)
  })
}
