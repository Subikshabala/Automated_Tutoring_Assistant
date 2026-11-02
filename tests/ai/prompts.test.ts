import { describe, expect, it } from 'vitest'
import { askPrompt, explainPrompt, TUTOR_SYSTEM } from '@/lib/ai/prompts'

const context = {
  conceptName: 'Tokenization',
  conceptDefinition: 'Splitting text into tokens.',
  courseTitle: 'Generative AI Foundations',
  topicTitle: 'Text Representation',
  objectives: ['Explain subwords'],
}

describe('TUTOR_SYSTEM', () => {
  it('instructs the model to return json only', () => {
    expect(TUTOR_SYSTEM.toLowerCase()).toContain('json')
  })

  it('forbids inventing facts', () => {
    expect(TUTOR_SYSTEM.toLowerCase()).toContain('do not invent')
  })
})

describe('explainPrompt', () => {
  it('includes the concept name and definition', () => {
    const prompt = explainPrompt(context)
    expect(prompt).toContain('Tokenization')
    expect(prompt).toContain('Splitting text into tokens.')
  })

  it('includes the course and topic for grounding', () => {
    const prompt = explainPrompt(context)
    expect(prompt).toContain('Generative AI Foundations')
    expect(prompt).toContain('Text Representation')
  })

  it('includes the learning objectives', () => {
    expect(explainPrompt(context)).toContain('Explain subwords')
  })

  it('names every required output field', () => {
    const prompt = explainPrompt(context)
    for (const field of [
      'simpleExplanation',
      'whyItMatters',
      'example',
      'keyPoints',
      'checkQuestion',
    ]) {
      expect(prompt).toContain(field)
    }
  })
})

describe('askPrompt', () => {
  it('includes the learner question', () => {
    const prompt = askPrompt({ ...context, question: 'Why subwords?', history: [] })
    expect(prompt).toContain('Why subwords?')
  })

  it('includes prior turns when history is present', () => {
    const prompt = askPrompt({
      ...context,
      question: 'And then?',
      history: [
        { role: 'user', content: 'What is a token?' },
        { role: 'assistant', content: 'A subword unit.' },
      ],
    })
    expect(prompt).toContain('What is a token?')
    expect(prompt).toContain('A subword unit.')
  })

  it('omits the history section when there are no prior turns', () => {
    const prompt = askPrompt({ ...context, question: 'Why?', history: [] })
    expect(prompt).not.toContain('Conversation so far')
  })
})
