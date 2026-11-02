export const TUTOR_SYSTEM = `You are a precise technology tutor.

Rules:
- Respond with raw JSON only. No markdown, no code fences, no prose outside the JSON.
- Do not invent facts, statistics, citations, or product behaviour. If you are unsure, say so inside the relevant field.
- Write plainly. Short sentences. No filler, no hype, no motivational padding.
- Assume the learner is intelligent but new to this specific concept.`

export type TutorContext = {
  conceptName: string
  conceptDefinition: string
  courseTitle: string
  topicTitle: string | null
  objectives: string[]
}

export function explainPrompt(context: TutorContext): string {
  const objectives =
    context.objectives.length > 0
      ? context.objectives.map((o) => `- ${o}`).join('\n')
      : '- (none specified)'

  return `Explain one concept to a learner.

Course: ${context.courseTitle}
Topic: ${context.topicTitle ?? 'General'}
Concept: ${context.conceptName}
Canonical definition: ${context.conceptDefinition}

Learning objectives the explanation must support:
${objectives}

Return JSON with exactly these fields:
{
  "title": "the concept name",
  "simpleExplanation": "2-4 sentences a newcomer understands, no jargon left undefined",
  "whyItMatters": "1-2 sentences on the practical consequence of understanding this",
  "example": "one concrete, specific example — real values, not placeholders",
  "keyPoints": ["2 to 6 short takeaways, each under 15 words"],
  "checkQuestion": "one open question that reveals whether they actually understood"
}`
}

export type QuizRequest = {
  courseTitle: string
  topicTitle: string
  concepts: { name: string; definition: string }[]
  questionCount: number
}

export function quizPrompt(request: QuizRequest): string {
  const concepts = request.concepts
    .map((c) => `- Concept Name: "${c.name}"\n  Definition: ${c.definition}`)
    .join('\n')

  const validNames = request.concepts.map((c) => `"${c.name}"`).join(', ')

  return `Write a short quiz that tests understanding, not recall.

Course: ${request.courseTitle}
Topic: ${request.topicTitle}

Concepts to test:
${concepts}

Valid concept names for conceptName: ${validNames}

Produce exactly ${request.questionCount} questions.
Roughly two thirds MCQ and one third SHORT_ANSWER.
Every question must target exactly one of the concepts listed above.
MCQ distractors must be plausible — not obviously wrong.

Rules:
- "conceptName" MUST be ONLY the exact concept name from the list above (e.g. "${request.concepts[0]?.name ?? 'Concept Name'}"). Do NOT include the definition, colon, quotes, or depth.
- For MCQ, options must be 4 plain strings without letter prefixes like A) or B). correctAnswer must match one of the options exactly.

Return JSON:
{
  "questions": [
    {
      "type": "MCQ" | "SHORT_ANSWER",
      "prompt": "the question text",
      "options": ["4 options for MCQ, empty array for SHORT_ANSWER"],
      "correctAnswer": "the exact correct option for MCQ, or a model answer for SHORT_ANSWER",
      "explanation": "why that answer is right, in 1-2 sentences",
      "conceptName": "exact concept name from the list above",
      "difficulty": "BEGINNER" | "INTERMEDIATE" | "ADVANCED"
    }
  ]
}`
}

export type EvaluationRequest = {
  conceptName: string
  conceptDefinition: string
  question: string
  modelAnswer: string
  learnerAnswer: string
}

export function evaluationPrompt(request: EvaluationRequest): string {
  return `Grade a learner's short answer. Judge understanding, not wording.

Concept: ${request.conceptName}
Definition: ${request.conceptDefinition}
Question: ${request.question}
Model answer: ${request.modelAnswer}
Learner answer: ${request.learnerAnswer}

Award partial credit. A learner who grasps the idea but phrases it differently
should score high. A learner who uses the right words without the idea should not.

Return JSON:
{
  "correctness": 0.0 to 1.0,
  "understoodConcepts": ["what they clearly grasped"],
  "misunderstoodConcepts": ["what they got wrong, if anything"],
  "missingPoints": ["important points they omitted"],
  "feedback": "2-3 sentences addressed to the learner, specific and kind but honest"
}`
}

