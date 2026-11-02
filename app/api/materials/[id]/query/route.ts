import { handle, ok, parseJson } from '@/lib/api'
import { materialQuerySchema } from '@/lib/schemas/material'
import { queryMaterial } from '@/lib/ai/material'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const { id } = await params
    const { question } = await parseJson(request, materialQuerySchema)
    const result = await queryMaterial(id, question)
    return ok(result)
  })
}
