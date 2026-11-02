import { z } from 'zod'
import { ApiError, handle, ok, parseJson } from '@/lib/api'
import { requireUser } from '@/lib/auth/guard'
import { slugSchema } from '@/lib/schemas/common'
import { getCourseGraph } from '@/lib/repositories/concept'
import { findCourseBySlug } from '@/lib/repositories/course'
import { createAssessment, type NewQuestion } from '@/lib/repositories/assessment'
import { markDiagnosticTaken } from '@/lib/repositories/user'
import { generateDiagnostic } from '@/lib/ai/assessment'
import { findMatchingConceptId } from '@/lib/concept-match'
import { sampleDiagnosticConcepts, DEFAULT_DIAGNOSTIC_SIZE } from '@/lib/diagnostic'

const bodySchema = z.object({
  courseSlug: slugSchema,
  questionCount: z.number().int().min(3).max(10).default(DEFAULT_DIAGNOSTIC_SIZE),
})

export async function POST(request: Request) {
  return handle(async () => {
    const user = await requireUser()
    const { courseSlug, questionCount } = await parseJson(request, bodySchema)

    const [course, graph] = await Promise.all([
      findCourseBySlug(courseSlug),
      getCourseGraph(courseSlug),
    ])
    if (!course || !graph) {
      throw new ApiError('NOT_FOUND', `No course with slug "${courseSlug}"`, 404)
    }

    const sampled = sampleDiagnosticConcepts(graph, questionCount)
    if (sampled.length === 0) {
      throw new ApiError('NOT_FOUND', 'This course has no concepts to test', 404)
    }

    const quiz = await generateDiagnostic({
      courseTitle: course.title,
      concepts: sampled.map((c) => ({
        name: c.name,
        definition: c.definition,
        depth: c.depth,
      })),
    })

    // Map generated questions back to real concept ids; drop anything
    // the model invented.
    const questions: NewQuestion[] = []
    for (const q of quiz.questions) {
      const conceptId = findMatchingConceptId(q.conceptName, sampled)
      if (!conceptId) {
        console.warn(`Diagnostic: dropping question for unknown "${q.conceptName}"`)
        continue
      }
      questions.push({
        conceptId,
        type: q.type,
        prompt: q.prompt,
        options: q.options,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
        difficulty: q.difficulty,
      })
    }

    if (questions.length === 0) {
      throw new ApiError(
        'AI_INVALID_RESPONSE',
        'The generated diagnostic did not match any concept in this course.',
        502,
      )
    }

    // The first topic is a reasonable anchor; a diagnostic spans the course.
    const anchorTopicId = sampled[0].topicId
    if (!anchorTopicId) {
      throw new ApiError('NOT_FOUND', 'Course concepts are not assigned to topics', 500)
    }

    const assessment = await createAssessment({
      userId: user.id,
      topicId: anchorTopicId,
      questions,
      kind: 'diagnostic',
    })

    await markDiagnosticTaken(user.id, courseSlug)

    return ok(assessment, 201)
  })
}

export async function PATCH(request: Request) {
  // Skip without taking it.
  return handle(async () => {
    const user = await requireUser()
    const { courseSlug } = await parseJson(
      request,
      z.object({ courseSlug: slugSchema }),
    )
    await markDiagnosticTaken(user.id, courseSlug)
    return ok({ skipped: true })
  })
}
