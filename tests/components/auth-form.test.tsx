import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthForm } from '@/components/auth-form'

const push = vi.fn()
const refresh = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh }),
  useSearchParams: () => new URLSearchParams(''),
}))

afterEach(() => {
  vi.restoreAllMocks()
  push.mockReset()
})

describe('AuthForm in login mode', () => {
  it('renders email and password fields only', () => {
    render(<AuthForm mode="login" />)
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
    expect(screen.queryByLabelText('Name')).not.toBeInTheDocument()
  })

  it('renders a Sign in button', () => {
    render(<AuthForm mode="login" />)
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })

  it('posts to the login endpoint', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: { id: 'u1' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    global.fetch = fetchSpy
    const user = userEvent.setup()
    render(<AuthForm mode="login" />)

    await user.type(screen.getByLabelText('Email'), 'ada@example.com')
    await user.type(screen.getByLabelText('Password'), 'correct-horse')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    expect(fetchSpy.mock.calls[0][0]).toBe('/api/auth/login')
  })

  it('shows the server error message', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Those details do not match an account',
          },
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      ),
    )
    const user = userEvent.setup()
    render(<AuthForm mode="login" />)

    await user.type(screen.getByLabelText('Email'), 'ada@example.com')
    await user.type(screen.getByLabelText('Password'), 'wrong')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    expect(
      await screen.findByText('Those details do not match an account'),
    ).toBeInTheDocument()
  })
})

describe('AuthForm in register mode', () => {
  it('renders a name field as well', () => {
    render(<AuthForm mode="register" />)
    expect(screen.getByLabelText('Name')).toBeInTheDocument()
  })

  it('renders a Create account button', () => {
    render(<AuthForm mode="register" />)
    expect(
      screen.getByRole('button', { name: /create account/i }),
    ).toBeInTheDocument()
  })

  it('posts to the register endpoint', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: { id: 'u1' } }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    global.fetch = fetchSpy
    const user = userEvent.setup()
    render(<AuthForm mode="register" />)

    await user.type(screen.getByLabelText('Name'), 'Ada')
    await user.type(screen.getByLabelText('Email'), 'ada@example.com')
    await user.type(screen.getByLabelText('Password'), 'correct-horse-battery')
    await user.click(screen.getByRole('button', { name: /create account/i }))

    expect(fetchSpy.mock.calls[0][0]).toBe('/api/auth/register')
  })
})
