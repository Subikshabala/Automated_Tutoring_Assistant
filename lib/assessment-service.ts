import { ApiError } from '@/lib/api'
import { gradeMcq } from '@/lib/grading'
import { evaluateShortAnswer } from '@/lib/ai/assessment'
import {
  findQuestionsForGrading,
  saveAnswers,
} from '@/lib/repositories/assessment'
import { recordAttempt } from '@/lib/repositories/mastery'
import {
  recordMisconception,
  resolveMisconceptionsForConcept,
} from '@/lib/repositories/misconception'

export type QuestionResult = {
  questionId: string
  conceptId: string
  conceptName: string
  response: string
  isCorrect: boolean
  score: number
  correctAnswer: string
  explanation: string
  feedback: string
}

export type GradedSubmission = {
  score: number
  results: QuestionResult[]
}

export async function gradeSubmission(
  assessmentId: string,
  userId: string,
  responses: { questionId: string; response: string }[],
): Promise<GradedSubmission> {
  const questions = await findQuestionsForGrading(assessmentId)
  if (questions.length === 0) {
    throw new ApiError('NOT_FOUND', 'Assessment has no questions', 404)
  }

  const responseByQuestion = new Map(
    responses.map((r) => [r.questionId, r.response]),
  )

  const results: QuestionResult[] = []

  for (const question of questions) {
    const response = responseByQuestion.get(question.id) ?? ''

    let score: number
    let feedback: string

    if (question.type === 'MCQ') {
      const graded = gradeMcq(response, question.correctAnswer)
      score = graded.score
      feedback = graded.isCorrect ? 'Correct.' : question.explanation
    } else {
      const evaluation = await evaluateShortAnswer({
        conceptName: question.conceptName,
        conceptDefinition: question.conceptDefinition,
        question: question.prompt,
        modelAnswer: question.correctAnswer,
        learnerAnswer: response,
      })
      score = evaluation.correctness
      feedback = evaluation.feedback

      // Capture what the evaluator identified. A failure here must not
      // lose the learner's graded submission.
      for (const description of evaluation.misunderstoodConcepts) {
        try {
          await recordMisconception({
            userId,
            conceptId: question.conceptId,
            description,
            evidence: `Q: ${question.prompt}\nA: ${response}`,
          })
        } catch (error) {
          console.error('Could not record misconception:', error)
        }
      }
    }

    results.push({
      questionId: question.id,
      conceptId: question.conceptId,
      conceptName: question.conceptName,
      response,
      isCorrect: score > 0.5,
      score,
      correctAnswer: question.correctAnswer,
      explanation: question.explanation,
      feedback,
    })
  }

  const totalScore = results.reduce((sum, r) => sum + r.score, 0)
  const score = Math.round((totalScore / results.length) * 100)

  await saveAnswers(
    assessmentId,
    score,
    results.map((r) => ({
      questionId: r.questionId,
      response: r.response,
      isCorrect: r.isCorrect,
      score: r.score,
      feedback: r.feedback,
    })),
  )

  // One mastery attempt per concept, averaged across that concept's questions.
  const byConcept = new Map<string, number[]>()
  for (const result of results) {
    const bucket = byConcept.get(result.conceptId)
    if (bucket) {
      bucket.push(result.score)
    } else {
      byConcept.set(result.conceptId, [result.score])
    }
  }

  for (const [conceptId, scores] of byConcept) {
    const average = scores.reduce((a, b) => a + b, 0) / scores.length
    await recordAttempt(userId, conceptId, average)

    // Strong recovery closes open misconceptions on that concept.
    if (average >= 0.8) {
      try {
        await resolveMisconceptionsForConcept(userId, conceptId)
      } catch (error) {
        console.error('Could not resolve misconceptions:', error)
      }
    }
  }

  return { score, results }
}
