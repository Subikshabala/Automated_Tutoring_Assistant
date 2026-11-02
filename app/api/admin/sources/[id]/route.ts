import { handle, ok, parseJson } from '@/lib/api'
import { requireAdmin } from '@/lib/auth/guard'
import { updateSourceStatusSchema } from '@/lib/schemas/source'
import { transitionSourceStatus, deleteSource } from '@/lib/repositories/source'
import type { NextRequest } from 'next/server'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    await requireAdmin()
    const { id } = await params
    const { status } = await parseJson(request, updateSourceStatusSchema)
    const source = await transitionSourceStatus(id, status)
    return ok(source)
  })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    await requireAdmin()
    const { id } = await params
    await deleteSource(id)
    return ok({ deleted: true })
  })
}
