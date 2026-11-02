import { handle, ok } from '@/lib/api'
import { getSessionUser } from '@/lib/auth/session'

export async function GET() {
  return handle(async () => {
    return ok(await getSessionUser())
  })
}
