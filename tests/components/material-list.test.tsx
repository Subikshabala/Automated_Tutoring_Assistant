import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MaterialList } from '@/components/material-list'
import type { MaterialSummary } from '@/lib/schemas/material'

const ready: MaterialSummary = {
  id: 'm1',
  filename: 'lecture-notes.pdf',
  mimeType: 'application/pdf',
  sizeBytes: 524288,
  status: 'READY',
  chunkCount: 12,
  error: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  suggestions: '',
}

describe('MaterialList', () => {
  it('renders an empty state when there are no materials', () => {
    render(<MaterialList materials={[]} />)
    expect(screen.getByText('No documents yet')).toBeInTheDocument()
  })

  it('renders the filename', () => {
    render(<MaterialList materials={[ready]} />)
    expect(screen.getByText('lecture-notes.pdf')).toBeInTheDocument()
  })

  it('renders a human readable size', () => {
    render(<MaterialList materials={[ready]} />)
    expect(screen.getByText(/512 KB/)).toBeInTheDocument()
  })

  it('renders the chunk count for a ready document', () => {
    render(<MaterialList materials={[ready]} />)
    expect(screen.getByText(/12 sections/)).toBeInTheDocument()
  })

  it('links a ready document to its detail page', () => {
    render(<MaterialList materials={[ready]} />)
    expect(screen.getByRole('link')).toHaveAttribute('href', '/materials/m1')
  })

  it('shows the error message for a failed document', () => {
    render(
      <MaterialList
        materials={[
          { ...ready, status: 'FAILED', error: 'Scanned images only', chunkCount: 0 },
        ]}
      />,
    )
    expect(screen.getByText('Scanned images only')).toBeInTheDocument()
  })

  it('does not link a failed document', () => {
    render(
      <MaterialList
        materials={[{ ...ready, status: 'FAILED', error: 'x', chunkCount: 0 }]}
      />,
    )
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })
})
