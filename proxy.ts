import { NextResponse, type NextRequest } from 'next/server'
import { SESSION_COOKIE, verifySession } from '@/lib/auth/session'

/**
 * Routes that require an account.
 *
 * The catalog (`/explore`, `/courses/*`) stays public as a shop window.
 * `/learn` is gated because every visit triggers paid Gemini generation and
 * writes progress against a user.
 */
const PROTECTED_PREFIXES = [
  '/progress',
  '/materials',
  '/profile',
  '/admin',
  '/assessment',
  '/learn',
  '/concept-map',
]

const AUTH_PAGES = ['/login', '/register']

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname
  const token = request.cookies.get(SESSION_COOKIE)?.value
  const session = await verifySession(token)

  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  )

  if (isProtected && !session) {
    const url = new URL('/login', request.nextUrl)
    url.searchParams.set('next', path)
    return NextResponse.redirect(url)
  }

  if (path.startsWith('/admin') && session?.role !== 'ADMIN') {
    return NextResponse.redirect(new URL('/progress', request.nextUrl))
  }

  if (AUTH_PAGES.includes(path) && session) {
    return NextResponse.redirect(new URL('/progress', request.nextUrl))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|svg|ico)$).*)',
  ],
}
