import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { QueryProvider } from '@/lib/query-provider'

describe('QueryProvider', () => {
  it('renders its children', () => {
    render(
      <QueryProvider>
        <p>inside</p>
      </QueryProvider>,
    )
    expect(screen.getByText('inside')).toBeInTheDocument()
  })
})
