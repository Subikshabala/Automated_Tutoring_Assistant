import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { CourseCurriculum } from '@/components/course-curriculum'
import type { ModuleSummary } from '@/lib/schemas/course'

const modules: ModuleSummary[] = [
  {
    id: 'm1',
    title: 'Agent Architecture',
    description: 'The loop, the tools, and the state.',
    order: 0,
    topics: [
      { id: 't1', title: 'The Agent Loop', description: 'Perceive, decide, act.', order: 0, conceptCount: 3 },
      { id: 't2', title: 'Planning and Control', description: 'Decomposing goals.', order: 1, conceptCount: 3 },
    ],
  },
  {
    id: 'm2',
    title: 'Multi-Agent Systems',
    description: 'When one agent is not the right shape.',
    order: 1,
    topics: [
      { id: 't3', title: 'Coordination', description: 'Splitting work.', order: 0, conceptCount: 2 },
    ],
  },
]

describe('CourseCurriculum', () => {
  it('renders every module title', () => {
    render(<CourseCurriculum courseSlug="ai-agents" modules={modules} />)
    expect(screen.getByText('Agent Architecture')).toBeInTheDocument()
    expect(screen.getByText('Multi-Agent Systems')).toBeInTheDocument()
  })

  it('numbers the modules', () => {
    render(<CourseCurriculum courseSlug="ai-agents" modules={modules} />)
    expect(screen.getByText('01')).toBeInTheDocument()
    expect(screen.getByText('02')).toBeInTheDocument()
  })

  it('opens the first module by default', () => {
    render(<CourseCurriculum courseSlug="ai-agents" modules={modules} />)
    expect(screen.getByText('The Agent Loop')).toBeVisible()
  })

  it('leaves later modules collapsed', () => {
    render(<CourseCurriculum courseSlug="ai-agents" modules={modules} />)
    // Base UI removes collapsed panel content from the DOM by default
    expect(screen.queryByText('Coordination')).not.toBeInTheDocument()
  })

  it('expands a module on click', async () => {
    const u = userEvent.setup()
    render(<CourseCurriculum courseSlug="ai-agents" modules={modules} />)
    await u.click(screen.getByRole('button', { name: /Multi-Agent Systems/ }))
    expect(await screen.findByText('Coordination')).toBeVisible()
  })

  it('shows a topic count on the collapsed header', () => {
    render(<CourseCurriculum courseSlug="ai-agents" modules={modules} />)
    expect(screen.getByText('1 topic')).toBeInTheDocument()
    expect(screen.getByText('2 topics')).toBeInTheDocument()
  })

  it('shows a concept count per module header', () => {
    render(<CourseCurriculum courseSlug="ai-agents" modules={modules} />)
    // Module 1 has 3 + 3, module 2 has 2.
    expect(screen.getByText('6 concepts')).toBeInTheDocument()
    expect(screen.getByText('2 concepts')).toBeInTheDocument()
  })

  it('links each topic to its learn page', () => {
    render(<CourseCurriculum courseSlug="ai-agents" modules={modules} />)
    expect(screen.getByRole('link', { name: /The Agent Loop/ })).toHaveAttribute(
      'href',
      '/learn/ai-agents/t1',
    )
  })

  it('renders an empty state for a course with no modules', () => {
    render(<CourseCurriculum courseSlug="ai-agents" modules={[]} />)
    expect(screen.getByText('No curriculum yet')).toBeInTheDocument()
  })

  it('keeps an open module open when another is opened', async () => {
    const u = userEvent.setup()
    render(<CourseCurriculum courseSlug="ai-agents" modules={modules} />)
    await u.click(screen.getByRole('button', { name: /Multi-Agent Systems/ }))
    expect(screen.getByText('The Agent Loop')).toBeVisible()
    expect(screen.getByText('Coordination')).toBeVisible()
  })
})
