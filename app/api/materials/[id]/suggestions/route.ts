import { handle, ok } from '@/lib/api'
import { requireUser } from '@/lib/auth/guard'
import { getSuggestedQuestions } from '@/lib/ai/material'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    await requireUser()
    const { id } = await params
    return ok({ questions: await getSuggestedQuestions(id) })
  })
}
