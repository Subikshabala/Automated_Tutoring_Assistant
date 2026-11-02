import { handle, ok } from '@/lib/api'
import { requireAdmin } from '@/lib/auth/guard'
import { getPlatformStats } from '@/lib/repositories/admin'

export async function GET() {
  return handle(async () => {
    await requireAdmin()
    return ok(await getPlatformStats())
  })
}
