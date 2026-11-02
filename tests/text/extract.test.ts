import { beforeEach, describe, expect, it, vi } from 'vitest'

const pdfParse = vi.fn()
vi.mock('pdf-parse', () => ({ default: pdfParse }))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('extractText', () => {
  it('decodes a plain text file', async () => {
    const { extractText } = await import('@/lib/text/extract')
    const buffer = Buffer.from('hello world', 'utf-8')
    await expect(extractText(buffer, 'text/plain')).resolves.toBe('hello world')
  })

  it('decodes a markdown file as text', async () => {
    const { extractText } = await import('@/lib/text/extract')
    const buffer = Buffer.from('# Title', 'utf-8')
    await expect(extractText(buffer, 'text/markdown')).resolves.toBe('# Title')
  })

  it('extracts text from a pdf', async () => {
    pdfParse.mockResolvedValue({ text: 'pdf content here' })
    const { extractText } = await import('@/lib/text/extract')
    await expect(
      extractText(Buffer.from('fake'), 'application/pdf'),
    ).resolves.toBe('pdf content here')
  })

  it('throws UNSUPPORTED_TYPE for an image', async () => {
    const { extractText } = await import('@/lib/text/extract')
    await expect(
      extractText(Buffer.from('x'), 'image/png'),
    ).rejects.toMatchObject({ code: 'UNSUPPORTED_TYPE' })
  })

  it('throws EXTRACTION_FAILED when the pdf parser throws', async () => {
    pdfParse.mockRejectedValue(new Error('corrupt'))
    const { extractText } = await import('@/lib/text/extract')
    await expect(
      extractText(Buffer.from('x'), 'application/pdf'),
    ).rejects.toMatchObject({ code: 'EXTRACTION_FAILED' })
  })

  it('throws EXTRACTION_FAILED when the pdf yields no text', async () => {
    pdfParse.mockResolvedValue({ text: '   ' })
    const { extractText } = await import('@/lib/text/extract')
    await expect(
      extractText(Buffer.from('x'), 'application/pdf'),
    ).rejects.toMatchObject({ code: 'EXTRACTION_FAILED' })
  })

  it('throws EXTRACTION_FAILED for an empty text file', async () => {
    const { extractText } = await import('@/lib/text/extract')
    await expect(
      extractText(Buffer.from('   '), 'text/plain'),
    ).rejects.toMatchObject({ code: 'EXTRACTION_FAILED' })
  })
})

describe('isSupportedType', () => {
  it('accepts pdf, plain text and markdown', async () => {
    const { isSupportedType } = await import('@/lib/text/extract')
    expect(isSupportedType('application/pdf')).toBe(true)
    expect(isSupportedType('text/plain')).toBe(true)
    expect(isSupportedType('text/markdown')).toBe(true)
  })

  it('rejects anything else', async () => {
    const { isSupportedType } = await import('@/lib/text/extract')
    expect(isSupportedType('image/png')).toBe(false)
    expect(isSupportedType('application/zip')).toBe(false)
  })
})
