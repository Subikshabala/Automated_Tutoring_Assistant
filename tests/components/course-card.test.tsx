import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CourseCard } from '@/components/course-card'
import type { CourseSummary } from '@/lib/schemas/course'

const course: CourseSummary = {
  id: 'c1',
  slug: 'generative-ai',
  title: 'Generative AI Foundations',
  description: 'Understand how modern language models work.',
  category: 'Artificial Intelligence',
  difficulty: 'BEGINNER',
  estimatedHours: 8,
  moduleCount: 2,
  conceptCount: 11,
}

describe('CourseCard', () => {
  it('renders the title and description', () => {
    render(<CourseCard course={course} />)
    expect(screen.getByText('Generative AI Foundations')).toBeInTheDocument()
    expect(
      screen.getByText('Understand how modern language models work.'),
    ).toBeInTheDocument()
  })

  it('renders the difficulty badge', () => {
    render(<CourseCard course={course} />)
    expect(screen.getByText('Beginner')).toBeInTheDocument()
  })

  it('renders module, concept and hour counts', () => {
    render(<CourseCard course={course} />)
    expect(screen.getByText('2 modules')).toBeInTheDocument()
    expect(screen.getByText('11 concepts')).toBeInTheDocument()
    expect(screen.getByText('8h')).toBeInTheDocument()
  })

  it('links to the course detail page', () => {
    render(<CourseCard course={course} />)
    expect(screen.getByRole('link')).toHaveAttribute(
      'href',
      '/courses/generative-ai',
    )
  })

  it('singularises a one-module course', () => {
    render(<CourseCard course={{ ...course, moduleCount: 1 }} />)
    expect(screen.getByText('1 module')).toBeInTheDocument()
  })
})
