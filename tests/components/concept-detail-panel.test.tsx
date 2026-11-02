import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ConceptDetailPanel } from '@/components/concept-detail-panel'
import type { ConceptDto } from '@/lib/schemas/concept'

const concept: ConceptDto = {
  id: 'x1',
  courseId: 'c1',
  name: 'Tokenization',
  definition: 'Splitting text into tokens.',
  difficulty: 'BEGINNER',
  objectives: ['Explain subwords', 'Estimate token counts'],
}

describe('ConceptDetailPanel', () => {
  it('prompts the user when nothing is selected', () => {
    render(<ConceptDetailPanel concept={null} prerequisites={[]} unlocks={[]} />)
    expect(screen.getByText('Select a concept')).toBeInTheDocument()
  })

  it('renders the name and definition of the selected concept', () => {
    render(
      <ConceptDetailPanel concept={concept} prerequisites={[]} unlocks={[]} />,
    )
    expect(screen.getByText('Tokenization')).toBeInTheDocument()
    expect(screen.getByText('Splitting text into tokens.')).toBeInTheDocument()
  })

  it('lists every learning objective', () => {
    render(
      <ConceptDetailPanel concept={concept} prerequisites={[]} unlocks={[]} />,
    )
    expect(screen.getByText('Explain subwords')).toBeInTheDocument()
    expect(screen.getByText('Estimate token counts')).toBeInTheDocument()
  })

  it('lists prerequisites when there are any', () => {
    render(
      <ConceptDetailPanel
        concept={concept}
        prerequisites={[{ id: 'p1', name: 'Text Basics' }]}
        unlocks={[]}
      />,
    )
    expect(screen.getByText('Prerequisites')).toBeInTheDocument()
    expect(screen.getByText('Text Basics')).toBeInTheDocument()
  })

  it('lists what the concept unlocks', () => {
    render(
      <ConceptDetailPanel
        concept={concept}
        prerequisites={[]}
        unlocks={[{ id: 'u1', name: 'Embeddings' }]}
      />,
    )
    expect(screen.getByText('Unlocks')).toBeInTheDocument()
    expect(screen.getByText('Embeddings')).toBeInTheDocument()
  })

  it('hides the prerequisites section when there are none', () => {
    render(
      <ConceptDetailPanel concept={concept} prerequisites={[]} unlocks={[]} />,
    )
    expect(screen.queryByText('Prerequisites')).not.toBeInTheDocument()
  })
})

describe('ConceptDetailPanel navigation', () => {
  const refs = [{ id: 'p1', name: 'Text Basics' }]

  it('renders prerequisites as buttons when a handler is given', () => {
    render(
      <ConceptDetailPanel
        concept={concept}
        prerequisites={refs}
        unlocks={[]}
        onSelectConcept={() => {}}
      />,
    )
    expect(
      screen.getByRole('button', { name: 'Go to Text Basics' }),
    ).toBeInTheDocument()
  })

  it('calls the handler with the concept id', async () => {
    const onSelect = vi.fn()
    const u = userEvent.setup()
    render(
      <ConceptDetailPanel
        concept={concept}
        prerequisites={refs}
        unlocks={[]}
        onSelectConcept={onSelect}
      />,
    )
    await u.click(screen.getByRole('button', { name: 'Go to Text Basics' }))
    expect(onSelect).toHaveBeenCalledWith('p1')
  })

  it('renders static badges when no handler is given', () => {
    render(
      <ConceptDetailPanel
        concept={concept}
        prerequisites={refs}
        unlocks={[]}
      />,
    )
    expect(screen.getByText('Text Basics')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Go to Text Basics' }),
    ).not.toBeInTheDocument()
  })

  it('makes unlocks clickable too', async () => {
    const onSelect = vi.fn()
    const u = userEvent.setup()
    render(
      <ConceptDetailPanel
        concept={concept}
        prerequisites={[]}
        unlocks={[{ id: 'u1', name: 'Embeddings' }]}
        onSelectConcept={onSelect}
      />,
    )
    await u.click(screen.getByRole('button', { name: 'Go to Embeddings' }))
    expect(onSelect).toHaveBeenCalledWith('u1')
  })

  it('labels each button for screen readers', () => {
    render(
      <ConceptDetailPanel
        concept={concept}
        prerequisites={refs}
        unlocks={[]}
        onSelectConcept={() => {}}
      />,
    )
    expect(
      screen.getByRole('button', { name: 'Go to Text Basics' }),
    ).toHaveAttribute('aria-label', 'Go to Text Basics')
  })
})
