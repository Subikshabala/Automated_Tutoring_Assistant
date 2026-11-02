import { ApiError, handle, ok } from '@/lib/api'
import {
  createMaterial,
  findMaterial,
  listMaterials,
  markFailed,
  storeChunks,
} from '@/lib/repositories/material'
import { requireUser } from '@/lib/auth/guard'
import {
  extractText,
  isSupportedType,
  MAX_FILE_BYTES,
} from '@/lib/text/extract'
import { chunkText } from '@/lib/text/chunk'

export async function GET() {
  return handle(async () => {
    const user = await requireUser()
    const materials = await listMaterials(user.id)
    return ok(materials)
  })
}

export async function POST(request: Request) {
  return handle(async () => {
    const formData = await request.formData()
    const file = formData.get('file')

    if (!file || typeof file === 'string') {
      throw new ApiError('VALIDATION_ERROR', 'No file was provided', 400)
    }
    if (!isSupportedType(file.type)) {
      throw new ApiError(
        'UNSUPPORTED_TYPE',
        'Only PDF, plain text and markdown files are supported',
        400,
      )
    }
    if (file.size > MAX_FILE_BYTES) {
      throw new ApiError('FILE_TOO_LARGE', 'Files must be under 10 MB', 400)
    }

    const user = await requireUser()
    const material = await createMaterial({
      userId: user.id,
      filename: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
    })

    try {
      const buffer = Buffer.from(await file.arrayBuffer())
      const text = await extractText(buffer, file.type)
      const chunks = chunkText(text)

      if (chunks.length === 0) {
        throw new ApiError(
          'EXTRACTION_FAILED',
          'No readable text was found in this file',
          422,
        )
      }

      await storeChunks(material.id, chunks)
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : 'Processing failed unexpectedly'
      await markFailed(material.id, message)
      throw error
    }

    const ready = await findMaterial(material.id)
    return ok(ready, 201)
  })
}
