import { ApiError, handle, ok } from '@/lib/api'
import { findCourseBySlug } from '@/lib/repositories/course'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  return handle(async () => {
    const { slug } = await params
    const course = await findCourseBySlug(slug)
    if (!course) {
      throw new ApiError('NOT_FOUND', `No course with slug "${slug}"`, 404)
    }
    return ok(course)
  })
}
