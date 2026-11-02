import { ApiError, handle, ok } from '@/lib/api'
import { findStudentMap } from '@/lib/repositories/student-map'
import { getCourseGraph } from '@/lib/repositories/concept'
import { findCourseBySlug } from '@/lib/repositories/course'
import { compareMaps } from '@/lib/map-compare'
import { generateMapFeedback } from '@/lib/ai/map-feedback'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const { id } = await params

    const map = await findStudentMap(id)
    if (!map) throw new ApiError('NOT_FOUND', `No map with id "${id}"`, 404)

    const [graph, course] = await Promise.all([
      getCourseGraph(map.courseSlug),
      findCourseBySlug(map.courseSlug),
    ])
    if (!graph || !course) {
      throw new ApiError('NOT_FOUND', 'The course for this map is missing', 404)
    }

    const comparison = compareMaps(graph, {
      nodes: map.nodes,
      edges: map.edges,
    })

    const feedback = await generateMapFeedback(course.title, comparison)

    return ok({ comparison, feedback })
  })
}
