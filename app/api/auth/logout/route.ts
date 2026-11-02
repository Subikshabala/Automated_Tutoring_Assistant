import { handle, ok } from '@/lib/api'
import { clearSessionCookie } from '@/lib/auth/session'

export async function POST() {
  return handle(async () => {
    await clearSessionCookie()
    return ok({ signedOut: true })
  })
}
