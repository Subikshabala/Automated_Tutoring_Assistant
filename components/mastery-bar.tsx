import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import type { MasteryStatus } from '@/lib/schemas/common'

const STATUS_LABEL: Record<MasteryStatus, string> = {
  NOT_STARTED: 'Not started',
  LEARNING: 'Learning',
  PRACTICING: 'Practising',
  MASTERED: 'Mastered',
  NEEDS_REVIEW: 'Needs review',
}

const STATUS_COLOUR: Record<MasteryStatus, string> = {
  NOT_STARTED: 'text-muted-foreground',
  LEARNING: 'text-amber-600 dark:text-amber-400',
  PRACTICING: 'text-blue-600 dark:text-blue-400',
  MASTERED: 'text-emerald-600 dark:text-emerald-400',
  NEEDS_REVIEW: 'text-destructive',
}

export function MasteryBar({
  name,
  score,
  status,
}: {
  name: string
  score: number
  status: MasteryStatus
}) {
  return (
    <div className="flex flex-col gap-1.5 rounded-lg px-3 py-2 transition-colors hover:bg-muted/50">
      <div className="flex items-baseline justify-between gap-3">
        <span className="truncate text-sm">{name}</span>
        <span
          className={cn(
            'shrink-0 text-xs font-medium',
            STATUS_COLOUR[status],
          )}
        >
          {STATUS_LABEL[status]}
        </span>
      </div>
      <Progress value={score} className="h-1.5" />
    </div>
  )
}
