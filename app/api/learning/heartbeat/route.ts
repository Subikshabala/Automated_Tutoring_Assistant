import { z } from 'zod'
import { handle, ok, parseJson } from '@/lib/api'
import { requireUser } from '@/lib/auth/guard'
import { idSchema } from '@/lib/schemas/common'
import { recordConceptView, startSession } from '@/lib/repositories/learning'

const bodySchema = z.object({
  topicId: idSchema,
  conceptId: idSchema,
  /** Seconds since the last heartbeat. */
  seconds: z.number().int().min(0).max(300),
})

export async function POST(request: Request) {
  return handle(async () => {
    const user = await requireUser()
    const { topicId, conceptId, seconds } = await parseJson(request, bodySchema)

    await startSession(user.id, topicId)
    if (seconds > 0) {
      await recordConceptView(user.id, conceptId, seconds)
    }

    return ok({ recorded: true })
  })
}