export type GroundedRequest = {
  filename: string
  question: string
  passages: string[]
  /** True when retrieval found no strong match and these are opening chunks. */
  weakMatch?: boolean
}

export function groundedPrompt(request: GroundedRequest): string {
  const passages = request.passages
    .map((passage, index) => `[${index + 1}] ${passage}`)
    .join('\n\n')

  const caveat = request.weakMatch
    ? `\nNote: no passage closely matched the question. These are the opening
sections of the document. If they do not answer it, say so plainly.\n`
    : ''

  return `Answer a question using ONLY the passages below, taken from the learner's own document "${request.filename}".

Passages:
${passages}
${caveat}
Question: ${request.question}

Rules:
- If the passages answer the question, answer from them and set foundInMaterial to true.
- If the passages do not contain the answer, say so plainly and set foundInMaterial to false. Do not fill the gap from general knowledge.
- Quote the exact sentences you relied on. Do not paraphrase inside quotedPassages.

Return JSON:
{
  "answer": "your answer in 2-5 sentences",
  "foundInMaterial": true | false,
  "quotedPassages": ["exact sentences copied from the passages above"]
}`
}

export function suggestionsPrompt(
  filename: string,
  excerpt: string,
): string {
  return `Read the opening of a learner's document and propose questions it can answer.

Document: ${filename}

Excerpt:
${excerpt}

Rules:
- Every question must be answerable from this document. Do not invent topics.
- Write them as a learner would ask, not as a quiz.
- Vary the scope: one broad, the rest specific.
- Under 12 words each.

Return JSON:
{ "questions": ["3 to 5 questions"] }`
}

export type MapFeedbackRequest = {
  courseTitle: string
  score: number
  matchedConcepts: string[]
  missingConcepts: string[]
  unrecognisedNodes: string[]
  correctEdges: { from: string; to: string }[]
  missingEdges: { from: string; to: string }[]
  incorrectEdges: { from: string; to: string }[]
}

function list(items: string[]): string {
  return items.length > 0 ? items.join(', ') : '(none)'
}

function edgeList(edges: { from: string; to: string }[]): string {
  return edges.length > 0
    ? edges.map((e) => `${e.from} -> ${e.to}`).join(', ')
    : '(none)'
}

export function mapFeedbackPrompt(request: MapFeedbackRequest): string {
  return `A learner drew a concept map for "${request.courseTitle}".
The structural comparison has already been computed. Your job is to turn it
into feedback the learner can act on. Do not re-judge the comparison.

Score: ${request.score}/100
Concepts they included: ${list(request.matchedConcepts)}
Concepts they omitted: ${list(request.missingConcepts)}
Nodes that match no course concept: ${list(request.unrecognisedNodes)}
Connections they got right: ${edgeList(request.correctEdges)}
Connections they omitted: ${edgeList(request.missingEdges)}
Connections that are not in the course map: ${edgeList(request.incorrectEdges)}

Rules:
- Be specific. Name concepts. Do not write generic encouragement.
- An omitted connection usually signals a real gap in understanding — say what the gap is.
- A connection that is not in the course map may still be defensible. Say so if it is.
- Pick exactly one next step. Not a list.

Return JSON:
{
  "summary": "2-3 sentences on what their map shows about their understanding",
  "strengths": ["specific things they got right, up to 3"],
  "gaps": ["specific things to fix, up to 3"],
  "nextStep": "one concrete action"
}`
}

