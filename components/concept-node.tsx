'use client'

import { Handle, Position } from '@xyflow/react'
import { cn } from '@/lib/utils'
import type { ConceptDto } from '@/lib/schemas/concept'

const DIFFICULTY_ACCENT: Record<ConceptDto['difficulty'], string> = {
  BEGINNER: 'border-l-emerald-500',
  INTERMEDIATE: 'border-l-amber-500',
  ADVANCED: 'border-l-rose-500',
}

export function ConceptNode({
  data,
  selected,
}: {
  data: { concept: ConceptDto }
  selected: boolean
}) {
  const { concept } = data

  return (
    <div
      data-selected={selected}
      data-difficulty={concept.difficulty}
      tabIndex={0}
      role="button"
      aria-label={`${concept.name}. ${concept.difficulty.toLowerCase()}. Press Enter for details.`}
      aria-pressed={selected}
      className={cn(
        'w-56 cursor-pointer rounded-lg border border-l-4 bg-card px-3 py-2.5 shadow-sm',
        'transition-all duration-200',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        DIFFICULTY_ACCENT[concept.difficulty],
        selected
          ? 'border-primary bg-accent/30 shadow-md ring-2 ring-primary ring-offset-1 ring-offset-background scale-[1.03]'
          : 'hover:border-primary/40 hover:shadow-md',
      )}
    >
      <Handle type="target" position={Position.Left} className="!size-2" />
      <p className="text-sm font-medium leading-tight">{concept.name}</p>
      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
        {concept.definition}
      </p>
      <Handle type="source" position={Position.Right} className="!size-2" />
    </div>
  )
}
