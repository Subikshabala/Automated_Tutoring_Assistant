import { describe, expect, it } from 'vitest'
import { chunkText, cleanText } from '@/lib/text/chunk'

describe('cleanText', () => {
  it('collapses runs of whitespace', () => {
    expect(cleanText('a    b\t\tc')).toBe('a b c')
  })

  it('collapses more than two consecutive newlines into two', () => {
    expect(cleanText('a\n\n\n\n\nb')).toBe('a\n\nb')
  })

  it('strips leading and trailing whitespace', () => {
    expect(cleanText('  hello  ')).toBe('hello')
  })

  it('removes null bytes left by some pdf extractors', () => {
    expect(cleanText('a\u0000b')).toBe('ab')
  })
})

describe('chunkText', () => {
  it('returns an empty array for empty input', () => {
    expect(chunkText('', 100, 20)).toEqual([])
  })

  it('returns a single chunk when the text is short', () => {
    const chunks = chunkText('short text', 100, 20)
    expect(chunks).toHaveLength(1)
    expect(chunks[0]).toBe('short text')
  })

  it('splits long text into several chunks', () => {
    const text = 'word '.repeat(200).trim()
    const chunks = chunkText(text, 200, 40)
    expect(chunks.length).toBeGreaterThan(1)
  })

  it('keeps every chunk within the size limit plus a word of slack', () => {
    const text = 'word '.repeat(200).trim()
    for (const chunk of chunkText(text, 200, 40)) {
      expect(chunk.length).toBeLessThanOrEqual(205)
    }
  })

  it('overlaps consecutive chunks', () => {
    const text = Array.from({ length: 100 }, (_, i) => `w${i}`).join(' ')
    const chunks = chunkText(text, 120, 40)
    const firstTail = chunks[0].slice(-30)
    expect(chunks[1]).toContain(firstTail.trim().split(' ')[1])
  })

  it('does not split in the middle of a word', () => {
    const text = 'alpha bravo charlie delta echo foxtrot golf hotel india'
    for (const chunk of chunkText(text, 20, 5)) {
      expect(chunk.trim()).not.toMatch(/^\S*?[a-z]$|^[a-z]\S*?$/)
      for (const word of chunk.split(' ')) {
        expect(text).toContain(word)
      }
    }
  })

  it('produces no empty chunks', () => {
    const text = 'word '.repeat(200).trim()
    for (const chunk of chunkText(text, 200, 40)) {
      expect(chunk.trim().length).toBeGreaterThan(0)
    }
  })

  it('terminates when overlap is as large as the chunk size', () => {
    const text = 'word '.repeat(100).trim()
    const chunks = chunkText(text, 50, 50)
    expect(chunks.length).toBeGreaterThan(0)
    expect(chunks.length).toBeLessThan(1000)
  })
})
