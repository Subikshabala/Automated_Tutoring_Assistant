import { handle, ok } from '@/lib/api'
import { requireAdmin } from '@/lib/auth/guard'
import { listLearnerOverview } from '@/lib/repositories/admin'

export async function GET() {
  return handle(async () => {
    await requireAdmin()
    return ok(await listLearnerOverview())
  })
}
