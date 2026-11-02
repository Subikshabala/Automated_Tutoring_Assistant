import { handle, ok, parseJson } from '@/lib/api'
import { submissionSchema } from '@/lib/schemas/assessment'
import { gradeSubmission } from '@/lib/assessment-service'
import { requireUser } from '@/lib/auth/guard'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const { id } = await params
    const { responses } = await parseJson(request, submissionSchema)
    const user = await requireUser()
    const result = await gradeSubmission(id, user.id, responses)
    return ok(result)
  })
}
