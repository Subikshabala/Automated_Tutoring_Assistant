import { describe, expect, it } from 'vitest'
import { readStringArray, writeStringArray } from '@/lib/json-array'

describe('readStringArray', () => {
  it('parses a JSON array of strings', () => {
    expect(readStringArray('["a","b"]')).toEqual(['a', 'b'])
  })

  it('returns an empty array for malformed JSON', () => {
    expect(readStringArray('not json')).toEqual([])
  })

  it('returns an empty array when the value is not an array', () => {
    expect(readStringArray('{"a":1}')).toEqual([])
  })

  it('drops non-string members', () => {
    expect(readStringArray('["a",1,null]')).toEqual(['a'])
  })
})

describe('writeStringArray', () => {
  it('serialises to JSON', () => {
    expect(writeStringArray(['a', 'b'])).toBe('["a","b"]')
  })

  it('round-trips through readStringArray', () => {
    expect(readStringArray(writeStringArray(['x', 'y']))).toEqual(['x', 'y'])
  })
})
