import { generateStructured } from '@/lib/ai/client'
import {
  diagnosticPrompt,
  evaluationPrompt,
  quizPrompt,
  TUTOR_SYSTEM,
  type EvaluationRequest,
  type QuizRequest,
} from '@/lib/ai/prompts'
import {
  generatedQuizSchema,
  shortAnswerEvaluationSchema,
  type GeneratedQuiz,
  type ShortAnswerEvaluation,
} from '@/lib/schemas/assessment'

export async function generateQuestions(
  request: QuizRequest,
): Promise<GeneratedQuiz> {
  return generateStructured({
    prompt: quizPrompt(request),
    schema: generatedQuizSchema,
    system: TUTOR_SYSTEM,
    temperature: 0.4,
  })
}

export async function generateDiagnostic(request: {
  courseTitle: string
  concepts: { name: string; definition: string; depth: number }[]
}): Promise<GeneratedQuiz> {
  return generateStructured({
    prompt: diagnosticPrompt(request),
    schema: generatedQuizSchema,
    system: TUTOR_SYSTEM,
    temperature: 0.4,
    schemaName: 'diagnostic_quiz',
  })
}

export async function evaluateShortAnswer(
  request: EvaluationRequest,
): Promise<ShortAnswerEvaluation> {
  if (request.learnerAnswer.trim().length === 0) {
    return {
      correctness: 0,
      understoodConcepts: [],
      misunderstoodConcepts: [],
      missingPoints: [],
      feedback: 'No answer was given for this question.',
    }
  }

  return generateStructured({
    prompt: evaluationPrompt(request),
    schema: shortAnswerEvaluationSchema,
    system: TUTOR_SYSTEM,
    temperature: 0.2,
  })
}

export { findMatchingConceptId } from '@/lib/concept-match'


