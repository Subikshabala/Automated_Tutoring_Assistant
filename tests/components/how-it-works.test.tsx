import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { HowItWorks } from '@/components/how-it-works'

vi.mock('@/hooks/use-scroll-progress', () => ({
  useScrollProgress: () => ({ ref: { current: null }, progress: 0.5 }),
}))

const steps = [
  { title: 'Assess', description: 'A short diagnostic finds where your understanding stops.' },
  { title: 'Learn', description: 'The tutor explains the next concept in prerequisite order.' },
  { title: 'Prove it', description: 'Short answers are graded on understanding.' },
  { title: 'Adapt', description: 'Your mastery scores reshape what comes next.' },
]

describe('HowItWorks', () => {
  it('renders the section heading', () => {
    render(<HowItWorks steps={steps} />)
    expect(screen.getByText('How it works')).toBeInTheDocument()
  })

  it('renders every step title', () => {
    render(<HowItWorks steps={steps} />)
    for (const s of steps) {
      expect(screen.getByText(s.title)).toBeInTheDocument()
    }
  })

  it('numbers the steps from one', () => {
    render(<HowItWorks steps={steps} />)
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('4')).toBeInTheDocument()
  })

  it('renders a connector track', () => {
    render(<HowItWorks steps={steps} />)
    expect(screen.getByTestId('step-track')).toBeInTheDocument()
  })

  it('scales the fill to reported progress', () => {
    render(<HowItWorks steps={steps} />)
    const fill = screen.getByTestId('step-fill')
    expect(fill).toHaveStyle({ transform: 'scaleX(0.5)' })
  })

  it('marks steps the fill has reached', () => {
    render(<HowItWorks steps={steps} />)
    // progress 0.5 of 4 steps reaches steps 1 and 2.
    expect(screen.getByTestId('step-marker-0')).toHaveAttribute('data-reached', 'true')
    expect(screen.getByTestId('step-marker-3')).toHaveAttribute('data-reached', 'false')
  })

  it('hides the connector from assistive tech', () => {
    render(<HowItWorks steps={steps} />)
    expect(screen.getByTestId('step-track')).toHaveAttribute('aria-hidden', 'true')
  })

  it('renders an ordered list for semantics', () => {
    render(<HowItWorks steps={steps} />)
    expect(screen.getByRole('list')).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(4)
  })
})
