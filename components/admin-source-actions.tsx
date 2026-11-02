'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { FieldGroup, Field, FieldLabel } from '@/components/ui/field'

export function AdminSourceActions() {
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [publisher, setPublisher] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [open, setOpen] = useState(false)

  async function handleCreate() {
    if (!title.trim()) return
    setSubmitting(true)
    try {
      const body: Record<string, unknown> = { title: title.trim() }
      if (url.trim()) body.url = url.trim()
      if (publisher.trim()) body.publisher = publisher.trim()

      const res = await fetch('/api/admin/sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        setTitle('')
        setUrl('')
        setPublisher('')
        setOpen(false)
        window.location.reload()
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <Plus data-icon className="size-4" />
        New source
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a source</DialogTitle>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel>Title</FieldLabel>
            <Input
              placeholder="RFC 1234 or article title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel>URL (optional)</FieldLabel>
            <Input
              placeholder="https://..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel>Publisher (optional)</FieldLabel>
            <Input
              placeholder="O'Reilly, ACM, etc."
              value={publisher}
              onChange={(e) => setPublisher(e.target.value)}
            />
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button onClick={handleCreate} disabled={!title.trim() || submitting}>
            {submitting ? 'Creating…' : 'Create draft'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
