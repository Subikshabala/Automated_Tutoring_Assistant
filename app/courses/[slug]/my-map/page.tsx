import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { MapWorkspace } from '@/components/map-workspace'
import { findCourseBySlug } from '@/lib/repositories/course'
import { listStudentMaps } from '@/lib/repositories/student-map'
import { getCourseGraph } from '@/lib/repositories/concept'
import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/auth/session'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const course = await findCourseBySlug(slug)
  return {
    title: course ? `Your ${course.title} map — Adaptive` : 'Your map — Adaptive',
  }
}

export default async function MyMapPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const [course, maps, graph] = await Promise.all([
    findCourseBySlug(slug),
    listStudentMaps(user.id, slug),
    getCourseGraph(slug),
  ])

  if (!course || !graph) notFound()

  const latest = maps[0] ?? null

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link href="/explore" />}>Explore</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link href={`/courses/${slug}`} />}>
              {course.title}
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Your map</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          Draw your own map
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Pick the concepts you think belong, then connect them. Drag from a
          node&apos;s right edge to another&apos;s left edge to mark a prerequisite.
          Compare when you are done to see where your model differs from the course.
        </p>
        <p className="max-w-2xl text-xs text-muted-foreground">
          Hide the palette first if you want to test what you can recall unaided.
        </p>
      </header>

      <MapWorkspace
        courseSlug={slug}
        conceptPalette={graph.concepts.map((c) => ({
          name: c.name,
          difficulty: c.difficulty,
        }))}
        initial={
          latest
            ? {
                id: latest.id,
                title: latest.title,
                nodes: latest.nodes,
                edges: latest.edges,
              }
            : null
        }
      />
    </div>
  )
}
