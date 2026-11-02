import { z } from 'zod'
import { ApiError, handle, ok } from '@/lib/api'
import { recommend } from '@/lib/adaptive'
import { getCourseGraph } from '@/lib/repositories/concept'
import { listMasteryForCourse } from '@/lib/repositories/mastery'
import { requireUser } from '@/lib/auth/guard'

const limitSchema = z.coerce.number().int().min(1).max(20).default(6)

export async function GET(request: Request) {
  return handle(async () => {
    const params = new URL(request.url).searchParams
    const courseSlug = params.get('courseSlug')

    if (!courseSlug) {
      throw new ApiError(
        'VALIDATION_ERROR',
        'courseSlug query parameter is required',
        400,
      )
    }

    const parsedLimit = limitSchema.safeParse(params.get('limit') ?? undefined)
    const limit = parsedLimit.success ? parsedLimit.data : 6

    const graph = await getCourseGraph(courseSlug)
    if (!graph) {
      throw new ApiError('NOT_FOUND', `No course with slug "${courseSlug}"`, 404)
    }

    const user = await requireUser()
    const mastery = await listMasteryForCourse(user.id, courseSlug)

    return ok(recommend(graph, mastery, courseSlug, limit))
  })
}
