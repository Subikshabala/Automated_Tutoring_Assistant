import { handle, ok } from '@/lib/api'
import { requireAdmin } from '@/lib/auth/guard'
import { listCourses } from '@/lib/repositories/course'

export async function GET() {
  return handle(async () => {
    await requireAdmin()
    return ok(await listCourses({}))
  })
}
