import { ApiError, handle, ok, parseJson } from '@/lib/api'
import { saveMapSchema } from '@/lib/schemas/student-map'
import {
  listStudentMaps,
  saveStudentMap,
} from '@/lib/repositories/student-map'
import { requireUser } from '@/lib/auth/guard'

export async function GET(request: Request) {
  return handle(async () => {
    const courseSlug = new URL(request.url).searchParams.get('courseSlug')
    if (!courseSlug) {
      throw new ApiError(
        'VALIDATION_ERROR',
        'courseSlug query parameter is required',
        400,
      )
    }
    const user = await requireUser()
    const maps = await listStudentMaps(user.id, courseSlug)
    return ok(maps)
  })
}

export async function POST(request: Request) {
  return handle(async () => {
    const input = await parseJson(request, saveMapSchema)
    const user = await requireUser()
    const map = await saveStudentMap(user.id, input)
    return ok(map, 201)
  })
}
