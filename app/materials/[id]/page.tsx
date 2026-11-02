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
import { Badge } from '@/components/ui/badge'
import { MaterialQa } from '@/components/material-qa'
import { findMaterial } from '@/lib/repositories/material'
import { getSuggestedQuestions } from '@/lib/ai/material'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const material = await findMaterial(id)
  return {
    title: material ? `${material.filename} — Adaptive` : 'Material — Adaptive',
  }
}

export default async function MaterialPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const [material, questions] = await Promise.all([
    findMaterial(id),
    getSuggestedQuestions(id).catch(() => [] as string[]),
  ])

  if (!material) notFound()

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link href="/materials" />}>
              Materials
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{material.filename}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          {material.filename}
        </h1>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{material.chunkCount} sections</Badge>
          <Badge variant="outline">{material.status.toLowerCase()}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Answers come only from this document. If it does not cover something,
          the tutor will say so rather than guess.
        </p>
      </header>

      <MaterialQa materialId={material.id} filename={material.filename} suggestions={questions} />
    </div>
  )
}
