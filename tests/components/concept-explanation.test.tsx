import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ConceptExplanationCard } from '@/components/concept-explanation'

const explanation = {
  title: 'Tokenization',
  simpleExplanation: 'Models split text into tokens.',
  whyItMatters: 'Token count drives cost and context limits.',
  example: 'The word "tokenization" splits into "token" and "ization".',
  keyPoints: ['Tokens are subwords', 'Cost scales with tokens'],
  checkQuestion: 'Why do models not operate on whole words?',
}

describe('ConceptExplanationCard', () => {
  it('renders the title', () => {
    render(<ConceptExplanationCard explanation={explanation} />)
    expect(screen.getByText('Tokenization')).toBeInTheDocument()
  })

  it('renders the simple explanation', () => {
    render(<ConceptExplanationCard explanation={explanation} />)
    expect(
      screen.getByText('Models split text into tokens.'),
    ).toBeInTheDocument()
  })

  it('renders the why-it-matters section', () => {
    render(<ConceptExplanationCard explanation={explanation} />)
    expect(screen.getByText('Why it matters')).toBeInTheDocument()
    expect(
      screen.getByText('Token count drives cost and context limits.'),
    ).toBeInTheDocument()
  })

  it('renders the example', () => {
    render(<ConceptExplanationCard explanation={explanation} />)
    expect(screen.getByText('Example')).toBeInTheDocument()
  })

  it('renders every key point', () => {
    render(<ConceptExplanationCard explanation={explanation} />)
    expect(screen.getByText('Tokens are subwords')).toBeInTheDocument()
    expect(screen.getByText('Cost scales with tokens')).toBeInTheDocument()
  })

  it('renders the check question', () => {
    render(<ConceptExplanationCard explanation={explanation} />)
    expect(
      screen.getByText('Why do models not operate on whole words?'),
    ).toBeInTheDocument()
  })
})
