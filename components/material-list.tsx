import Link from 'next/link'
import { AlertCircle, FileText } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import type { MaterialSummary } from '@/lib/schemas/material'

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const STATUS_VARIANT: Record<
  MaterialSummary['status'],
  'secondary' | 'default' | 'destructive'
> = {
  UPLOADED: 'secondary',
  PROCESSING: 'secondary',
  READY: 'default',
  FAILED: 'destructive',
}

function Row({ material }: { material: MaterialSummary }) {
  const body = (
    <Card className="flex flex-row items-center gap-4 p-4 transition-all duration-200 hover:border-primary/40 hover:shadow-sm">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
        {material.status === 'FAILED' ? (
          <AlertCircle data-icon className="size-5 text-destructive" />
        ) : (
          <FileText data-icon className="size-5 text-muted-foreground" />
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-sm font-medium">{material.filename}</span>
        <span className="text-xs text-muted-foreground">
          {formatBytes(material.sizeBytes)}
          {material.status === 'READY' && ` · ${material.chunkCount} sections`}
        </span>
        {material.error && (
          <span className="text-xs text-destructive">{material.error}</span>
        )}
      </div>

      <Badge variant={STATUS_VARIANT[material.status]}>
        {material.status.toLowerCase()}
      </Badge>
    </Card>
  )

  if (material.status !== 'READY') return body

  return (
    <Link href={`/materials/${material.id}`} className="block">
      {body}
    </Link>
  )
}

export function MaterialList({
  materials,
}: {
  materials: MaterialSummary[]
}) {
  if (materials.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FileText data-icon />
          </EmptyMedia>
          <EmptyTitle>No documents yet</EmptyTitle>
          <EmptyDescription>
            Upload lecture notes or a paper, then ask questions about it.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {materials.map((material) => (
        <Row key={material.id} material={material} />
      ))}
    </div>
  )
}
