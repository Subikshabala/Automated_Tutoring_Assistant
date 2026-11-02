'use client'

import { usePathname } from 'next/navigation'

const BARE_ROUTES = ['/', '/login', '/register']

export function ConditionalShell({
  shell,
  children,
}: {
  shell: React.ReactNode
  children: React.ReactNode
}) {
  const pathname = usePathname()
  if (BARE_ROUTES.includes(pathname)) {
    return <>{children}</>
  }
  return <>{shell}</>
}
