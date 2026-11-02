import { handle, ok } from '@/lib/api'
import { getAllCourseProgress } from '@/lib/repositories/progress'
import { requireUser } from '@/lib/auth/guard'

export async function GET() {
  return handle(async () => {
    const user = await requireUser()
    const progress = await getAllCourseProgress(user.id)
    return ok(progress)
  })
}
