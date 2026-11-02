import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { UserMenu } from '@/components/user-menu'
import type { SessionUser } from '@/lib/schemas/auth'

const push = vi.fn()
const refresh = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh }),
}))

const user: SessionUser = {
  id: 'u1',
  email: 'ada@example.com',
  name: 'Ada Lovelace',
  role: 'USER',
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('UserMenu signed out', () => {
  it('renders sign in and get started links', () => {
    render(<UserMenu user={null} />)
    // Base UI Button with render={<Link/>} renders as <a role="button">
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Get started' })).toBeInTheDocument()
  })

  it('does not render an account menu', () => {
    render(<UserMenu user={null} />)
    expect(
      screen.queryByRole('button', { name: 'Account menu' }),
    ).not.toBeInTheDocument()
  })
})

describe('UserMenu signed in', () => {
  it('renders the avatar trigger with initials', () => {
    render(<UserMenu user={user} />)
    expect(screen.getByRole('button', { name: 'Account menu' })).toBeInTheDocument()
    expect(screen.getByText('AL')).toBeInTheDocument()
  })

  it('opens without throwing', async () => {
    const u = userEvent.setup()
    render(<UserMenu user={user} />)
    await u.click(screen.getByRole('button', { name: 'Account menu' }))
    expect(await screen.findByText('ada@example.com')).toBeInTheDocument()
  })

  it('shows the name and email in the menu', async () => {
    const u = userEvent.setup()
    render(<UserMenu user={user} />)
    await u.click(screen.getByRole('button', { name: 'Account menu' }))
    expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument()
    expect(screen.getByText('ada@example.com')).toBeInTheDocument()
  })

  it('links to the profile page', async () => {
    const u = userEvent.setup()
    render(<UserMenu user={user} />)
    await u.click(screen.getByRole('button', { name: 'Account menu' }))
    const profile = await screen.findByRole('menuitem', { name: /Profile/ })
    expect(profile).toHaveAttribute('href', '/profile')
  })

  it('signs out and redirects home', async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response(null, { status: 200 }))
    const u = userEvent.setup()
    render(<UserMenu user={user} />)
    await u.click(screen.getByRole('button', { name: 'Account menu' }))
    await u.click(await screen.findByRole('menuitem', { name: /Sign out/ }))
    expect(global.fetch).toHaveBeenCalledWith('/api/auth/logout', {
      method: 'POST',
    })
    expect(push).toHaveBeenCalledWith('/')
  })

  it('shows a single initial for a one-word name', () => {
    render(<UserMenu user={{ ...user, name: 'Ada' }} />)
    expect(screen.getByText('A')).toBeInTheDocument()
  })

  it('caps initials at two characters', () => {
    render(<UserMenu user={{ ...user, name: 'Ada Byron King Lovelace' }} />)
    expect(screen.getByText('AB')).toBeInTheDocument()
  })
})
