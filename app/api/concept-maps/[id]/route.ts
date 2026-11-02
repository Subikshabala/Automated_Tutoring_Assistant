import { ApiError, handle, ok } from '@/lib/api'
import {
  deleteStudentMap,
  findStudentMap,
} from '@/lib/repositories/student-map'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const { id } = await params
    const map = await findStudentMap(id)
    if (!map) throw new ApiError('NOT_FOUND', `No map with id "${id}"`, 404)
    return ok(map)
  })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const { id } = await params
    const map = await findStudentMap(id)
    if (!map) throw new ApiError('NOT_FOUND', `No map with id "${id}"`, 404)
    await deleteStudentMap(id)
    return ok({ deleted: true })
  })
}
