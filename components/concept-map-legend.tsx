import { EDGE_STYLES } from '@/lib/concept-edge-style'
import type { RelationshipType } from '@/lib/schemas/concept'
import { cn } from '@/lib/utils'

const ORDER: RelationshipType[] = [
  'PREREQUISITE_OF',
  'LEADS_TO',
  'RELATED_TO',
  'PART_OF',
]

export function ConceptMapLegend({ className }: { className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-center gap-3', className)}>
      {ORDER.map((type) => {
        const style = EDGE_STYLES[type]
        return (
          <span
            key={type}
            className="flex items-center gap-1.5 text-xs text-muted-foreground"
          >
            <svg width="20" height="2" aria-hidden="true">
              <line
                x1="0"
                y1="1"
                x2="20"
                y2="1"
                stroke={style.stroke}
                strokeWidth={style.strokeWidth}
                strokeDasharray={style.dash}
              />
            </svg>
            {style.label}
          </span>
        )
      })}
    </div>
  )
}
