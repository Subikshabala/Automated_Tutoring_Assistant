import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { QuestionCard } from '@/components/question-card'
import type { QuestionDto } from '@/lib/schemas/assessment'

const mcq: QuestionDto = {
  id: 'q1',
  conceptId: 'c1',
  conceptName: 'Tokenization',
  type: 'MCQ',
  prompt: 'What is a token?',
  options: ['A subword unit', 'A whole word'],
  difficulty: 'BEGINNER',
  order: 0,
}

const short: QuestionDto = {
  ...mcq,
  id: 'q2',
  type: 'SHORT_ANSWER',
  prompt: 'Why subwords?',
  options: [],
}

describe('QuestionCard', () => {
  it('renders the prompt', () => {
    render(
      <QuestionCard question={mcq} index={0} value="" onChange={() => {}} />,
    )
    expect(screen.getByText('What is a token?')).toBeInTheDocument()
  })

  it('renders the question number', () => {
    render(
      <QuestionCard question={mcq} index={2} value="" onChange={() => {}} />,
    )
    expect(screen.getByText('Question 3')).toBeInTheDocument()
  })

  it('renders the concept name as a badge', () => {
    render(
      <QuestionCard question={mcq} index={0} value="" onChange={() => {}} />,
    )
    expect(screen.getByText('Tokenization')).toBeInTheDocument()
  })

  it('renders one radio per MCQ option', () => {
    render(
      <QuestionCard question={mcq} index={0} value="" onChange={() => {}} />,
    )
    expect(screen.getAllByRole('radio')).toHaveLength(2)
  })

  it('calls onChange with the chosen option', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(
      <QuestionCard question={mcq} index={0} value="" onChange={onChange} />,
    )
    await user.click(screen.getByText('A subword unit'))
    expect(onChange).toHaveBeenCalled()
    expect(onChange.mock.calls[0][0]).toBe('A subword unit')
  })

  it('renders a textarea for a short answer question', () => {
    render(
      <QuestionCard question={short} index={0} value="" onChange={() => {}} />,
    )
    expect(screen.getByRole('textbox')).toBeInTheDocument()
    expect(screen.queryAllByRole('radio')).toHaveLength(0)
  })

  it('calls onChange as the learner types a short answer', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(
      <QuestionCard question={short} index={0} value="" onChange={onChange} />,
    )
    await user.type(screen.getByRole('textbox'), 'x')
    expect(onChange).toHaveBeenCalledWith('x')
  })
})
