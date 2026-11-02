export type GradeResult = {
  isCorrect: boolean
  score: number
}

function normalise(value: string): string {
  return value.trim().toLowerCase()
}

export function gradeMcq(response: string, correctAnswer: string): GradeResult {
  const isCorrect =
    normalise(response).length > 0 &&
    normalise(response) === normalise(correctAnswer)
  return { isCorrect, score: isCorrect ? 1 : 0 }
}
