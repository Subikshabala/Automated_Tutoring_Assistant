'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { ClipboardCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/fetcher'

export function StartAssessmentButton({ topicId }: { topicId: string }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)

  async function start() {
    setPending(true)
    try {
      const assessment = await apiFetch<{ id: string }>(
        '/api/assessments/generate',
        { method: 'POST', json: { topicId, questionCount: 5 } },
      )
      router.push(`/assessment/${assessment.id}`)
    } catch (e) {
      const message =
        e instanceof Error ? e.message : 'Could not create an assessment'
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
    <Button onClick={() => void start()} disabled={pending} variant="outline">
      {pending ? <Spinner data-icon /> : <ClipboardCheck data-icon />}
      {pending ? 'Writing questions' : 'Test yourself'}
    </Button>
  )
}
