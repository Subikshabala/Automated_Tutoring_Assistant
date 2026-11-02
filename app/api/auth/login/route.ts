import { ApiError, handle, ok, parseJson } from '@/lib/api'
import { loginSchema } from '@/lib/schemas/auth'
import { authenticate } from '@/lib/repositories/user'
import { setSessionCookie, signSession } from '@/lib/auth/session'

export async function POST(request: Request) {
  return handle(async () => {
    const { email, password } = await parseJson(request, loginSchema)
    const user = await authenticate(email, password)

    if (!user) {
      throw new ApiError(
        'INVALID_CREDENTIALS',
        'Those details do not match an account',
        401,
      )
    }

    await setSessionCookie(await signSession(user))
    return ok(user)
  })
}
