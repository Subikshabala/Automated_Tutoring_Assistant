import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ConceptPalette } from '@/components/concept-palette'

const palette = [
  { name: 'Tokenization', difficulty: 'BEGINNER' as const },
  { name: 'Embeddings', difficulty: 'BEGINNER' as const },
  { name: 'Attention', difficulty: 'INTERMEDIATE' as const },
]

describe('ConceptPalette', () => {
  it('renders one chip per concept', () => {
    render(<ConceptPalette concepts={palette} usedLabels={[]} onAdd={() => {}} />)
    expect(screen.getByRole('button', { name: /Tokenization/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Attention/ })).toBeInTheDocument()
  })

  it('calls onAdd with the concept name', async () => {
    const onAdd = vi.fn()
    const u = userEvent.setup()
    render(<ConceptPalette concepts={palette} usedLabels={[]} onAdd={onAdd} />)
    await u.click(screen.getByRole('button', { name: /Tokenization/ }))
    expect(onAdd).toHaveBeenCalledWith('Tokenization')
  })

  it('disables a concept already on the canvas', () => {
    render(
      <ConceptPalette concepts={palette} usedLabels={['Tokenization']} onAdd={() => {}} />,
    )
    expect(screen.getByRole('button', { name: /Tokenization/ })).toBeDisabled()
  })

  it('matches used labels case-insensitively', () => {
    render(
      <ConceptPalette concepts={palette} usedLabels={['tokenization']} onAdd={() => {}} />,
    )
    expect(screen.getByRole('button', { name: /Tokenization/ })).toBeDisabled()
  })

  it('leaves unused concepts enabled', () => {
    render(
      <ConceptPalette concepts={palette} usedLabels={['Tokenization']} onAdd={() => {}} />,
    )
    expect(screen.getByRole('button', { name: /Embeddings/ })).toBeEnabled()
  })

  it('reports how many are placed', () => {
    render(
      <ConceptPalette concepts={palette} usedLabels={['Tokenization']} onAdd={() => {}} />,
    )
    expect(screen.getByText('1 of 3 placed')).toBeInTheDocument()
  })

  it('renders nothing when the palette is empty', () => {
    const { container } = render(
      <ConceptPalette concepts={[]} usedLabels={[]} onAdd={() => {}} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('can be hidden to test recall from memory', async () => {
    const u = userEvent.setup()
    render(<ConceptPalette concepts={palette} usedLabels={[]} onAdd={() => {}} />)
    await u.click(screen.getByRole('button', { name: /Hide/ }))
    expect(screen.queryByRole('button', { name: /Tokenization/ })).not.toBeInTheDocument()
  })

  it('does not fire onAdd for a disabled concept', async () => {
    const onAdd = vi.fn()
    const u = userEvent.setup()
    render(
      <ConceptPalette concepts={palette} usedLabels={['Tokenization']} onAdd={onAdd} />,
    )
    await u.click(screen.getByRole('button', { name: /Tokenization/ }))
    expect(onAdd).not.toHaveBeenCalled()
  })
})
