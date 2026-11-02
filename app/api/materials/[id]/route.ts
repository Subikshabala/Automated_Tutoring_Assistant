import { ApiError, handle, ok } from '@/lib/api'
import { deleteMaterial, findMaterial } from '@/lib/repositories/material'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const { id } = await params
    const material = await findMaterial(id)
    if (!material) {
      throw new ApiError('NOT_FOUND', `No material with id "${id}"`, 404)
    }
    return ok(material)
  })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const { id } = await params
    const material = await findMaterial(id)
    if (!material) {
      throw new ApiError('NOT_FOUND', `No material with id "${id}"`, 404)
    }
    await deleteMaterial(id)
    return ok({ deleted: true })
  })
}
