'use client'

import { useCallback, useImperativeHandle, useMemo, type Ref } from 'react'
import {
  Background,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  applyNodeChanges,
  useReactFlow,
  type Connection,
  type Node,
  type NodeChange,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { PenLine } from 'lucide-react'
import type { StudentEdge, StudentNode } from '@/lib/schemas/student-map'

export type EditorState = {
  nodes: StudentNode[]
  edges: StudentEdge[]
}

export type Anchor = { x: number; y: number }

export type MapEditorHandle = {
  /** Graph coordinates at the centre of the visible canvas. */
  viewportCentre: () => Anchor
  /** Smoothly pan to a node. */
  focusNode: (id: string) => void
}

let counter = 0
function nextId(prefix: string): string {
  counter += 1
  return `${prefix}-${Date.now()}-${counter}`
}

const ADD_COLUMN_WIDTH = 240
const ADD_ROW_HEIGHT = 150
const ADD_PER_ROW = 4

/**
 * Appends a node, laid out in a grid from `anchor`.
 *
 * The anchor lets the caller drop new nodes at the viewport centre so they
 * are visible immediately. Defaults to the origin so the pure-function
 * tests stay simple.
 */
export function addNode(
  state: EditorState,
  label: string,
  anchor: Anchor = { x: 0, y: 0 },
): EditorState {
  const index = state.nodes.length
  const column = index % ADD_PER_ROW
  const row = Math.floor(index / ADD_PER_ROW)

  return {
    ...state,
    nodes: [
      ...state.nodes,
      {
        id: nextId('node'),
        label,
        x: anchor.x + column * ADD_COLUMN_WIDTH,
        y: anchor.y + row * ADD_ROW_HEIGHT,
      },
    ],
  }
}

export function renameNode(
  state: EditorState,
  id: string,
  label: string,
): EditorState {
  return {
    ...state,
    nodes: state.nodes.map((n) => (n.id === id ? { ...n, label } : n)),
  }
}

export function removeNode(state: EditorState, id: string): EditorState {
  return {
    nodes: state.nodes.filter((n) => n.id !== id),
    edges: state.edges.filter((e) => e.fromId !== id && e.toId !== id),
  }
}

export function toSavePayload(
  state: EditorState,
  courseSlug: string,
  title: string,
  id: string | undefined,
) {
  const nodes = state.nodes.filter((n) => n.label.trim().length > 0)
  const keptIds = new Set(nodes.map((n) => n.id))
  const edges = state.edges.filter(
    (e) => keptIds.has(e.fromId) && keptIds.has(e.toId),
  )

  return {
    ...(id ? { id } : {}),
    courseSlug,
    title,
    nodes,
    edges,
  }
}

type MapEditorProps = {
  state: EditorState
  onChange: (next: EditorState) => void
  onSelect: (id: string | null) => void
  selectedId: string | null
}

function EditorInner({
  state,
  onChange,
  onSelect,
  selectedId,
  handleRef,
}: MapEditorProps & { handleRef?: Ref<MapEditorHandle> }) {
  const { screenToFlowPosition, setCenter, getNode } = useReactFlow()

  useImperativeHandle(
    handleRef,
    () => ({
      viewportCentre: () => {
        const el = document.querySelector<HTMLElement>('[data-map-editor]')
        if (!el) return { x: 0, y: 0 }
        const rect = el.getBoundingClientRect()
        // Offset left and up so the node body sits centred, not its corner.
        const centre = screenToFlowPosition({
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
        })
        return { x: Math.round(centre.x - 90), y: Math.round(centre.y - 20) }
      },
      focusNode: (id: string) => {
        const node = getNode(id)
        if (!node) return
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        setCenter(node.position.x + 90, node.position.y + 20, {
          zoom: 1,
          duration: reduced ? 0 : 350,
        })
      },
    }),
    [screenToFlowPosition, setCenter, getNode],
  )

  const nodes = useMemo<Node[]>(
    () =>
      state.nodes.map((node) => ({
        id: node.id,
        position: { x: node.x, y: node.y },
        data: { label: node.label },
        selected: node.id === selectedId,
        style: {
          borderRadius: 8,
          padding: '8px 12px',
          fontSize: 13,
        },
      })),
    [state.nodes, selectedId],
  )

  const edges = useMemo(
    () =>
      state.edges.map((edge) => ({
        id: edge.id,
        source: edge.fromId,
        target: edge.toId,
        animated: edge.type === 'PREREQUISITE_OF',
        label: edge.type === 'PREREQUISITE_OF' ? 'requires' : undefined,
      })),
    [state.edges],
  )

  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const updated = applyNodeChanges(changes, nodes)
      onChange({
        ...state,
        nodes: state.nodes.map((node) => {
          const match = updated.find((u) => u.id === node.id)
          return match
            ? { ...node, x: match.position.x, y: match.position.y }
            : node
        }),
      })
    },
    [nodes, onChange, state],
  )

  const handleConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return
      if (connection.source === connection.target) return

      const exists = state.edges.some(
        (e) => e.fromId === connection.source && e.toId === connection.target,
      )
      if (exists) return

      onChange({
        ...state,
        edges: [
          ...state.edges,
          {
            id: nextId('edge'),
            fromId: connection.source,
            toId: connection.target,
            type: 'PREREQUISITE_OF',
          },
        ],
      })
    },
    [onChange, state],
  )

  return (
    <div data-map-editor className="relative h-[32rem] overflow-hidden rounded-xl border">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onConnect={handleConnect}
        onNodeClick={(_e, node) => onSelect(node.id)}
        onPaneClick={() => onSelect(null)}
        onEdgesDelete={(deleted) =>
          onChange({
            ...state,
            edges: state.edges.filter(
              (e) => !deleted.some((d) => d.id === e.id),
            ),
          })
        }
        fitView
        proOptions={{ hideAttribution: true }}
        minZoom={0.2}
      >
        <Background gap={16} size={1} />
        <Controls showInteractive={false} />
      </ReactFlow>
      {state.nodes.length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 text-center">
          <PenLine data-icon className="size-6 text-muted-foreground" />
          <p className="text-sm font-medium">Your canvas is empty</p>
          <p className="max-w-xs text-xs text-muted-foreground">
            Type a concept above and press Add. Then drag from one node&apos;s right
            edge to another&apos;s left edge to mark a prerequisite.
          </p>
        </div>
      )}
    </div>
  )
}

export function MapEditor(
  props: MapEditorProps & { handleRef?: Ref<MapEditorHandle> },
) {
  return (
    <ReactFlowProvider>
      <EditorInner {...props} />
    </ReactFlowProvider>
  )
}
