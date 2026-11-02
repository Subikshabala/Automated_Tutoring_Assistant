import { ApiError } from '@/lib/api'
import { getSessionUser } from '@/lib/auth/session'
import type { SessionUser } from '@/lib/schemas/auth'

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser()
  if (!user) {
    throw new ApiError('UNAUTHORIZED', 'Sign in to continue', 401)
  }
  return user
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser()
  if (user.role !== 'ADMIN') {
    throw new ApiError('FORBIDDEN', 'Admin access is required', 403)
  }
  return user
}
