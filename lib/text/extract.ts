import { ApiError } from '@/lib/api'

export const SUPPORTED_TYPES = [
  'application/pdf',
  'text/plain',
  'text/markdown',
] as const

export const MAX_FILE_BYTES = 10 * 1024 * 1024

export function isSupportedType(mimeType: string): boolean {
  return (SUPPORTED_TYPES as readonly string[]).includes(mimeType)
}

export async function extractText(
  buffer: Buffer,
  mimeType: string,
): Promise<string> {
  if (!isSupportedType(mimeType)) {
    throw new ApiError(
      'UNSUPPORTED_TYPE',
      'Only PDF, plain text and markdown files are supported',
      400,
    )
  }

  let text: string

  if (mimeType === 'application/pdf') {
    try {
      const mod = await import('pdf-parse')
      // pdf-parse v2 exports a class PDFParse; v1 exports a default function.
      // In tests the module is mocked with { default: fn }.
      if ('PDFParse' in mod) {
        const parser = new mod.PDFParse({ data: new Uint8Array(buffer) })
        const result = await parser.getText()
        text = result.text
        await parser.destroy()
      } else {
        const pdfParse = (mod as { default: (buf: Buffer) => Promise<{ text: string }> }).default
        const parsed = await pdfParse(buffer)
        text = parsed.text
      }
    } catch (error) {
      if (error instanceof ApiError) throw error
      console.error('PDF extraction failed:', error)
      throw new ApiError(
        'EXTRACTION_FAILED',
        'Could not read text from this PDF. It may be scanned images rather than text.',
        422,
      )
    }
  } else {
    text = buffer.toString('utf-8')
  }

  if (text.trim().length === 0) {
    throw new ApiError(
      'EXTRACTION_FAILED',
      'No readable text was found in this file',
      422,
    )
  }

  return text
}
