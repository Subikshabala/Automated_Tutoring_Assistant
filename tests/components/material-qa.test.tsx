import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MaterialQa } from '@/components/material-qa'

function mockAnswer(data: unknown) {
  global.fetch = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ data }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  )
}

const grounded = {
  answer: { answer: 'It splits text into subword units.', foundInMaterial: true, quotedPassages: ['Tokenization splits text.'] },
  sources: [{ id: 'c1', content: 'Tokenization splits text into subword units.', order: 0, score: 0.8, keywordScore: 0.9, semanticScore: 0.7, viaFallback: false }],
}

beforeEach(() => { global.fetch = vi.fn() })
afterEach(() => { vi.restoreAllMocks() })

describe('MaterialQa initial state', () => {
  it('renders the question input', () => {
    render(<MaterialQa materialId="m1" filename="notes.txt" suggestions={[]} />)
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('renders suggestion chips when provided', () => {
    render(<MaterialQa materialId="m1" filename="n.txt" suggestions={['What is tokenization?', 'Why subwords?']} />)
    expect(screen.getByRole('button', { name: 'What is tokenization?' })).toBeInTheDocument()
  })

  it('omits the suggestion row when there are none', () => {
    render(<MaterialQa materialId="m1" filename="n.txt" suggestions={[]} />)
    expect(screen.queryByText('Try asking')).not.toBeInTheDocument()
  })

  it('asks immediately when a suggestion is clicked', async () => {
    mockAnswer(grounded)
    const u = userEvent.setup()
    render(<MaterialQa materialId="m1" filename="n.txt" suggestions={['Why subwords?']} />)
    await u.click(screen.getByRole('button', { name: 'Why subwords?' }))
    await waitFor(() => expect(global.fetch).toHaveBeenCalled())
  })
})

describe('MaterialQa answering', () => {
  it('renders the question and the answer', async () => {
    mockAnswer(grounded)
    const u = userEvent.setup()
    render(<MaterialQa materialId="m1" filename="n.txt" suggestions={[]} />)
    await u.type(screen.getByRole('textbox'), 'What is tokenization?')
    await u.click(screen.getByRole('button', { name: /Ask/ }))
    expect(await screen.findByText('What is tokenization?')).toBeInTheDocument()
    expect(await screen.findByText('It splits text into subword units.')).toBeInTheDocument()
  })

  it('keeps earlier exchanges in history', async () => {
    mockAnswer(grounded)
    const u = userEvent.setup()
    render(<MaterialQa materialId="m1" filename="n.txt" suggestions={[]} />)
    await u.type(screen.getByRole('textbox'), 'First question?')
    await u.click(screen.getByRole('button', { name: /Ask/ }))
    await screen.findByText('First question?')
    // Re-mock for second call
    mockAnswer(grounded)
    await u.type(screen.getByRole('textbox'), 'Second question?')
    await u.click(screen.getByRole('button', { name: /Ask/ }))
    await screen.findByText('Second question?')
    expect(screen.getByText('First question?')).toBeInTheDocument()
  })

  it('clears the input after asking', async () => {
    mockAnswer(grounded)
    const u = userEvent.setup()
    render(<MaterialQa materialId="m1" filename="n.txt" suggestions={[]} />)
    const input = screen.getByRole('textbox')
    await u.type(input, 'Question?')
    await u.click(screen.getByRole('button', { name: /Ask/ }))
    await waitFor(() => expect(input).toHaveValue(''))
  })

  it('shows the supporting passage', async () => {
    mockAnswer(grounded)
    const u = userEvent.setup()
    render(<MaterialQa materialId="m1" filename="n.txt" suggestions={[]} />)
    await u.type(screen.getByRole('textbox'), 'q')
    await u.click(screen.getByRole('button', { name: /Ask/ }))
    expect(await screen.findByText('Tokenization splits text.')).toBeInTheDocument()
  })

  it('marks an answer the document does not cover', async () => {
    mockAnswer({
      answer: { answer: 'Not covered here.', foundInMaterial: false, quotedPassages: [] },
      sources: [],
    })
    const u = userEvent.setup()
    render(<MaterialQa materialId="m1" filename="n.txt" suggestions={[]} />)
    await u.type(screen.getByRole('textbox'), 'capital of France?')
    await u.click(screen.getByRole('button', { name: /Ask/ }))
    expect(await screen.findByText('Not in this document')).toBeInTheDocument()
  })

  it('flags a weak retrieval match', async () => {
    mockAnswer({
      answer: { answer: 'Possibly related.', foundInMaterial: true, quotedPassages: [] },
      sources: [{ id: 'c1', content: 'x', order: 0, score: 0.05, keywordScore: 0, semanticScore: 0.05, viaFallback: true }],
    })
    const u = userEvent.setup()
    render(<MaterialQa materialId="m1" filename="n.txt" suggestions={[]} />)
    await u.type(screen.getByRole('textbox'), 'vague')
    await u.click(screen.getByRole('button', { name: /Ask/ }))
    expect(await screen.findByText(/No close match/)).toBeInTheDocument()
  })

  it('shows the server error', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { code: 'AI_UNAVAILABLE', message: 'AI is down' } }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }),
    )
    const u = userEvent.setup()
    render(<MaterialQa materialId="m1" filename="n.txt" suggestions={[]} />)
    await u.type(screen.getByRole('textbox'), 'q')
    await u.click(screen.getByRole('button', { name: /Ask/ }))
    expect(await screen.findByText('AI is down')).toBeInTheDocument()
  })

  it('does not submit an empty question', async () => {
    const spy = vi.fn()
    global.fetch = spy
    const u = userEvent.setup()
    render(<MaterialQa materialId="m1" filename="n.txt" suggestions={[]} />)
    await u.click(screen.getByRole('button', { name: /Ask/ }))
    expect(spy).not.toHaveBeenCalled()
  })
})
