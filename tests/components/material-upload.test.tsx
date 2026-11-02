import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MaterialUpload } from '@/components/material-upload'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('MaterialUpload', () => {
  it('renders the drop prompt', () => {
    render(<MaterialUpload onUploaded={() => {}} />)
    expect(screen.getByText(/Drop a PDF/i)).toBeInTheDocument()
  })

  it('lists the accepted formats', () => {
    render(<MaterialUpload onUploaded={() => {}} />)
    expect(screen.getByText(/PDF, TXT or MD/i)).toBeInTheDocument()
  })

  it('uploads the chosen file and calls onUploaded', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: { id: 'm1' } }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    const onUploaded = vi.fn()
    const user = userEvent.setup()
    render(<MaterialUpload onUploaded={onUploaded} />)

    const input = screen.getByTestId('material-file-input')
    await user.upload(
      input,
      new File(['hello'], 'notes.txt', { type: 'text/plain' }),
    )

    await waitFor(() => expect(onUploaded).toHaveBeenCalledOnce())
  })

  it('shows the server error when the upload fails', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: { code: 'UNSUPPORTED_TYPE', message: 'Only PDF and text files' },
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      ),
    )
    const user = userEvent.setup({ applyAccept: false })
    render(<MaterialUpload onUploaded={() => {}} />)

    await user.upload(
      screen.getByTestId('material-file-input'),
      new File(['x'], 'bad.png', { type: 'image/png' }),
    )

    expect(
      await screen.findByText('Only PDF and text files'),
    ).toBeInTheDocument()
  })

  it('rejects an oversized file before calling the server', async () => {
    const fetchSpy = vi.fn()
    global.fetch = fetchSpy
    const user = userEvent.setup()
    render(<MaterialUpload onUploaded={() => {}} />)

    const big = new File(['x'], 'big.pdf', { type: 'application/pdf' })
    Object.defineProperty(big, 'size', { value: 11 * 1024 * 1024 })

    await user.upload(screen.getByTestId('material-file-input'), big)

    expect(await screen.findByText(/under 10 MB/i)).toBeInTheDocument()
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
