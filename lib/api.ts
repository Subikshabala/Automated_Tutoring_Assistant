import { NextResponse } from 'next/server'
import type { ZodType } from 'zod'

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number = 400,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ data }, { status })
}

export function fail(code: string, message: string, status = 400) {
  return NextResponse.json({ error: { code, message } }, { status })
}

export async function handle(
  fn: () => Promise<NextResponse>,
): Promise<NextResponse> {
  try {
    return await fn()
  } catch (error) {
    if (error instanceof ApiError) {
      return fail(error.code, error.message, error.status)
    }
    console.error('Unhandled route error:', error)
    return fail('INTERNAL_ERROR', 'Something went wrong', 500)
  }
}

export async function parseJson<T>(
  request: Request,
  schema: ZodType<T>,
): Promise<T> {
  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    throw new ApiError('VALIDATION_ERROR', 'Request body must be valid JSON', 400)
  }

  const result = schema.safeParse(raw)
  if (!result.success) {
    const first = result.error.issues[0]
    const path = first.path.join('.')
    throw new ApiError(
      'VALIDATION_ERROR',
      path ? `${path}: ${first.message}` : first.message,
      400,
    )
  }
  return result.data
}
