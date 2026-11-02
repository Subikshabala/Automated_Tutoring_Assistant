import { ArrowRight, Compass, Sparkles } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { CourseProgressCard } from '@/components/course-progress-card'
import { RecommendationCard } from '@/components/recommendation-card'
import { MasteryBar } from '@/components/mastery-bar'
import { MisconceptionList } from '@/components/misconception-list'
import { getAllCourseProgress } from '@/lib/repositories/progress'
import { listMasteryForCourse } from '@/lib/repositories/mastery'
import { getCourseGraph } from '@/lib/repositories/concept'
import { listOpenMisconceptions } from '@/lib/repositories/misconception'
import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/auth/session'
import { recommend } from '@/lib/adaptive'
import { generateCoachSummary } from '@/lib/ai/coach'
import { getResumePoint } from '@/lib/repositories/learning'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Your progress — Adaptive',
}

export default async function ProgressPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')
  const progress = await getAllCourseProgress(user.id)

  const active =
    progress
      .filter((p) => p.lastActivityAt !== null)
      .sort((a, b) =>
        (b.lastActivityAt ?? '').localeCompare(a.lastActivityAt ?? ''),
      )[0] ?? progress[0]

  if (!active) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Compass data-icon />
          </EmptyMedia>
          <EmptyTitle>No courses available</EmptyTitle>
          <EmptyDescription>
            Seed the database, then come back.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  const [graph, mastery, resume, misconceptions] = await Promise.all([
    getCourseGraph(active.courseSlug),
    listMasteryForCourse(user.id, active.courseSlug),
    getResumePoint(user.id),
    listOpenMisconceptions(user.id),
  ])

  const recommendations = graph
    ? recommend(graph, mastery, active.courseSlug, 5)
    : []

  const totals = progress.reduce(
    (acc, p) => ({
      mastered: acc.mastered + p.masteredConcepts,
      started: acc.started + p.startedConcepts,
      total: acc.total + p.totalConcepts,
    }),
    { mastered: 0, started: 0, total: 0 },
  )

  const summary = await generateCoachSummary({
    masteredCount: totals.mastered,
    startedCount: totals.started,
    totalCount: totals.total,
    topRecommendations: recommendations.slice(0, 3).map((r) => ({
      conceptName: r.conceptName,
      action: r.action,
    })),
  })

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Your progress</h1>
        <p className="text-sm text-muted-foreground">
          Mastery is measured from your assessment answers, not from pages
          visited.
        </p>
      </header>

      {resume && (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-6">
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Continue where you left off
              </span>
              <span className="font-medium">{resume.topicTitle}</span>
              <span className="text-sm text-muted-foreground">
                {resume.courseTitle}
              </span>
            </div>
            <Button
              nativeButton={false}
              render={
                <Link href={`/learn/${resume.courseSlug}/${resume.topicId}`} />
              }
            >
              Resume
              <ArrowRight data-icon />
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="flex items-start gap-3 pt-6">
          <Sparkles data-icon className="mt-0.5 size-5 shrink-0 text-primary" />
          <div className="flex flex-col gap-1">
            <p className="font-medium">{summary.headline}</p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {summary.body}
            </p>
          </div>
        </CardContent>
      </Card>

      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold">What to do next</h2>
          <span className="text-sm text-muted-foreground">
            {active.courseTitle}
          </span>
        </div>

        {recommendations.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Sparkles data-icon />
              </EmptyMedia>
              <EmptyTitle>Nothing outstanding</EmptyTitle>
              <EmptyDescription>
                You have mastered everything available in this course. Pick
                another one.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button nativeButton={false} render={<Link href="/explore" />}>Explore courses</Button>
            </EmptyContent>
          </Empty>
        ) : (
          <div className="flex flex-col gap-2">
            {recommendations.map((recommendation) => (
              <RecommendationCard
                key={recommendation.conceptId}
                recommendation={recommendation}
              />
            ))}
          </div>
        )}
      </section>

      {misconceptions.length > 0 && (
        <>
          <Separator />
          <MisconceptionList misconceptions={misconceptions} />
        </>
      )}

      <Separator />

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Courses</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {progress.map((item) => (
            <CourseProgressCard key={item.courseSlug} progress={item} />
          ))}
        </div>
      </section>

      {mastery.length > 0 && (
        <>
          <Separator />
          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold">
              Concept mastery in {active.courseTitle}
            </h2>
            <Card>
              <CardContent className="flex flex-col gap-4 pt-6">
                {mastery.map((record) => (
                  <MasteryBar
                    key={record.conceptId}
                    name={record.conceptName}
                    score={record.masteryScore}
                    status={record.status}
                  />
                ))}
              </CardContent>
            </Card>
          </section>
        </>
      )}
    </div>
  )
}
