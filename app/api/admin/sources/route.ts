import { handle, ok, parseJson } from '@/lib/api'
import { requireAdmin } from '@/lib/auth/guard'
import { createSourceSchema } from '@/lib/schemas/source'
import { listSources, createSource } from '@/lib/repositories/source'
import type { NextRequest } from 'next/server'
import type { SourceStatus } from '@/lib/schemas/source'

export async function GET(request: NextRequest) {
  return handle(async () => {
    await requireAdmin()
    const { searchParams } = new URL(request.url)
    const courseId = searchParams.get('courseId') ?? undefined
    const status = (searchParams.get('status') as SourceStatus) ?? undefined
    return ok(await listSources({ courseId, status }))
  })
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    await requireAdmin()
    const input = await parseJson(request, createSourceSchema)
    const source = await createSource(input)
    return ok(source, 201)
  })
}
