'use client'

import { useRef, useState } from 'react'
import { Upload } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import { apiFetch } from '@/lib/fetcher'
import type { MaterialSummary } from '@/lib/schemas/material'

const MAX_BYTES = 10 * 1024 * 1024

export function MaterialUpload({
  onUploaded,
}: {
  onUploaded: (material: MaterialSummary) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function upload(file: File) {
    setError(null)

    if (file.size > MAX_BYTES) {
      setError('That file is too large. Files must be under 10 MB.')
      return
    }

    setPending(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const material = await apiFetch<MaterialSummary>('/api/materials', {
        method: 'POST',
        body: form,
      })
      onUploaded(material)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setPending(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          const file = e.dataTransfer.files[0]
          if (file) void upload(file)
        }}
        onClick={() => inputRef.current?.click()}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-12 text-center transition-all duration-200',
          dragging
            ? 'border-primary bg-primary/5'
            : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-accent/50',
          pending && 'pointer-events-none opacity-60',
        )}
      >
        {pending ? (
          <>
            <Spinner data-icon className="size-6 text-muted-foreground" />
            <p className="text-sm font-medium">Processing your document</p>
            <p className="text-xs text-muted-foreground">
              Extracting and indexing the text
            </p>
          </>
        ) : (
          <>
            <Upload data-icon className="size-6 text-muted-foreground" />
            <p className="text-sm font-medium">
              Drop a PDF here, or click to choose
            </p>
            <p className="text-xs text-muted-foreground">
              PDF, TXT or MD. Up to 10 MB.
            </p>
          </>
        )}
      </div>

      <input
        ref={inputRef}
        data-testid="material-file-input"
        type="file"
        accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void upload(file)
        }}
      />

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  )
}
