import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Network, PenLine } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { getSessionUser } from '@/lib/auth/session'
import { listAllStudentMaps } from '@/lib/repositories/student-map'
import { listCourses } from '@/lib/repositories/course'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Concept maps — Adaptive' }

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
  })
}

export default async function ConceptMapIndexPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login?next=%2Fconcept-map')

  const [maps, courses] = await Promise.all([
    listAllStudentMaps(user.id),
    listCourses({}),
  ])

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Concept maps</h1>
        <p className="text-sm text-muted-foreground">
          Study the canonical map for a course, or draw your own and compare.
        </p>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Your maps</h2>

        {maps.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <PenLine data-icon />
              </EmptyMedia>
              <EmptyTitle>No maps yet</EmptyTitle>
              <EmptyDescription>
                Drawing your own map and comparing it against the course
                structure is the fastest way to find what you have misunderstood.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button
                nativeButton={false}
                render={<Link href="/explore" />}
              >
                Pick a course
              </Button>
            </EmptyContent>
          </Empty>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {maps.map((map) => (
              <Link
                key={map.id}
                href={`/courses/${map.courseSlug}/my-map`}
                className="group rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Card className="h-full transition-all duration-200 group-hover:border-primary/40 group-hover:shadow-md">
                  <CardHeader>
                    <CardTitle className="text-base leading-snug">
                      {map.title}
                    </CardTitle>
                    <CardDescription>{map.courseTitle}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{map.nodeCount} concepts</Badge>
                    <Badge variant="secondary">{map.edgeCount} links</Badge>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {formatDate(map.updatedAt)}
                    </span>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      <Separator />

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Course maps</h2>
        <p className="text-sm text-muted-foreground">
          The canonical prerequisite graph for each course.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => (
            <Link
              key={course.id}
              href={`/courses/${course.slug}/map`}
              className="group rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Card className="h-full transition-all duration-200 group-hover:border-primary/40 group-hover:shadow-md">
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <CardTitle className="text-base leading-snug">
                      {course.title}
                    </CardTitle>
                    <Network
                      data-icon
                      className="size-4 shrink-0 text-muted-foreground"
                    />
                  </div>
                  <CardDescription>{course.category}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Badge variant="secondary">
                    {course.conceptCount} concepts
                  </Badge>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
