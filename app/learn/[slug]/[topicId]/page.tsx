import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { LearnView } from '@/components/learn-view'
import { findTopicWithConcepts } from '@/lib/repositories/concept'
import { explainConcept } from '@/lib/ai/tutor'
import { getSessionUser } from '@/lib/auth/session'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ topicId: string }>
}) {
  const { topicId } = await params
  const topic = await findTopicWithConcepts(topicId)
  return { title: topic ? `${topic.title} — Adaptive` : 'Learn — Adaptive' }
}

export default async function LearnPage({
  params,
}: {
  params: Promise<{ slug: string; topicId: string }>
}) {
  const { slug, topicId } = await params

  // Generation costs money and progress is written per user, so this page
  // is account-only. The proxy also blocks it, but authorisation belongs here.
  const user = await getSessionUser()
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/learn/${slug}/${topicId}`)}`)
  }

  const topic = await findTopicWithConcepts(topicId)

  if (!topic || topic.courseSlug !== slug) notFound()

  // Load explanation ONLY for the initial selected concept
  // Other concepts are loaded on-demand when selected by the student (Constraint 3)
  const initialConcept = topic.concepts[0]
  let initialExplanation = null
  if (initialConcept) {
    try {
      const res = await explainConcept(initialConcept.id)
      initialExplanation = res.explanation
    } catch {
      initialExplanation = null
    }
  }

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
              {topic.courseTitle}
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{topic.title}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <LearnView
        topic={topic}
        initialConceptId={initialConcept?.id}
        initialExplanation={initialExplanation}
      />
    </div>
  )
}
