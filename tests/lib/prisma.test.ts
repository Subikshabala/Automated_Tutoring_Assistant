import { describe, expect, it } from 'vitest'
import prisma from '@/lib/prisma'

describe('prisma singleton', () => {
  it('exports a client with the expected models', () => {
    expect(prisma.user).toBeDefined()
    expect(prisma.course).toBeDefined()
    expect(prisma.concept).toBeDefined()
  })

  it('returns the same instance on repeat import', async () => {
    const again = (await import('@/lib/prisma')).default
    expect(again).toBe(prisma)
  })
})
