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
import { AssessmentRunner } from '@/components/assessment-runner'
import { findAssessment } from '@/lib/repositories/assessment'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Assessment — Adaptive',
}

export default async function AssessmentPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const assessment = await findAssessment(id)

  if (!assessment) notFound()

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link href="/explore" />}>Explore</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Assessment</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {assessment.topicTitle ?? 'Practice assessment'}
        </h1>
        <p className="text-sm text-muted-foreground">
          {assessment.questions.length} questions. Short answers are graded on
          understanding, not wording.
        </p>
      </header>

      <AssessmentRunner assessment={assessment} />
    </div>
  )
}
