import Link from 'next/link'
import { ArrowRight, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { recommendationFor, type Recommendation } from '@/lib/mastery'
import type { QuestionResult } from '@/lib/assessment-service'

const HEADLINE: Record<Recommendation, string> = {
  ADVANCE: 'You are ready to move on',
  PRACTICE: 'Solid start — a little more practice',
  RETEACH: 'Worth a revisit',
}

const SUBLINE: Record<Recommendation, string> = {
  ADVANCE: 'You handled these concepts well. The next topic is open.',
  PRACTICE: 'The shape is there. Another pass will lock it in.',
  RETEACH: 'Reread the explanations below, then try again.',
}

const DIAGNOSTIC_HEADLINE: Record<Recommendation, string> = {
  ADVANCE: 'You already know most of this',
  PRACTICE: 'A solid starting point',
  RETEACH: 'Starting from the beginning',
}

const DIAGNOSTIC_SUBLINE: Record<Recommendation, string> = {
  ADVANCE: 'Your path skips what you have already demonstrated.',
  PRACTICE: 'You have the foundations. The path starts where they run out.',
  RETEACH: 'Nothing here was familiar yet, so the path starts at the roots.',
}

export function AssessmentResult({
  score,
  results,
  kind = 'practice',
}: {
  score: number
  results: QuestionResult[]
  kind?: 'practice' | 'diagnostic'
}) {
  const correct = results.filter((r) => r.isCorrect).length
  const recommendation = recommendationFor(score)
  const isDiagnostic = kind === 'diagnostic'
  const headline = isDiagnostic ? DIAGNOSTIC_HEADLINE[recommendation] : HEADLINE[recommendation]
  const subline = isDiagnostic ? DIAGNOSTIC_SUBLINE[recommendation] : SUBLINE[recommendation]

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">
            {isDiagnostic ? 'Here is where you are' : headline}
          </CardTitle>
          <CardDescription>{isDiagnostic ? headline : subline}</CardDescription>
          {isDiagnostic && (
            <CardDescription>{subline}</CardDescription>
          )}
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <span className="text-4xl font-semibold tabular-nums">{score}%</span>
            <span className="text-sm text-muted-foreground">
              {correct} of {results.length} correct
            </span>
          </div>
          <Progress value={score} />
          {isDiagnostic && (
            <Button
              nativeButton={false}
              variant="outline"
              className="mt-2 self-start"
              render={<Link href="/progress" />}
            >
              See your learning path
              <ArrowRight data-icon />
            </Button>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3">
        {results.map((result, index) => (
          <Card key={result.questionId}>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'flex size-5 items-center justify-center rounded-full',
                      result.isCorrect
                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                        : 'bg-destructive/15 text-destructive',
                    )}
                  >
                    {result.isCorrect ? (
                      <Check data-icon className="size-3" />
                    ) : (
                      <X data-icon className="size-3" />
                    )}
                  </span>
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Question {index + 1}
                  </CardTitle>
                </div>
                <Badge variant="outline">{result.conceptName}</Badge>
              </div>
            </CardHeader>

            <CardContent className="flex flex-col gap-3 text-sm">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Your answer
                </span>
                <p className={cn(!result.response && 'italic text-muted-foreground')}>
                  {result.response || 'No answer given'}
                </p>
              </div>

              {!result.isCorrect && (
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Correct answer
                  </span>
                  <p>{result.correctAnswer}</p>
                </div>
              )}

              <Separator />

              <p className="leading-relaxed text-muted-foreground">
                {result.feedback}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
