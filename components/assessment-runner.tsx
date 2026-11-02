'use client'

import { useState } from 'react'
import { Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Spinner } from '@/components/ui/spinner'
import { Progress } from '@/components/ui/progress'
import { QuestionCard } from '@/components/question-card'
import { AssessmentResult } from '@/components/assessment-result'
import { apiFetch } from '@/lib/fetcher'
import type { AssessmentDto } from '@/lib/schemas/assessment'
import type { GradedSubmission } from '@/lib/assessment-service'

export function AssessmentRunner({ assessment }: { assessment: AssessmentDto }) {
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [result, setResult] = useState<GradedSubmission | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const answered = assessment.questions.filter(
    (q) => (answers[q.id] ?? '').trim().length > 0,
  ).length
  const total = assessment.questions.length

  async function submit() {
    setPending(true)
    setError(null)
    try {
      const graded = await apiFetch<GradedSubmission>(
        `/api/assessments/${assessment.id}/submit`,
        {
          method: 'POST',
          json: {
            responses: assessment.questions.map((q) => ({
              questionId: q.id,
              response: answers[q.id] ?? '',
            })),
          },
        },
      )
      setResult(graded)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not submit your answers')
    } finally {
      setPending(false)
    }
  }

  if (result) {
    return <AssessmentResult score={result.score} results={result.results} kind={assessment.kind as 'practice' | 'diagnostic'} />
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {answered} of {total} answered
          </span>
          <span className="tabular-nums">
            {Math.round((answered / total) * 100)}%
          </span>
        </div>
        <Progress value={(answered / total) * 100} />
      </div>

      {assessment.questions.map((question, index) => (
        <QuestionCard
          key={question.id}
          question={question}
          index={index}
          value={answers[question.id] ?? ''}
          onChange={(value) =>
            setAnswers((prev) => ({ ...prev, [question.id]: value }))
          }
        />
      ))}

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Button
        onClick={() => void submit()}
        disabled={pending || answered === 0}
        size="lg"
        className="self-start"
      >
        {pending ? <Spinner data-icon /> : <Send data-icon />}
        {pending ? 'Grading your answers' : 'Submit answers'}
      </Button>
    </div>
  )
}
