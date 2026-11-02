'use client'

import { useEffect, useRef, useState } from 'react'
import { Send, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Spinner } from '@/components/ui/spinner'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { apiFetch } from '@/lib/fetcher'
import type { TutorAnswer } from '@/lib/schemas/ai'

type Turn = {
  role: 'user' | 'assistant'
  content: string
  relatedConcepts?: string[]
  followUpQuestion?: string | null
}

export function TutorChat({
  conceptId,
  conceptName,
  className,
}: {
  conceptId: string
  conceptName: string
  className?: string
}) {
  const [turns, setTurns] = useState<Turn[]>([])
  const [input, setInput] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView?.({ behavior: 'smooth' })
  }, [turns, pending])

  async function send() {
    const question = input.trim()
    if (!question || pending) return

    setError(null)
    setPending(true)
    setInput('')

    const history = turns.map((t) => ({ role: t.role, content: t.content }))
    setTurns((prev) => [...prev, { role: 'user', content: question }])

    try {
      const answer = await apiFetch<TutorAnswer>('/api/ai/ask', {
        method: 'POST',
        json: { conceptId, question, history },
      })
      setTurns((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: answer.answer,
          relatedConcepts: answer.relatedConcepts,
          followUpQuestion: answer.followUpQuestion,
        },
      ])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className={cn('flex flex-1 min-h-0 flex-col gap-3', className)}>
      <ScrollArea className="flex-1 min-h-0">
        <div className="flex flex-col gap-4 pr-3">
          {turns.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <Sparkles data-icon className="size-5 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Ask anything about {conceptName}.
              </p>
            </div>
          )}

          {turns.map((turn, index) => (
            <div
              key={index}
              className={cn(
                'flex flex-col gap-2',
                turn.role === 'user' ? 'items-end' : 'items-start',
              )}
            >
              <div
                className={cn(
                  'max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed transition-all duration-200',
                  turn.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted',
                )}
              >
                {turn.content}
              </div>

              {turn.relatedConcepts && turn.relatedConcepts.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {turn.relatedConcepts.map((name) => (
                    <Badge key={name} variant="outline" className="text-xs">
                      {name}
                    </Badge>
                  ))}
                </div>
              )}

              {turn.followUpQuestion && (
                <button
                  type="button"
                  onClick={() => setInput(turn.followUpQuestion!)}
                  className="max-w-[85%] rounded-lg border border-dashed px-3 py-2 text-left text-xs italic text-muted-foreground transition-all duration-200 hover:border-primary hover:text-foreground hover:bg-accent"
                >
                  {turn.followUpQuestion}
                </button>
              )}
            </div>
          ))}

          {pending && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Spinner data-icon className="size-4" />
              Thinking
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {error && (
        <Alert variant="destructive" className="shrink-0">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex shrink-0 items-end gap-2">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              void send()
            }
          }}
          placeholder={`Ask about ${conceptName}...`}
          rows={2}
          className="resize-none"
          disabled={pending}
        />
        <Button
          onClick={() => void send()}
          disabled={pending || input.trim().length === 0}
          size="icon"
          aria-label="Send question"
        >
          {pending ? <Spinner data-icon /> : <Send data-icon />}
        </Button>
      </div>
    </div>
  )
}
