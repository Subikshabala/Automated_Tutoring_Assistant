import { z } from 'zod'
import { ApiError, handle, ok, parseJson } from '@/lib/api'
import { generateQuestions } from '@/lib/ai/assessment'
import { findMatchingConceptId } from '@/lib/concept-match'
import {
  createAssessment,
  type NewQuestion,
} from '@/lib/repositories/assessment'
import { requireUser } from '@/lib/auth/guard'
import { findTopicWithConcepts } from '@/lib/repositories/concept'

const bodySchema = z.object({
  topicId: z.string().min(1),
  questionCount: z.number().int().min(1).max(10).default(5),
})

export async function POST(request: Request) {
  return handle(async () => {
    const { topicId, questionCount } = await parseJson(request, bodySchema)

    const topic = await findTopicWithConcepts(topicId)
    if (!topic) {
      throw new ApiError('NOT_FOUND', `No topic with id "${topicId}"`, 404)
    }

    const quiz = await generateQuestions({
      courseTitle: topic.courseTitle,
      topicTitle: topic.title,
      concepts: topic.concepts.map((c) => ({
        name: c.name,
        definition: c.definition,
      })),
      questionCount,
    })

    const questions: NewQuestion[] = []
    for (const q of quiz.questions) {
      const conceptId = findMatchingConceptId(q.conceptName, topic.concepts)
      if (!conceptId) {
        console.warn(`Dropping question for unknown concept "${q.conceptName}"`)
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
        'The generated questions did not match any concept in this topic. Try again.',
        502,
      )
    }

    const user = await requireUser()
    const assessment = await createAssessment({
      userId: user.id,
      topicId,
      questions,
    })

    return ok(assessment, 201)
  })
}