export function diagnosticPrompt(request: {
  courseTitle: string
  concepts: { name: string; definition: string; depth: number }[]
}): string {
  const concepts = request.concepts
    .map((c) => `- Concept Name: "${c.name}" (depth ${c.depth})\n  Definition: ${c.definition}`)
    .join('\n')

  const validNames = request.concepts.map((c) => `"${c.name}"`).join(', ')

  return `Write a diagnostic quiz that locates where a learner's understanding stops.

Course: ${request.courseTitle}

Concepts to probe, ordered from foundational to advanced:
${concepts}

Valid concept names for conceptName: ${validNames}

This is not a test of recall. Each question should reveal whether the learner
can reason with the concept.

Rules:
- Exactly one question per concept, in the order listed.
- Depth-0 concepts get MCQ. Deeper concepts get SHORT_ANSWER.
- Distractors must be plausible to someone with a partial understanding.
- Do not reference other concepts in the list — each question stands alone.
- "conceptName" MUST be ONLY the exact concept name from the list above (e.g. "${request.concepts[0]?.name ?? 'Concept Name'}"). Do NOT include depth, colon, quotes, or definition.
- For MCQ: exactly 4 plain options without letter prefixes like A) or B). correctAnswer must match one of the options exactly.

Return JSON:
{
  "questions": [
    {
      "type": "MCQ" | "SHORT_ANSWER",
      "prompt": "the question",
      "options": ["4 options for MCQ, [] for SHORT_ANSWER"],
      "correctAnswer": "exact option, or a model answer",
      "explanation": "why, in 1-2 sentences",
      "conceptName": "exact name from the list",
      "difficulty": "BEGINNER" | "INTERMEDIATE" | "ADVANCED"
    }
  ]
}`
}

export type CoachRequest = {
  masteredCount: number
  startedCount: number
  totalCount: number
  topRecommendations: { conceptName: string; action: string }[]
}

export function coachPrompt(request: CoachRequest): string {
  const actions =
    request.topRecommendations.length > 0
      ? request.topRecommendations
          .map((r) => `${r.action.toLowerCase()} ${r.conceptName}`)
          .join(', ')
      : '(nothing outstanding)'

  return `Write a short status note for a learner. The plan is already decided — you are only phrasing it.

Concepts mastered: ${request.masteredCount}
Concepts started: ${request.startedCount}
Concepts in total: ${request.totalCount}
Next actions already chosen: ${actions}

Rules:
- No praise for its own sake. State what is true.
- No exclamation marks. No "great job". No "keep it up".
- Reference the actual numbers and concept names.
- Two sentences maximum in the body.

Return JSON:
{
  "headline": "under 8 words, factual",
  "body": "1-2 sentences"
}`
}

export function repairPrompt(request: {
  conceptName: string
  conceptDefinition: string
  misconception: string
  evidence: string
}): string {
  return `A learner holds a specific misunderstanding. Help them find it themselves.

Concept: ${request.conceptName}
Definition: ${request.conceptDefinition}
What they appear to believe: ${request.misconception}
Evidence from their answer:
${request.evidence}

Rules:
- Do not state the correction. Ask a question that makes the contradiction visible.
- Use a concrete case where their belief gives a wrong result.
- One question. Short.
- Do not be arch or coy. This is a genuine question, not a riddle.

Return JSON:
{
  "question": "the Socratic question",
  "hint": "a nudge if they are stuck, still not the answer",
  "resolution": "the correction, shown only after they respond"
}`
}

export type ChatTurn = { role: 'user' | 'assistant'; content: string }

export function askPrompt(
  context: TutorContext & { question: string; history: ChatTurn[] },
): string {
  const history =
    context.history.length > 0
      ? `\nConversation so far:\n${context.history
          .map(
            (turn) =>
              `${turn.role === 'user' ? 'Learner' : 'Tutor'}: ${turn.content}`,
          )
          .join('\n')}\n`
      : ''

  return `Answer a learner's question about a specific concept.

Course: ${context.courseTitle}
Topic: ${context.topicTitle ?? 'General'}
Concept: ${context.conceptName}
Canonical definition: ${context.conceptDefinition}
${history}
Learner question: ${context.question}

Return JSON with exactly these fields:
{
  "answer": "a direct answer in 2-5 sentences, grounded in the concept above",
  "relatedConcepts": ["names of concepts worth reading next, or an empty array"],
  "followUpQuestion": "one question that deepens their understanding, or null"
}`
}
