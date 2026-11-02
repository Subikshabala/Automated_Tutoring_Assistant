import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LearnView, type LearnViewProps } from '@/components/learn-view'
import type { ConceptExplanation } from '@/lib/schemas/ai'

// React Flow needs a real layout engine; stub it and expose the controlled props
// so the selection contract between the map and the view can still be asserted.
vi.mock('@xyflow/react', () => ({
  ReactFlow: () => null,
  Background: () => null,
  Controls: () => null,
  MiniMap: () => null,
  Handle: () => null,
  Position: { Left: 'left', Right: 'right' },
}))

vi.mock('@/components/concept-map-canvas', async () => {
  const actual = await vi.importActual<
    typeof import('@/components/concept-map-canvas')
  >('@/components/concept-map-canvas')
  return {
    ...actual,
    ConceptMapCanvas: ({
      selectedId,
      onSelectConcept,
    }: {
      selectedId?: string | null
      onSelectConcept?: (id: string) => void
    }) => (
      <div data-testid="concept-map" data-selected={selectedId ?? ''}>
        <button
          type="button"
          onClick={() => onSelectConcept?.('c2')}
        >
          map-select-embeddings
        </button>
      </div>
    ),
  }
})

vi.mock('@/components/start-assessment-button', () => ({
  StartAssessmentButton: ({ topicId }: { topicId: string }) => (
    <button type="button">start-assessment-{topicId}</button>
  ),
}))

vi.mock('@/components/tutor-chat', () => ({
  TutorChat: ({ conceptId }: { conceptId: string }) => (
    <div data-testid="tutor-chat">chat-{conceptId}</div>
  ),
}))

const explanation: ConceptExplanation = {
  title: 'Tokenization',
  simpleExplanation: 'Models split text into tokens.',
  whyItMatters: 'Token count drives cost.',
  example: '"tokenization" splits into "token" and "ization".',
  keyPoints: ['Tokens are subwords', 'Cost scales with tokens'],
  checkQuestion: 'Why not whole words?',
}

const embeddingsExplanation: ConceptExplanation = {
  ...explanation,
  title: 'Embeddings',
  simpleExplanation: 'Dense vectors encode meaning.',
}

const topic: LearnViewProps['topic'] = {
  id: 't1',
  title: 'Text Representation',
  description: 'How raw text becomes numbers a model can compute over.',
  courseTitle: 'Generative AI Foundations',
  courseSlug: 'generative-ai',
  moduleTitle: 'How Language Models Work',
  concepts: [
    {
      id: 'c1',
      courseId: 'course1',
      name: 'Tokenization',
      definition: 'Splitting text into tokens.',
      difficulty: 'BEGINNER',
      objectives: ['Explain why models use subwords'],
    },
    {
      id: 'c2',
      courseId: 'course1',
      name: 'Embeddings',
      definition: 'Dense vector representations of tokens.',
      difficulty: 'INTERMEDIATE',
      objectives: ['Explain embedding similarity'],
    },
  ],
  relationships: [
    {
      id: 'r1',
      fromId: 'c1',
      toId: 'c2',
      type: 'PREREQUISITE_OF',
      strength: 1,
    },
  ],
}

function renderView(overrides: Partial<LearnViewProps> = {}) {
  return render(
    <LearnView
      topic={topic}
      initialConceptId="c1"
      initialExplanation={explanation}
      {...overrides}
    />,
  )
}

function mockExplainOk(payload: ConceptExplanation) {
  global.fetch = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ data: { explanation: payload, cached: false } }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  )
}

