import { z } from 'zod'
import { ApiError, handle, ok } from '@/lib/api'
import { difficultySchema } from '@/lib/schemas/common'
import { listCourses } from '@/lib/repositories/course'

const querySchema = z.object({
  category: z.string().min(1).optional(),
  difficulty: difficultySchema.optional(),
})

export async function GET(request: Request) {
  return handle(async () => {
    const params = new URL(request.url).searchParams
    const raw = {
      category: params.get('category') ?? undefined,
      difficulty: params.get('difficulty') ?? undefined,
    }

    const parsed = querySchema.safeParse(raw)
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      throw new ApiError(
        'VALIDATION_ERROR',
        `${issue.path.join('.')}: ${issue.message}`,
        400,
      )
    }

    const courses = await listCourses(parsed.data)
    return ok(courses)
  })
}
