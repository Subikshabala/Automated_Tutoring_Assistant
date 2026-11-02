import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { CourseFilters } from '@/components/course-filters'

const replace = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  usePathname: () => '/explore',
  useSearchParams: () => new URLSearchParams(''),
}))

describe('CourseFilters', () => {
  it('renders an All chip plus one chip per category', () => {
    render(<CourseFilters categories={['Security', 'Artificial Intelligence']} />)
    expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Security' })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Artificial Intelligence' }),
    ).toBeInTheDocument()
  })

  it('renders the three difficulty chips', () => {
    render(<CourseFilters categories={[]} />)
    expect(screen.getByRole('button', { name: 'Beginner' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Intermediate' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Advanced' })).toBeInTheDocument()
  })

  it('pushes the selected category into the url', async () => {
    const user = userEvent.setup()
    render(<CourseFilters categories={['Security']} />)
    await user.click(screen.getByRole('button', { name: 'Security' }))
    expect(replace).toHaveBeenCalledWith('/explore?category=Security', {
      scroll: false,
    })
  })

  it('pushes the selected difficulty into the url', async () => {
    const user = userEvent.setup()
    render(<CourseFilters categories={[]} />)
    await user.click(screen.getByRole('button', { name: 'Advanced' }))
    expect(replace).toHaveBeenCalledWith('/explore?difficulty=ADVANCED', {
      scroll: false,
    })
  })
})
