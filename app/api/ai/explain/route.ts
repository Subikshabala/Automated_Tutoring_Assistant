import { z } from 'zod'
import { handle, ok, parseJson } from '@/lib/api'
import { explainConcept } from '@/lib/ai/tutor'

const bodySchema = z.object({
  conceptId: z.string().min(1),
  forceRefresh: z.boolean().optional(),
})

export async function POST(request: Request) {
  return handle(async () => {
    const { conceptId, forceRefresh } = await parseJson(request, bodySchema)
    const result = await explainConcept(conceptId, { forceRefresh })
    return ok(result)
  })
}
