'use client'

import { useSyncExternalStore } from 'react'
import { Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'

const noopSubscribe = () => () => {}

/**
 * Returns false during server render and the first client render, then true.
 * Avoids a setState-in-effect while still preventing a hydration mismatch.
 */
function useMounted(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  )
}

export function ModeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const mounted = useMounted()

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" aria-label="Toggle theme" disabled>
        <Moon data-icon />
      </Button>
    )
  }

  const isDark = resolvedTheme === 'dark'
  const next = isDark ? 'light' : 'dark'

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(next)}
      aria-label={`Switch to ${next} theme`}
    >
      {isDark ? <Sun data-icon /> : <Moon data-icon />}
    </Button>
  )
}