beforeEach(() => {
  global.fetch = vi.fn()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('LearnView module introduction', () => {
  it('renders the topic title', () => {
    renderView()
    expect(screen.getByText('Text Representation')).toBeInTheDocument()
  })

  it('renders the module title badge', () => {
    renderView()
    expect(screen.getByText('How Language Models Work')).toBeInTheDocument()
  })

  it('renders the topic description', () => {
    renderView()
    expect(
      screen.getByText(
        'How raw text becomes numbers a model can compute over.',
      ),
    ).toBeInTheDocument()
  })

  it('renders a concept count badge', () => {
    renderView()
    expect(screen.getByText('2 concepts')).toBeInTheDocument()
  })

  it('singularises the count for a one-concept topic', () => {
    renderView({
      topic: { ...topic, concepts: [topic.concepts[0]], relationships: [] },
    })
    expect(screen.getByText('1 concept')).toBeInTheDocument()
  })

  it('lists the learning objectives of every concept', () => {
    renderView()
    expect(
      screen.getAllByText('Explain why models use subwords').length,
    ).toBeGreaterThan(0)
    expect(
      screen.getAllByText('Explain embedding similarity').length,
    ).toBeGreaterThan(0)
  })

  it('deduplicates an objective shared by two concepts', () => {
    const shared = 'Shared objective across concepts'
    renderView({
      topic: {
        ...topic,
        concepts: [
          { ...topic.concepts[0], objectives: [shared] },
          { ...topic.concepts[1], objectives: [shared] },
        ],
      },
    })
    // The summary list dedupes; only the per-concept panel repeats it.
    expect(screen.getAllByText(shared)).toHaveLength(2)
  })

  it('renders a selector chip per concept', () => {
    renderView()
    expect(
      screen.getByRole('button', { name: 'TokenizationBeginner' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'EmbeddingsIntermediate' }),
    ).toBeInTheDocument()
  })
})

describe('LearnView initial state', () => {
  it('shows the initial concept as selected', () => {
    renderView()
    expect(screen.getByTestId('concept-map')).toHaveAttribute(
      'data-selected',
      'c1',
    )
  })

  it('renders the server-provided explanation without fetching', () => {
    renderView()
    expect(
      screen.getByText('Models split text into tokens.'),
    ).toBeInTheDocument()
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('falls back to the first concept when no initial id is given', () => {
    renderView({ initialConceptId: undefined })
    expect(screen.getByTestId('concept-map')).toHaveAttribute(
      'data-selected',
      'c1',
    )
  })

  it('wires the tutor chat to the selected concept', () => {
    renderView()
    expect(screen.getByTestId('tutor-chat')).toHaveTextContent('chat-c1')
  })
})

describe('LearnView concept selection', () => {
  it('fetches the explanation when a new concept is chosen', async () => {
    mockExplainOk(embeddingsExplanation)
    const user = userEvent.setup()
    renderView()

    await user.click(screen.getByRole('button', { name: 'EmbeddingsIntermediate' }))

    await waitFor(() => expect(global.fetch).toHaveBeenCalledOnce())
    const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(url).toBe('/api/ai/explain')
    expect(init.body).toBe(JSON.stringify({ conceptId: 'c2' }))
  })

  it('renders the newly fetched explanation', async () => {
    mockExplainOk(embeddingsExplanation)
    const user = userEvent.setup()
    renderView()

    await user.click(screen.getByRole('button', { name: 'EmbeddingsIntermediate' }))

    expect(
      await screen.findByText('Dense vectors encode meaning.'),
    ).toBeInTheDocument()
  })

  it('does not refetch an explanation it already holds', async () => {
    mockExplainOk(embeddingsExplanation)
    const user = userEvent.setup()
    renderView()

    await user.click(screen.getByRole('button', { name: 'EmbeddingsIntermediate' }))
    await waitFor(() => expect(global.fetch).toHaveBeenCalledOnce())

    await user.click(screen.getByRole('button', { name: 'TokenizationBeginner' }))
    await user.click(screen.getByRole('button', { name: 'EmbeddingsIntermediate' }))

    expect(global.fetch).toHaveBeenCalledOnce()
  })

  it('selects a concept when the map reports a click', async () => {
    mockExplainOk(embeddingsExplanation)
    const user = userEvent.setup()
    renderView()

    await user.click(
      screen.getByRole('button', { name: 'map-select-embeddings' }),
    )

    await waitFor(() =>
      expect(screen.getByTestId('concept-map')).toHaveAttribute(
        'data-selected',
        'c2',
      ),
    )
  })
})

describe('LearnView relationships', () => {
  it('renders the prerequisite of the selected concept', async () => {
    mockExplainOk(embeddingsExplanation)
    const user = userEvent.setup()
    renderView()

    await user.click(screen.getByRole('button', { name: 'EmbeddingsIntermediate' }))

    expect(await screen.findByText('Prerequisites')).toBeInTheDocument()
  })

  it('renders what the selected concept unlocks', () => {
    renderView()
    expect(screen.getByText('Unlocks')).toBeInTheDocument()
  })

  it('hides both sections when the topic has no relationships', () => {
    renderView({ topic: { ...topic, relationships: [] } })
    expect(screen.queryByText('Prerequisites')).not.toBeInTheDocument()
    expect(screen.queryByText('Unlocks')).not.toBeInTheDocument()
  })
})

describe('LearnView explanation failure', () => {
  it('shows an error and a retry control when the fetch fails', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: { code: 'AI_UNAVAILABLE', message: 'The AI is down' },
        }),
        { status: 503, headers: { 'Content-Type': 'application/json' } },
      ),
    )
    const user = userEvent.setup()
    renderView()

    await user.click(screen.getByRole('button', { name: 'EmbeddingsIntermediate' }))

    expect(await screen.findByText('The AI is down')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Retry loading explanation/ }),
    ).toBeInTheDocument()
  })

  it('refetches when retry is clicked', async () => {
    const failing = new Response(
      JSON.stringify({
        error: { code: 'AI_UNAVAILABLE', message: 'The AI is down' },
      }),
      { status: 503, headers: { 'Content-Type': 'application/json' } },
    )
    global.fetch = vi.fn().mockResolvedValueOnce(failing)

    const user = userEvent.setup()
    renderView()

    await user.click(screen.getByRole('button', { name: 'EmbeddingsIntermediate' }))
    await screen.findByText('The AI is down')

    mockExplainOk(embeddingsExplanation)
    await user.click(
      screen.getByRole('button', { name: /Retry loading explanation/ }),
    )

    expect(
      await screen.findByText('Dense vectors encode meaning.'),
    ).toBeInTheDocument()
  })
})

describe('LearnView assessment handoff', () => {
  it('renders the start assessment button for the topic', () => {
    renderView()
    expect(screen.getByText('start-assessment-t1')).toBeInTheDocument()
  })
})
