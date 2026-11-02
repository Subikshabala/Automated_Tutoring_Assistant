import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ConceptNode } from '@/components/concept-node'

vi.mock('@xyflow/react', () => ({
  Handle: () => null,
  Position: { Left: 'left', Right: 'right' },
}))

const concept = {
  id: 'x1',
  courseId: 'c1',
  name: 'Tokenization',
  definition: 'Splitting text into tokens so a model can process it.',
  difficulty: 'BEGINNER' as const,
  objectives: ['Explain subwords'],
}

describe('ConceptNode', () => {
  it('renders the concept name', () => {
    render(<ConceptNode data={{ concept }} selected={false} />)
    expect(screen.getByText('Tokenization')).toBeInTheDocument()
  })

  it('renders a truncated definition', () => {
    render(<ConceptNode data={{ concept }} selected={false} />)
    expect(
      screen.getByText(/Splitting text into tokens/),
    ).toBeInTheDocument()
  })

  it('marks the node as selected for styling', () => {
    const { container } = render(
      <ConceptNode data={{ concept }} selected={true} />,
    )
    expect(container.firstChild).toHaveAttribute('data-selected', 'true')
  })

  it('exposes the difficulty as a data attribute', () => {
    const { container } = render(
      <ConceptNode data={{ concept }} selected={false} />,
    )
    expect(container.firstChild).toHaveAttribute('data-difficulty', 'BEGINNER')
  })

  it('is reachable by keyboard', () => {
    const { container } = render(<ConceptNode data={{ concept }} selected={false} />)
    expect(container.firstChild).toHaveAttribute('tabIndex', '0')
  })

  it('announces its state', () => {
    const { container } = render(<ConceptNode data={{ concept }} selected={true} />)
    expect(container.firstChild).toHaveAttribute('aria-pressed', 'true')
  })

  it('describes itself for screen readers', () => {
    const { container } = render(<ConceptNode data={{ concept }} selected={false} />)
    expect(container.firstChild).toHaveAttribute(
      'aria-label',
      expect.stringContaining('Tokenization'),
    )
  })
})
