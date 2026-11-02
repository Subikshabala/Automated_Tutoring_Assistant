import { ApiError, handle, ok } from '@/lib/api'
import { findAssessment } from '@/lib/repositories/assessment'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const { id } = await params
    const assessment = await findAssessment(id)
    if (!assessment) {
      throw new ApiError('NOT_FOUND', `No assessment with id "${id}"`, 404)
    }
    return ok(assessment)
  })
}
