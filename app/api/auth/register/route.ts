import { handle, ok, parseJson } from '@/lib/api'
import { registerSchema } from '@/lib/schemas/auth'
import { createUser } from '@/lib/repositories/user'
import { setSessionCookie, signSession } from '@/lib/auth/session'

export async function POST(request: Request) {
  return handle(async () => {
    const input = await parseJson(request, registerSchema)
    const user = await createUser(input)
    await setSessionCookie(await signSession(user))
    return ok(user, 201)
  })
}
