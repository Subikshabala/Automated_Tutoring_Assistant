'use client'

import { useEffect } from 'react'
import { RotateCcw, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Route error:', error)
  }, [error])

  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <TriangleAlert data-icon />
        </EmptyMedia>
        <EmptyTitle>Something broke</EmptyTitle>
        <EmptyDescription>
          {error.message || 'An unexpected error occurred on this page.'}
          {error.digest && (
            <span className="mt-2 block font-mono text-xs opacity-60">
              {error.digest}
            </span>
          )}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button onClick={reset}>
          <RotateCcw data-icon />
          Try again
        </Button>
      </EmptyContent>
    </Empty>
  )
}
