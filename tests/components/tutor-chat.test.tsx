import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TutorChat } from '@/components/tutor-chat'

function mockOk(data: unknown) {
  global.fetch = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ data }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  )
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('TutorChat', () => {
  it('shows a prompt when the conversation is empty', () => {
    render(<TutorChat conceptId="x1" conceptName="Tokenization" />)
    expect(screen.getByText(/Ask anything about Tokenization/)).toBeInTheDocument()
  })

  it('renders the learner message after submit', async () => {
    mockOk({ answer: 'Because subwords generalise.', relatedConcepts: [], followUpQuestion: null })
    const user = userEvent.setup()
    render(<TutorChat conceptId="x1" conceptName="Tokenization" />)

    await user.type(screen.getByRole('textbox'), 'Why subwords?')
    await user.click(screen.getByRole('button', { name: /send/i }))

    expect(await screen.findByText('Why subwords?')).toBeInTheDocument()
  })

  it('renders the tutor answer', async () => {
    mockOk({ answer: 'Because subwords generalise.', relatedConcepts: [], followUpQuestion: null })
    const user = userEvent.setup()
    render(<TutorChat conceptId="x1" conceptName="Tokenization" />)

    await user.type(screen.getByRole('textbox'), 'Why subwords?')
    await user.click(screen.getByRole('button', { name: /send/i }))

    expect(
      await screen.findByText('Because subwords generalise.'),
    ).toBeInTheDocument()
  })

  it('clears the input after a successful send', async () => {
    mockOk({ answer: 'ok', relatedConcepts: [], followUpQuestion: null })
    const user = userEvent.setup()
    render(<TutorChat conceptId="x1" conceptName="Tokenization" />)

    const input = screen.getByRole('textbox')
    await user.type(input, 'Why subwords?')
    await user.click(screen.getByRole('button', { name: /send/i }))

    await waitFor(() => expect(input).toHaveValue(''))
  })

  it('shows an error when the request fails', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ error: { code: 'AI_UNAVAILABLE', message: 'AI is down' } }),
        { status: 503, headers: { 'Content-Type': 'application/json' } },
      ),
    )
    const user = userEvent.setup()
    render(<TutorChat conceptId="x1" conceptName="Tokenization" />)

    await user.type(screen.getByRole('textbox'), 'Why?')
    await user.click(screen.getByRole('button', { name: /send/i }))

    expect(await screen.findByText('AI is down')).toBeInTheDocument()
  })

  it('does not send an empty question', async () => {
    const fetchSpy = vi.fn()
    global.fetch = fetchSpy
    const user = userEvent.setup()
    render(<TutorChat conceptId="x1" conceptName="Tokenization" />)

    await user.click(screen.getByRole('button', { name: /send/i }))
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
