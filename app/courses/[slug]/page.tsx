import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CircleCheck, Clock, Layers, Network, Network as NetworkIcon, PenLine } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { DifficultyBadge } from '@/components/difficulty-badge'
import { DiagnosticPrompt, DiagnosticButton } from '@/components/diagnostic-prompt'
import { CourseCurriculum } from '@/components/course-curriculum'
import { findCourseBySlug } from '@/lib/repositories/course'
import { getSessionUser } from '@/lib/auth/session'
import { listMasteryForCourse } from '@/lib/repositories/mastery'
import { hasTakenDiagnostic } from '@/lib/repositories/user'
import { MASTERED_THRESHOLD } from '@/lib/adaptive'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const course = await findCourseBySlug(slug)
  return { title: course ? `${course.title} — Adaptive` : 'Course — Adaptive' }
}

export default async function CoursePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const course = await findCourseBySlug(slug)
  const user = await getSessionUser()
  const mastery = user ? await listMasteryForCourse(user.id, slug) : []
  const mastered = mastery.filter((m) => m.masteryScore >= MASTERED_THRESHOLD).length
  const diagnosed = user ? await hasTakenDiagnostic(user.id, slug) : true

  if (!course) notFound()

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link href="/explore" />}>Explore</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{course.title}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{course.category}</Badge>
          <DifficultyBadge difficulty={course.difficulty} />
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">{course.title}</h1>
        <p className="max-w-2xl text-muted-foreground">{course.description}</p>
        <div className="flex flex-wrap gap-5 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Layers data-icon className="size-4" />
            {course.moduleCount} modules
          </span>
          <span className="flex items-center gap-1.5">
            <Network data-icon className="size-4" />
            {course.conceptCount} concepts
          </span>
          <span className="flex items-center gap-1.5">
            <Clock data-icon className="size-4" />
            {course.estimatedHours} hours
          </span>
          {user && mastery.length > 0 && (
            <span className="flex items-center gap-1.5">
              <CircleCheck data-icon className="size-4" />
              {mastered} of {course.conceptCount} mastered
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2 pt-2">
          <Button nativeButton={false} render={<Link href={`/courses/${course.slug}/map`} />}>
            <NetworkIcon data-icon />
            View concept map
          </Button>
          <Button
              variant="outline"
              nativeButton={false}
              render={<Link href={`/courses/${course.slug}/my-map`} />}
            >
            <PenLine data-icon />
            Draw your own map
          </Button>
          {user && diagnosed && (
            <DiagnosticButton
              courseSlug={course.slug}
              variant="outline"
              label="Evaluation test"
            />
          )}
        </div>
      </header>

      {user && !diagnosed && (
        <DiagnosticPrompt
          courseSlug={course.slug}
          conceptCount={course.conceptCount}
        />
      )}

      <Separator />

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Curriculum</h2>
        <CourseCurriculum courseSlug={course.slug} modules={course.modules} />
      </section>
    </div>
  )
}
