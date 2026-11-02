import type { RelationshipType } from '@/lib/schemas/concept'

export type EdgeStyle = {
  label: string
  /** CSS variable reference so the stroke follows the theme. */
  stroke: string
  strokeWidth: number
  /** SVG stroke-dasharray. Undefined means solid. */
  dash?: string
  animated: boolean
  /** Whether to render an arrowhead. */
  directed: boolean
  /** Tailwind classes for the label chip. */
  labelClass: string
}

export const EDGE_STYLES: Record<RelationshipType, EdgeStyle> = {
  PREREQUISITE_OF: {
    label: 'requires',
    stroke: 'var(--color-primary)',
    strokeWidth: 2,
    animated: true,
    directed: true,
    labelClass: 'border-primary/40 bg-primary/10 text-primary',
  },
  LEADS_TO: {
    label: 'leads to',
    stroke: 'var(--color-muted-foreground)',
    strokeWidth: 1.5,
    animated: false,
    directed: true,
    labelClass: 'border-border bg-card text-muted-foreground',
  },
  RELATED_TO: {
    label: 'related',
    stroke: 'var(--color-muted-foreground)',
    strokeWidth: 1.5,
    dash: '6 4',
    animated: false,
    directed: false,
    labelClass: 'border-border bg-card text-muted-foreground',
  },
  PART_OF: {
    label: 'part of',
    stroke: 'var(--color-muted-foreground)',
    strokeWidth: 1.5,
    dash: '2 3',
    animated: false,
    directed: false,
    labelClass: 'border-border bg-card text-muted-foreground',
  },
}

export function edgeStyleFor(type: RelationshipType): EdgeStyle {
  return EDGE_STYLES[type] ?? EDGE_STYLES.RELATED_TO
}
