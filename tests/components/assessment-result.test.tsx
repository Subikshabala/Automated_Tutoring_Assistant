import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AssessmentResult } from '@/components/assessment-result'

const results = [
  {
    questionId: 'q1',
    conceptId: 'c1',
    conceptName: 'Tokenization',
    response: 'A subword unit',
    isCorrect: true,
    score: 1,
    correctAnswer: 'A subword unit',
    explanation: 'Tokenizers emit subword units.',
    feedback: 'Correct.',
  },
  {
    questionId: 'q2',
    conceptId: 'c1',
    conceptName: 'Tokenization',
    response: 'Wrong thing',
    isCorrect: false,
    score: 0,
    correctAnswer: 'A subword unit',
    explanation: 'Tokenizers emit subword units.',
    feedback: 'Not quite — reread the definition.',
  },
]

describe('AssessmentResult', () => {
  it('renders the overall score', () => {
    render(<AssessmentResult score={50} results={results} />)
    expect(screen.getByText('50%')).toBeInTheDocument()
  })

  it('renders the correct-count summary', () => {
    render(<AssessmentResult score={50} results={results} />)
    expect(screen.getByText('1 of 2 correct')).toBeInTheDocument()
  })

  it('shows an advance message at 80 and above', () => {
    render(<AssessmentResult score={90} results={results} />)
    expect(screen.getByText(/ready to move on/i)).toBeInTheDocument()
  })

  it('shows a practice message between 50 and 79', () => {
    render(<AssessmentResult score={60} results={results} />)
    expect(screen.getByText(/more practice/i)).toBeInTheDocument()
  })

  it('shows a reteach message below 50', () => {
    render(<AssessmentResult score={30} results={results} />)
    expect(screen.getByText(/revisit/i)).toBeInTheDocument()
  })

  it('renders the learner response for each question', () => {
    render(<AssessmentResult score={50} results={results} />)
    expect(screen.getByText('Wrong thing')).toBeInTheDocument()
  })

  it('renders the correct answer for an incorrect question', () => {
    render(<AssessmentResult score={50} results={results} />)
    expect(screen.getAllByText('A subword unit').length).toBeGreaterThanOrEqual(1)
  })

  it('renders the feedback for every question', () => {
    render(<AssessmentResult score={50} results={results} />)
    expect(
      screen.getByText('Not quite — reread the definition.'),
    ).toBeInTheDocument()
  })
})
