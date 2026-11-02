import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MapComparisonView } from '@/components/map-comparison'

const comparison = {
  matchedConcepts: ['Tokenization', 'Embeddings'],
  missingConcepts: ['Attention'],
  unrecognisedNodes: ['Blockchain'],
  correctEdges: [{ from: 'Tokenization', to: 'Embeddings' }],
  missingEdges: [{ from: 'Embeddings', to: 'Attention' }],
  incorrectEdges: [{ from: 'Tokenization', to: 'Attention' }],
  mistypedEdges: [],
  score: 65,
}

const feedback = {
  summary: 'You have the pipeline but not the mechanism.',
  strengths: ['Tokenization correctly precedes embeddings.'],
  gaps: ['Attention is missing.'],
  nextStep: 'Read attention, then add it after embeddings.',
}

describe('MapComparisonView', () => {
  it('renders the score', () => {
    render(<MapComparisonView comparison={comparison} feedback={feedback} />)
    expect(screen.getByText('65')).toBeInTheDocument()
  })

  it('renders the feedback summary', () => {
    render(<MapComparisonView comparison={comparison} feedback={feedback} />)
    expect(
      screen.getByText('You have the pipeline but not the mechanism.'),
    ).toBeInTheDocument()
  })

  it('renders the next step', () => {
    render(<MapComparisonView comparison={comparison} feedback={feedback} />)
    expect(
      screen.getByText('Read attention, then add it after embeddings.'),
    ).toBeInTheDocument()
  })

  it('lists the missing concepts', () => {
    render(<MapComparisonView comparison={comparison} feedback={feedback} />)
    expect(screen.getByText('Attention')).toBeInTheDocument()
  })

  it('lists the unrecognised nodes', () => {
    render(<MapComparisonView comparison={comparison} feedback={feedback} />)
    expect(screen.getByText('Blockchain')).toBeInTheDocument()
  })

  it('renders missing connections in arrow form', () => {
    render(<MapComparisonView comparison={comparison} feedback={feedback} />)
    expect(screen.getByText('Embeddings → Attention')).toBeInTheDocument()
  })

  it('renders connections not in the course map', () => {
    render(<MapComparisonView comparison={comparison} feedback={feedback} />)
    expect(screen.getByText('Tokenization → Attention')).toBeInTheDocument()
  })

  it('omits a section that has no entries', () => {
    render(
      <MapComparisonView
        comparison={{ ...comparison, unrecognisedNodes: [] }}
        feedback={feedback}
      />,
    )
    expect(screen.queryByText('Not in this course')).not.toBeInTheDocument()
  })
})
