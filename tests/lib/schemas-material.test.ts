import { describe, expect, it } from 'vitest'
import {
  groundedAnswerSchema,
  materialQuerySchema,
  materialSummarySchema,
} from '@/lib/schemas/material'

describe('materialSummarySchema', () => {
  const material = {
    id: 'm1',
    filename: 'notes.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 12345,
    status: 'READY' as const,
    chunkCount: 12,
    error: null,
    createdAt: '2026-01-01T00:00:00.000Z',
  }

  it('accepts a well formed material', () => {
    expect(materialSummarySchema.parse(material).filename).toBe('notes.pdf')
  })

  it('accepts every valid status', () => {
    for (const status of ['UPLOADED', 'PROCESSING', 'READY', 'FAILED']) {
      expect(
        materialSummarySchema.safeParse({ ...material, status }).success,
      ).toBe(true)
    }
  })

  it('rejects an unknown status', () => {
    expect(
      materialSummarySchema.safeParse({ ...material, status: 'WEIRD' }).success,
    ).toBe(false)
  })

  it('allows an error string on a failed material', () => {
    const parsed = materialSummarySchema.parse({
      ...material,
      status: 'FAILED',
      error: 'Could not read the PDF',
    })
    expect(parsed.error).toBe('Could not read the PDF')
  })
})

describe('materialQuerySchema', () => {
  it('accepts a question', () => {
    expect(materialQuerySchema.parse({ question: 'What is X?' }).question).toBe(
      'What is X?',
    )
  })

  it('rejects an empty question', () => {
    expect(materialQuerySchema.safeParse({ question: '' }).success).toBe(false)
  })

  it('rejects a question over 500 characters', () => {
    expect(
      materialQuerySchema.safeParse({ question: 'a'.repeat(501) }).success,
    ).toBe(false)
  })
})

describe('groundedAnswerSchema', () => {
  const answer = {
    answer: 'The document defines X as Y.',
    foundInMaterial: true,
    quotedPassages: ['X is defined as Y.'],
  }

  it('accepts a well formed grounded answer', () => {
    expect(groundedAnswerSchema.parse(answer).foundInMaterial).toBe(true)
  })

  it('allows foundInMaterial to be false', () => {
    const parsed = groundedAnswerSchema.parse({
      answer: 'The document does not cover this.',
      foundInMaterial: false,
      quotedPassages: [],
    })
    expect(parsed.foundInMaterial).toBe(false)
  })

  it('defaults quotedPassages to an empty array', () => {
    const { quotedPassages: _omitted, ...rest } = answer
    expect(groundedAnswerSchema.parse(rest).quotedPassages).toEqual([])
  })

  it('rejects an empty answer', () => {
    expect(
      groundedAnswerSchema.safeParse({ ...answer, answer: '' }).success,
    ).toBe(false)
  })
})
