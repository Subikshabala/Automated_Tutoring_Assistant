import { describe, expect, it } from 'vitest'
import {
  addNode,
  removeNode,
  renameNode,
  toSavePayload,
  type EditorState,
} from '@/components/map-editor'

const state = {
  nodes: [
    { id: 'n1', label: 'Tokenization', x: 0, y: 0 },
    { id: 'n2', label: 'Embeddings', x: 100, y: 0 },
  ],
  edges: [
    { id: 'e1', fromId: 'n1', toId: 'n2', type: 'PREREQUISITE_OF' as const },
  ],
}

describe('addNode', () => {
  it('appends a node', () => {
    const next = addNode(state, 'Attention')
    expect(next.nodes).toHaveLength(3)
    expect(next.nodes[2].label).toBe('Attention')
  })

  it('gives the new node a unique id', () => {
    const next = addNode(state, 'Attention')
    const ids = next.nodes.map((n) => n.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('leaves existing edges untouched', () => {
    expect(addNode(state, 'Attention').edges).toEqual(state.edges)
  })
})

describe('addNode positioning', () => {
  const empty: EditorState = { nodes: [], edges: [] }

  it('places the first node at the origin by default', () => {
    const next = addNode(empty, 'First')
    expect(next.nodes[0].x).toBe(0)
    expect(next.nodes[0].y).toBe(0)
  })

  it('places a node at a given anchor', () => {
    const next = addNode(empty, 'First', { x: 400, y: 250 })
    expect(next.nodes[0].x).toBe(400)
    expect(next.nodes[0].y).toBe(250)
  })

  it('offsets successive nodes so they do not stack', () => {
    let s = addNode(empty, 'One', { x: 100, y: 100 })
    s = addNode(s, 'Two', { x: 100, y: 100 })
    expect(s.nodes[1].x).not.toBe(s.nodes[0].x)
  })

  it('wraps to a new row after four in a row', () => {
    let s = empty
    for (let i = 0; i < 5; i++) s = addNode(s, `N${i}`, { x: 0, y: 0 })
    expect(s.nodes[4].y).toBeGreaterThan(s.nodes[0].y)
  })

  it('returns the id of the node it created', () => {
    const { nodes } = addNode(empty, 'First')
    expect(nodes[0].id).toMatch(/^node-/)
  })
})

describe('renameNode', () => {
  it('changes the label of the target node', () => {
    const next = renameNode(state, 'n1', 'Tokenisation')
    expect(next.nodes[0].label).toBe('Tokenisation')
  })

  it('leaves other nodes untouched', () => {
    const next = renameNode(state, 'n1', 'X')
    expect(next.nodes[1].label).toBe('Embeddings')
  })

  it('ignores an unknown node id', () => {
    expect(renameNode(state, 'ghost', 'X').nodes).toEqual(state.nodes)
  })
})

describe('removeNode', () => {
  it('removes the node', () => {
    const next = removeNode(state, 'n1')
    expect(next.nodes.map((n) => n.id)).toEqual(['n2'])
  })

  it('removes edges touching the node', () => {
    expect(removeNode(state, 'n1').edges).toHaveLength(0)
  })

  it('keeps edges that do not touch the node', () => {
    const extended = {
      nodes: [...state.nodes, { id: 'n3', label: 'C', x: 0, y: 0 }],
      edges: [
        ...state.edges,
        { id: 'e2', fromId: 'n2', toId: 'n3', type: 'RELATED_TO' as const },
      ],
    }
    expect(removeNode(extended, 'n1').edges.map((e) => e.id)).toEqual(['e2'])
  })
})

describe('toSavePayload', () => {
  it('includes the course slug and title', () => {
    const payload = toSavePayload(state, 'generative-ai', 'My map', undefined)
    expect(payload.courseSlug).toBe('generative-ai')
    expect(payload.title).toBe('My map')
  })

  it('includes the id when updating an existing map', () => {
    const payload = toSavePayload(state, 'generative-ai', 'My map', 'm1')
    expect(payload.id).toBe('m1')
  })

  it('omits the id when creating a new map', () => {
    const payload = toSavePayload(state, 'generative-ai', 'My map', undefined)
    expect(payload).not.toHaveProperty('id')
  })

  it('drops nodes with a blank label', () => {
    const withBlank = {
      nodes: [...state.nodes, { id: 'n3', label: '   ', x: 0, y: 0 }],
      edges: state.edges,
    }
    expect(toSavePayload(withBlank, 's', 't', undefined).nodes).toHaveLength(2)
  })

  it('drops edges whose endpoints were dropped', () => {
    const withBlank = {
      nodes: [...state.nodes, { id: 'n3', label: '  ', x: 0, y: 0 }],
      edges: [
        ...state.edges,
        { id: 'e2', fromId: 'n2', toId: 'n3', type: 'RELATED_TO' as const },
      ],
    }
    expect(toSavePayload(withBlank, 's', 't', undefined).edges).toHaveLength(1)
  })
})
