'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Compass, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/fetcher'

export function DiagnosticPrompt({
  courseSlug,
  conceptCount,
}: {
  courseSlug: string
  conceptCount: number
}) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  async function start() {
    setPending(true)
    try {
      const assessment = await apiFetch<{ id: string }>('/api/diagnostic', {
        method: 'POST',
        json: { courseSlug },
      })
      router.push(`/assessment/${assessment.id}`)
    } catch (e) {
      const message =
        e instanceof Error ? e.message : 'Could not start the diagnostic'
      if (
        message.toLowerCase().includes('sign in') ||
        message.toLowerCase().includes('unauthorized')
      ) {
        router.push(
          `/login?next=${encodeURIComponent(typeof window !== 'undefined' ? window.location.pathname : '')}`,
        )
        return
      }
      toast.error(message)
      setPending(false)
    }
  }

  async function skip() {
    setDismissed(true)
    try {
      await apiFetch('/api/diagnostic', {
        method: 'PATCH',
        json: { courseSlug },
      })
      router.refresh()
    } catch {
      // Dismissal is local anyway; a failed persist is not worth surfacing.
    }
  }

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Compass data-icon className="size-5 text-primary" />
        </div>

        <div className="flex flex-1 flex-col gap-1">
          <h3 className="text-sm font-semibold">
            Find out what you already know
          </h3>
          <p className="text-sm text-muted-foreground">
            Seven questions across the {conceptCount} concepts in this course.
            The results decide where you start — no point teaching you things
            you can already do.
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button onClick={() => void start()} disabled={pending}>
            {pending ? <Spinner data-icon /> : <Compass data-icon />}
            {pending ? 'Writing questions' : 'Take it'}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => void skip()}
            aria-label="Skip the diagnostic"
          >
            <X data-icon />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export function DiagnosticButton({
  courseSlug,
  variant = 'outline',
  label = 'Evaluation test',
}: {
  courseSlug: string
  variant?: 'outline' | 'default'
  label?: string
}) {
  const router = useRouter()
  const [pending, setPending] = useState(false)

  async function start() {
    setPending(true)
    try {
      const assessment = await apiFetch<{ id: string }>('/api/diagnostic', {
        method: 'POST',
        json: { courseSlug },
      })
      router.push(`/assessment/${assessment.id}`)
    } catch (e) {
      const message =
        e instanceof Error ? e.message : 'Could not start the diagnostic'
      if (
        message.toLowerCase().includes('sign in') ||
        message.toLowerCase().includes('unauthorized')
      ) {
        router.push(
          `/login?next=${encodeURIComponent(typeof window !== 'undefined' ? window.location.pathname : '')}`,
        )
        return
      }
      toast.error(message)
      setPending(false)
    }
  }

  return (
    <Button
      variant={variant}
      onClick={() => void start()}
      disabled={pending}
    >
      {pending ? <Spinner data-icon /> : <Compass data-icon />}
      {pending ? 'Writing questions' : label}
    </Button>
  )
}

