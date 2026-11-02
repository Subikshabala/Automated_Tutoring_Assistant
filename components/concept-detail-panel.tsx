'use client'

import { MousePointerClick } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { DifficultyBadge } from '@/components/difficulty-badge'
import { cn } from '@/lib/utils'
import type { ConceptDto } from '@/lib/schemas/concept'

export type ConceptRef = { id: string; name: string }

function RefList({
  title,
  items,
  onSelect,
}: {
  title: string
  items: ConceptRef[]
  onSelect?: (id: string) => void
}) {
  if (items.length === 0) return null

  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item) =>
          onSelect ? (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item.id)}
              aria-label={`Go to ${item.name}`}
              className={cn(
                'rounded-full border px-2.5 py-0.5 text-xs font-medium',
                'border-border bg-card text-foreground',
                'transition-colors duration-200',
                'hover:border-primary/50 hover:bg-accent',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              )}
            >
              {item.name}
            </button>
          ) : (
            <Badge key={item.id} variant="outline">
              {item.name}
            </Badge>
          ),
        )}
      </div>
    </section>
  )
}

export function ConceptDetailPanel({
  concept,
  prerequisites,
  unlocks,
  onSelectConcept,
}: {
  concept: ConceptDto | null
  prerequisites: ConceptRef[]
  unlocks: ConceptRef[]
  /** When provided, references become navigable buttons. */
  onSelectConcept?: (conceptId: string) => void
}) {
  if (!concept) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
        <MousePointerClick data-icon className="size-6 text-muted-foreground" />
        <p className="text-sm font-medium">Select a concept</p>
        <p className="text-xs text-muted-foreground">
          Click any node to see its definition and connections.
        </p>
      </div>
    )
  }

  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col gap-5 p-5">
        <header className="flex flex-col gap-2">
          <DifficultyBadge difficulty={concept.difficulty} />
          <h2 className="text-lg font-semibold leading-tight">{concept.name}</h2>
          <p className="text-sm text-muted-foreground">{concept.definition}</p>
        </header>

        {concept.objectives.length > 0 && (
          <>
            <Separator />
            <section className="flex flex-col gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                You should be able to
              </h3>
              <ul className="flex flex-col gap-1.5">
                {concept.objectives.map((objective) => (
                  <li
                    key={objective}
                    className="flex gap-2 text-sm leading-snug"
                  >
                    <span className="mt-1.5 size-1 shrink-0 rounded-full bg-primary" />
                    {objective}
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}

        {(prerequisites.length > 0 || unlocks.length > 0) && <Separator />}
        <RefList title="Prerequisites" items={prerequisites} onSelect={onSelectConcept} />
        <RefList title="Unlocks" items={unlocks} onSelect={onSelectConcept} />
      </div>
    </ScrollArea>
  )
}
