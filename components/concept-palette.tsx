'use client'

import { useMemo, useState } from 'react'
import { Eye, EyeOff, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { DifficultyBadge } from '@/components/difficulty-badge'
import { cn } from '@/lib/utils'
import type { Difficulty } from '@/lib/schemas/common'

export type PaletteConcept = {
  name: string
  difficulty: Difficulty
}

export function ConceptPalette({
  concepts,
  usedLabels,
  onAdd,
}: {
  concepts: PaletteConcept[]
  usedLabels: string[]
  onAdd: (name: string) => void
}) {
  const [visible, setVisible] = useState(true)

  const used = useMemo(
    () => new Set(usedLabels.map((l) => l.trim().toLowerCase())),
    [usedLabels],
  )

  if (concepts.length === 0) return null

  const placed = concepts.filter((c) => used.has(c.name.toLowerCase())).length

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-col gap-0.5">
            <h3 className="text-sm font-medium">Concepts in this course</h3>
            <p className="text-xs text-muted-foreground">
              {placed} of {concepts.length} placed
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setVisible((v) => !v)}
          >
            {visible ? <EyeOff data-icon /> : <Eye data-icon />}
            {visible ? 'Hide' : 'Show'}
          </Button>
        </div>

        {visible ? (
          <div className="flex flex-wrap gap-2">
            {concepts.map((concept) => {
              const isUsed = used.has(concept.name.toLowerCase())
              return (
                <button
                  key={concept.name}
                  type="button"
                  disabled={isUsed}
                  onClick={() => onAdd(concept.name)}
                  className={cn(
                    'flex items-center gap-2 rounded-lg border px-3 py-1.5',
                    'text-xs font-medium transition-all duration-200',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    isUsed
                      ? 'cursor-not-allowed border-border/50 bg-muted/40 text-muted-foreground opacity-60'
                      : 'cursor-pointer border-border bg-background hover:border-primary/40 hover:bg-accent hover:shadow-sm',
                  )}
                >
                  {!isUsed && <Plus data-icon className="size-3" />}
                  <span>{concept.name}</span>
                  <DifficultyBadge difficulty={concept.difficulty} />
                </button>
              )
            })}
          </div>
        ) : (
          <p className="text-xs italic text-muted-foreground">
            Hidden. Recall what belongs, then reveal to check.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
