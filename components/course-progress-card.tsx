import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import type { CourseProgress } from '@/lib/schemas/recommendation'

export function CourseProgressCard({
  progress,
}: {
  progress: CourseProgress
}) {
  const completion =
    progress.totalConcepts === 0
      ? 0
      : Math.round((progress.masteredConcepts / progress.totalConcepts) * 100)

  return (
    <Link
      href={`/courses/${progress.courseSlug}`}
      className="group block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Card className="h-full transition-all duration-200 group-hover:border-primary/40 group-hover:shadow-md">
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <CardTitle className="text-base leading-snug">
              {progress.courseTitle}
            </CardTitle>
            {progress.startedConcepts === 0 && (
              <Badge variant="outline">Not started</Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between text-sm">
            <span className="text-muted-foreground">
              {progress.masteredConcepts} of {progress.totalConcepts} mastered
            </span>
            <span className="font-medium tabular-nums">{completion}%</span>
          </div>
          <Progress value={completion} />
          {progress.startedConcepts > 0 && (
            <p className="text-xs text-muted-foreground">
              Average mastery across started concepts:{' '}
              <span className="tabular-nums">{progress.averageMastery}</span>
            </p>
          )}
        </CardContent>
      </Card>
    </Link>
  )
}
