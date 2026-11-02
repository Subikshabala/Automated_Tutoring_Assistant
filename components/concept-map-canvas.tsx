'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Background,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Node,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { cn } from '@/lib/utils'
import { ConceptNode } from '@/components/concept-node'
import { ConceptEdge } from '@/components/concept-edge'
import { ConceptDetailPanel, type ConceptRef } from '@/components/concept-detail-panel'
import { layoutGraph, NODE_WIDTH, NODE_HEIGHT } from '@/lib/concept-layout'
import type { ConceptGraph } from '@/lib/schemas/concept'

export function getNeighbours(
  graph: ConceptGraph,
  selectedId: string | null,
): { prerequisites: ConceptRef[]; unlocks: ConceptRef[] } {
  if (!selectedId) return { prerequisites: [], unlocks: [] }

  const nameById = new Map(graph.concepts.map((c) => [c.id, c.name]))
  const prerequisites: ConceptRef[] = []
  const unlocks: ConceptRef[] = []

  for (const rel of graph.relationships) {
    if (rel.type !== 'PREREQUISITE_OF') continue
    if (rel.toId === selectedId) {
      const name = nameById.get(rel.fromId)
      if (name) prerequisites.push({ id: rel.fromId, name })
    }
    if (rel.fromId === selectedId) {
      const name = nameById.get(rel.toId)
      if (name) unlocks.push({ id: rel.toId, name })
    }
  }

  return { prerequisites, unlocks }
}

const nodeTypes = { concept: ConceptNode }
const edgeTypes = { concept: ConceptEdge }

export type ConceptMapCanvasProps = {
  graph: ConceptGraph
  selectedId?: string | null
  onSelectConcept?: (conceptId: string) => void
  hideDetailPanel?: boolean
  className?: string
}

function CanvasInner({
  graph,
  selectedId: controlledSelectedId,
  onSelectConcept,
  hideDetailPanel = false,
  className,
}: ConceptMapCanvasProps) {
  const [internalSelectedId, setInternalSelectedId] = useState<string | null>(null)
  const { setCenter, getNode } = useReactFlow()

  const selectedId =
    controlledSelectedId !== undefined ? controlledSelectedId : internalSelectedId

  const handleSelect = useCallback(
    (id: string | null) => {
      if (controlledSelectedId === undefined) {
        setInternalSelectedId(id)
      }
      if (id) {
        onSelectConcept?.(id)
      }
    },
    [controlledSelectedId, onSelectConcept],
  )

  const { nodes, edges, bounds } = useMemo(() => layoutGraph(graph), [graph])

  // Pan to a node that was selected from outside the canvas — a detail
  // panel reference or a learn-page chip. Without this the selection
  // changes offscreen and looks like nothing happened.
  useEffect(() => {
    if (!selectedId) return
    const node = getNode(selectedId)
    if (!node) return

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    setCenter(
      node.position.x + NODE_WIDTH / 2,
      node.position.y + NODE_HEIGHT / 2,
      { zoom: 1, duration: prefersReducedMotion ? 0 : 400 },
    )
  }, [selectedId, getNode, setCenter])

  const styledNodes = useMemo(
    () => nodes.map((n) => ({ ...n, selected: n.id === selectedId })),
    [nodes, selectedId],
  )

  const styledEdges = useMemo(() => {
    const touchesSelection = (e: { source: string; target: string }) =>
      selectedId !== null && (e.source === selectedId || e.target === selectedId)

    return edges.map((edge) => ({
      ...edge,
      type: 'concept' as const,
      markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
      data: {
        type: edge.data.type,
        highlighted: touchesSelection(edge),
        dimmed: selectedId !== null && !touchesSelection(edge),
      },
    }))
  }, [edges, selectedId])

  const selectedConcept = useMemo(
    () => graph.concepts.find((c) => c.id === selectedId) ?? null,
    [graph.concepts, selectedId],
  )

  const { prerequisites, unlocks } = useMemo(
    () => getNeighbours(graph, selectedId),
    [graph, selectedId],
  )

  // A wide graph needs to zoom out further; a small one should not
  // balloon to fill the canvas.
  const fitPadding = bounds.columns > 4 ? 0.1 : 0.25
  const minZoom = bounds.columns > 6 ? 0.1 : 0.2

  const embeddedHeight =
    bounds.maxRows >= 4 ? 'h-[460px]' : bounds.maxRows >= 3 ? 'h-[400px]' : 'h-[320px]'

  return (
    <div
      className={cn(
        'flex overflow-hidden rounded-xl border bg-background',
        hideDetailPanel ? embeddedHeight : 'h-[calc(100vh-10rem)]',
        className,
      )}
    >
      {/* min-w-0 stops the canvas from claiming its content width and
          pushing the detail panel out of view. */}
      <div className="relative min-w-0 flex-1">
        <ReactFlow
          nodes={styledNodes}
          edges={styledEdges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodeClick={(_event, node: Node) => handleSelect(node.id)}
          onPaneClick={() => {
            if (!hideDetailPanel) {
              handleSelect(null)
            }
          }}
          fitView
          fitViewOptions={{ padding: fitPadding, maxZoom: 1 }}
          proOptions={{ hideAttribution: true }}
          minZoom={minZoom}
          maxZoom={1.5}
        >
          <Background gap={16} size={1} />
          <Controls showInteractive={false} />
          <MiniMap pannable zoomable className="!bg-muted" />
        </ReactFlow>
      </div>

      {!hideDetailPanel && (
        <aside className="hidden w-80 shrink-0 border-l bg-card md:block">
          <ConceptDetailPanel
            concept={selectedConcept}
            prerequisites={prerequisites}
            unlocks={unlocks}
            onSelectConcept={handleSelect}
          />
        </aside>
      )}
    </div>
  )
}

export function ConceptMapCanvas(props: ConceptMapCanvasProps) {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  )
}
