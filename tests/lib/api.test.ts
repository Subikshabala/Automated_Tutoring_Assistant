import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { ApiError, fail, handle, ok, parseJson } from '@/lib/api'

describe('ok', () => {
  it('wraps the payload in a data envelope with status 200', async () => {
    const res = ok({ id: '1' })
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ data: { id: '1' } })
  })

  it('honours a custom status', () => {
    expect(ok({ id: '1' }, 201).status).toBe(201)
  })
})

describe('fail', () => {
  it('wraps the error in an error envelope', async () => {
    const res = fail('NOT_FOUND', 'Course not found', 404)
    expect(res.status).toBe(404)
    await expect(res.json()).resolves.toEqual({
      error: { code: 'NOT_FOUND', message: 'Course not found' },
    })
  })
})

describe('handle', () => {
  it('returns the handler result when it succeeds', async () => {
    const res = await handle(async () => ok({ fine: true }))
    expect(res.status).toBe(200)
  })

  it('converts a thrown ApiError into its envelope', async () => {
    const res = await handle(async () => {
      throw new ApiError('FORBIDDEN', 'Nope', 403)
    })
    expect(res.status).toBe(403)
    await expect(res.json()).resolves.toEqual({
      error: { code: 'FORBIDDEN', message: 'Nope' },
    })
  })

  it('converts an unknown throw into a 500', async () => {
    const res = await handle(async () => {
      throw new Error('boom')
    })
    expect(res.status).toBe(500)
    await expect(res.json()).resolves.toEqual({
      error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' },
    })
  })
})

describe('parseJson', () => {
  const schema = z.object({ title: z.string().min(1) })

  it('returns parsed data for a valid body', async () => {
    const req = new Request('http://t/', {
      method: 'POST',
      body: JSON.stringify({ title: 'Hi' }),
    })
    await expect(parseJson(req, schema)).resolves.toEqual({ title: 'Hi' })
  })

  it('throws a VALIDATION_ERROR ApiError for an invalid body', async () => {
    const req = new Request('http://t/', {
      method: 'POST',
      body: JSON.stringify({ title: '' }),
    })
    await expect(parseJson(req, schema)).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      status: 400,
    })
  })
})
