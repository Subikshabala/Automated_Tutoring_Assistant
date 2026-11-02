import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MapEditor } from '@/components/map-editor'

// React Flow needs a real layout engine; stub it.
vi.mock('@xyflow/react', () => ({
  ReactFlow: () => null,
  ReactFlowProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Background: () => null,
  Controls: () => null,
  applyNodeChanges: () => [],
  useReactFlow: () => ({
    screenToFlowPosition: () => ({ x: 0, y: 0 }),
    setCenter: () => {},
    getNode: () => null,
  }),
}))

describe('MapEditor render', () => {
  it('shows guidance when the canvas is empty', () => {
    render(
      <MapEditor state={{ nodes: [], edges: [] }} onChange={() => {}} onSelect={() => {}} selectedId={null} />,
    )
    expect(screen.getByText('Your canvas is empty')).toBeInTheDocument()
  })

  it('hides guidance once a node exists', () => {
    render(
      <MapEditor
        state={{ nodes: [{ id: 'n1', label: 'A', x: 0, y: 0 }], edges: [] }}
        onChange={() => {}}
        onSelect={() => {}}
        selectedId={null}
      />,
    )
    expect(screen.queryByText('Your canvas is empty')).not.toBeInTheDocument()
  })
})
