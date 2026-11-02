'use client'

import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from '@xyflow/react'
import { cn } from '@/lib/utils'
import { edgeStyleFor } from '@/lib/concept-edge-style'
import type { RelationshipType } from '@/lib/schemas/concept'

export type ConceptEdgeData = {
  type: RelationshipType
  /** Set when a node is selected and this edge does not touch it. */
  dimmed?: boolean
  /** Set when this edge touches the selected node. */
  highlighted?: boolean
}

export function ConceptEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  data,
}: EdgeProps) {
  const edgeData = (data ?? {}) as ConceptEdgeData
  const style = edgeStyleFor(edgeData.type)

  const [path, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    // Gentler than the default; long spans stay readable.
    curvature: 0.3,
  })

  const opacity = edgeData.dimmed ? 0.15 : edgeData.highlighted ? 1 : 0.55

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        markerEnd={style.directed ? markerEnd : undefined}
        style={{
          stroke: style.stroke,
          strokeWidth: edgeData.highlighted
            ? style.strokeWidth + 0.75
            : style.strokeWidth,
          strokeDasharray: style.dash,
          opacity,
          transition: 'opacity 200ms, stroke-width 200ms',
        }}
        className={cn(style.animated && !edgeData.dimmed && 'animate-dash')}
      />

      <EdgeLabelRenderer>
        <div
          style={{
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            opacity,
          }}
          className={cn(
            'pointer-events-none absolute rounded-full border px-2 py-0.5',
            'text-[10px] font-medium tracking-wide uppercase',
            'transition-opacity duration-200',
            style.labelClass,
          )}
        >
          {style.label}
        </div>
      </EdgeLabelRenderer>
    </>
  )
}
