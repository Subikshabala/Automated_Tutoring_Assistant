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
import { ConceptMapCanvas } from '@/components/concept-map-canvas'
import { ConceptMapLegend } from '@/components/concept-map-legend'
import { getCourseGraph } from '@/lib/repositories/concept'
import { findCourseBySlug } from '@/lib/repositories/course'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const course = await findCourseBySlug(slug)
  return {
    title: course ? `${course.title} map — Adaptive` : 'Concept map — Adaptive',
  }
}

export default async function ConceptMapPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const [course, graph] = await Promise.all([
    findCourseBySlug(slug),
    getCourseGraph(slug),
  ])

  if (!course || !graph) notFound()

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
            <BreadcrumbPage>Concept map</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          {course.title} concept map
        </h1>
        <p className="text-sm text-muted-foreground">
          {graph.concepts.length} concepts. Animated edges are prerequisites —
          follow them left to right.
        </p>
        <ConceptMapLegend />
      </header>

      <ConceptMapCanvas graph={graph} />
    </div>
  )
}
