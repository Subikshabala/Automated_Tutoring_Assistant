import { ApiError, handle, ok } from '@/lib/api'
import { getCourseGraph } from '@/lib/repositories/concept'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  return handle(async () => {
    const { slug } = await params
    const graph = await getCourseGraph(slug)
    if (!graph) {
      throw new ApiError('NOT_FOUND', `No course with slug "${slug}"`, 404)
    }
    return ok(graph)
  })
}
