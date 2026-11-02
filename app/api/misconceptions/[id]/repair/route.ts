import { z } from 'zod'
import { handle, ok } from '@/lib/api'
import { requireUser } from '@/lib/auth/guard'
import { generateStructured } from '@/lib/ai/client'
import { repairPrompt, TUTOR_SYSTEM } from '@/lib/ai/prompts'
import prisma from '@/lib/prisma'
import { resolveMisconception } from '@/lib/repositories/misconception'
import type { NextRequest } from 'next/server'

export const repairSchema = z.object({
  question: z.string().min(1),
  hint: z.string().min(1),
  resolution: z.string().min(1),
})

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const user = await requireUser()
    const { id } = await params

    const misconception = await prisma.misconception.findFirst({
      where: { id, userId: user.id },
      include: {
        concept: {
          select: { name: true, definition: true },
        },
      },
    })

    if (!misconception) {
      const { ApiError } = await import('@/lib/api')
      throw new ApiError('NOT_FOUND', 'Misconception not found', 404)
    }

    const repair = await generateStructured({
      prompt: repairPrompt({
        conceptName: misconception.concept.name,
        conceptDefinition: misconception.concept.definition,
        misconception: misconception.description,
        evidence: misconception.evidence,
      }),
      schema: repairSchema,
      system: TUTOR_SYSTEM,
      temperature: 0.4,
      schemaName: 'repair',
    })

    return ok(repair)
  })
}

export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const user = await requireUser()
    const { id } = await params

    const misconception = await prisma.misconception.findFirst({
      where: { id, userId: user.id },
    })

    if (!misconception) {
      const { ApiError } = await import('@/lib/api')
      throw new ApiError('NOT_FOUND', 'Misconception not found', 404)
    }

    await resolveMisconception(id)
    return ok({ resolved: true })
  })
}
