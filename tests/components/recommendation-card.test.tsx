import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { RecommendationCard } from '@/components/recommendation-card'
import type { Recommendation } from '@/lib/schemas/recommendation'

const base: Recommendation = {
  conceptId: 'c1',
  conceptName: 'Attention',
  courseSlug: 'generative-ai',
  topicId: 't1',
  action: 'LEARN',
  situation: 'READY',
  reason: 'Attention is open. Its prerequisites are covered.',
  priority: 50,
  masteryScore: 0,
  unlocks: [],
  prerequisites: [],
}

describe('RecommendationCard', () => {
  it('renders the concept name', () => {
    render(<RecommendationCard recommendation={base} />)
    expect(screen.getByText('Attention')).toBeInTheDocument()
  })

  it('renders the reason', () => {
    render(<RecommendationCard recommendation={base} />)
    expect(
      screen.getByText(
        'Attention is open. Its prerequisites are covered.',
      ),
    ).toBeInTheDocument()
  })

  it('renders a Ready label for a READY situation', () => {
    render(<RecommendationCard recommendation={base} />)
    expect(screen.getByText('Ready')).toBeInTheDocument()
  })

  it('renders an Almost there label for a NEARLY_THERE situation', () => {
    render(
      <RecommendationCard
        recommendation={{ ...base, action: 'PRACTISE', situation: 'NEARLY_THERE', masteryScore: 70 }}
      />,
    )
    expect(screen.getByText('Almost there')).toBeInTheDocument()
  })

  it('renders a Revisit label for a FOUNDATIONAL_GAP situation', () => {
    render(
      <RecommendationCard
        recommendation={{ ...base, action: 'REVIEW', situation: 'FOUNDATIONAL_GAP', masteryScore: 30 }}
      />,
    )
    expect(screen.getByText('Revisit')).toBeInTheDocument()
  })

  it('links to the learn page when a topicId is present', () => {
    render(<RecommendationCard recommendation={base} />)
    expect(screen.getByRole('link')).toHaveAttribute(
      'href',
      '/learn/generative-ai/t1',
    )
  })

  it('links to the course page when there is no topicId', () => {
    render(<RecommendationCard recommendation={{ ...base, topicId: null }} />)
    expect(screen.getByRole('link')).toHaveAttribute(
      'href',
      '/courses/generative-ai',
    )
  })

  it('shows the current mastery score for a started concept', () => {
    render(
      <RecommendationCard
        recommendation={{ ...base, action: 'PRACTISE', situation: 'NEARLY_THERE', masteryScore: 70 }}
      />,
    )
    expect(screen.getByText('70')).toBeInTheDocument()
  })

  it('hides the score for an unstarted concept', () => {
    render(<RecommendationCard recommendation={base} />)
    expect(screen.queryByText('0')).not.toBeInTheDocument()
  })
})
