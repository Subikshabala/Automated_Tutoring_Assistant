'use client'

import { useState } from 'react'
import { AlertTriangle, CheckCircle2, Lightbulb, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import type { MisconceptionRecord } from '@/lib/repositories/misconception'

type RepairResponse = {
  question: string
  hint: string
  resolution: string
}

export function MisconceptionList({
  misconceptions,
}: {
  misconceptions: MisconceptionRecord[]
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <AlertTriangle data-icon className="size-5 text-amber-500" />
        <h2 className="text-lg font-semibold">Worth revisiting</h2>
      </div>
      <div className="flex flex-col gap-2">
        {misconceptions.map((m) => (
          <MisconceptionItem key={m.id} misconception={m} />
        ))}
      </div>
    </section>
  )
}

function MisconceptionItem({
  misconception,
}: {
  misconception: MisconceptionRecord
}) {
  const [resolved, setResolved] = useState(false)
  const [resolving, setResolving] = useState(false)

  async function handleResolve() {
    setResolving(true)
    try {
      const res = await fetch(`/api/misconceptions/${misconception.id}/repair`, {
        method: 'PATCH',
      })
      if (res.ok) setResolved(true)
    } finally {
      setResolving(false)
    }
  }

  if (resolved) return null

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 pt-6">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {misconception.conceptName}
          </span>
          <p className="text-sm">{misconception.description}</p>
        </div>
        <div className="flex items-center gap-2">
          <RepairDialog misconception={misconception} />
          <Button
            variant="ghost"
            size="sm"
            onClick={handleResolve}
            disabled={resolving}
          >
            {resolving ? (
              <Loader2 data-icon className="size-4 animate-spin" />
            ) : (
              <CheckCircle2 data-icon className="size-4" />
            )}
            I understand this now
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function RepairDialog({
  misconception,
}: {
  misconception: MisconceptionRecord
}) {
  const [repair, setRepair] = useState<RepairResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [showHint, setShowHint] = useState(false)
  const [showResolution, setShowResolution] = useState(false)

  async function loadRepair() {
    if (repair) return
    setLoading(true)
    try {
      const res = await fetch(
        `/api/misconceptions/${misconception.id}/repair`,
        { method: 'POST' },
      )
      if (res.ok) {
        const body = await res.json()
        setRepair(body.data)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog>
      <DialogTrigger
        render={<Button variant="outline" size="sm" />}
        onClick={loadRepair}
      >
        <Lightbulb data-icon className="size-4" />
        Work through it
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{misconception.conceptName}</DialogTitle>
          <DialogDescription>{misconception.description}</DialogDescription>
        </DialogHeader>
        {loading && (
          <div className="flex items-center justify-center py-4">
            <Loader2 data-icon className="size-5 animate-spin text-muted-foreground" />
          </div>
        )}
        {repair && (
          <div className="flex flex-col gap-4">
            <p className="text-sm leading-relaxed">{repair.question}</p>
            {!showHint && !showResolution && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowHint(true)}
              >
                I&apos;m stuck — give me a hint
              </Button>
            )}
            {showHint && (
              <div className="flex flex-col gap-2">
                <p className="text-sm text-muted-foreground">
                  {repair.hint}
                </p>
                {!showResolution && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowResolution(true)}
                  >
                    Show me the answer
                  </Button>
                )}
              </div>
            )}
            {showResolution && (
              <div className="rounded-md border bg-muted/50 p-3">
                <p className="text-sm">{repair.resolution}</p>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
