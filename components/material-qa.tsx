'use client'

import { useState } from 'react'
import { AlertTriangle, ChevronDown, Quote, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { Separator } from '@/components/ui/separator'
import { apiFetch } from '@/lib/fetcher'
import type { GroundedAnswer } from '@/lib/schemas/material'

type RankedChunk = {
  id: string
  content: string
  order: number
  score: number
  keywordScore: number
  semanticScore: number
  viaFallback: boolean
}

type QueryResult = {
  answer: GroundedAnswer
  sources: RankedChunk[]
}

type Exchange = {
  question: string
  answer: GroundedAnswer
  sources: RankedChunk[]
}

export function MaterialQa({
  materialId,
  filename,
  suggestions,
}: {
  materialId: string
  filename: string
  suggestions: string[]
}) {
  const [question, setQuestion] = useState('')
  const [history, setHistory] = useState<Exchange[]>([])
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function ask(text?: string) {
    const trimmed = (text ?? question).trim()
    if (!trimmed || pending) return

    setPending(true)
    setError(null)
    setQuestion('')
    try {
      const response = await apiFetch<QueryResult>(
        `/api/materials/${materialId}/query`,
        { method: 'POST', json: { question: trimmed } },
      )
      setHistory((prev) => [
        { question: trimmed, answer: response.answer, sources: response.sources },
        ...prev,
      ])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not answer that')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Input row */}
      <div className="flex gap-2">
        <Input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void ask()}
          placeholder={`Ask something about ${filename}...`}
          disabled={pending}
        />
        <Button
          onClick={() => void ask()}
          disabled={pending || question.trim().length === 0}
        >
          {pending ? <Spinner data-icon /> : <Search data-icon />}
          Ask
        </Button>
      </div>

      {/* Suggestion chips */}
      {history.length === 0 && suggestions.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium text-muted-foreground">
            Try asking
          </p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <Button
                key={s}
                variant="outline"
                size="sm"
                onClick={() => void ask(s)}
                disabled={pending}
              >
                {s}
              </Button>
            ))}
          </div>
        </div>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Q&A history — newest first */}
      {history.map((exchange, i) => (
        <ExchangeCard key={i} exchange={exchange} />
      ))}
    </div>
  )
}

function ExchangeCard({ exchange }: { exchange: Exchange }) {
  const [sourcesOpen, setSourcesOpen] = useState(false)
  const weakMatch = exchange.sources.length > 0 && exchange.sources.every((s) => s.viaFallback)

  return (
    <Card>
      <CardHeader className="flex flex-col gap-2 pb-2">
        <p className="text-sm font-medium text-muted-foreground">
          {exchange.question}
        </p>
        <div>
          {exchange.answer.foundInMaterial ? (
            <Badge variant="secondary">From your document</Badge>
          ) : (
            <Badge variant="outline">Not in this document</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {weakMatch && (
          <Alert>
            <AlertTriangle data-icon className="size-4" />
            <AlertDescription>
              No close match — answered from the document&apos;s opening sections.
            </AlertDescription>
          </Alert>
        )}

        <p className="text-sm leading-relaxed">{exchange.answer.answer}</p>

        {exchange.answer.quotedPassages.length > 0 && (
          <>
            <Separator />
            <section className="flex flex-col gap-2">
              <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Quote data-icon className="size-3.5" />
                Supporting passages
              </h3>
              {exchange.answer.quotedPassages.map((passage, index) => (
                <blockquote
                  key={index}
                  className="rounded-r-md border-l-2 border-primary/40 bg-muted/50 py-2 pl-4 text-sm leading-relaxed text-muted-foreground"
                >
                  {passage}
                </blockquote>
              ))}
            </section>
          </>
        )}

        {exchange.sources.length > 0 && (
          <div>
            <button
              type="button"
              onClick={() => setSourcesOpen(!sourcesOpen)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <ChevronDown
                data-icon
                className={`size-3.5 transition-transform ${sourcesOpen ? 'rotate-180' : ''}`}
              />
              Retrieved passages ({exchange.sources.length})
            </button>
            {sourcesOpen && (
              <div className="mt-2 flex flex-col gap-2">
                {exchange.sources.map((source) => (
                  <div
                    key={source.id}
                    className="rounded-md border bg-muted/30 p-3 text-xs"
                  >
                    <div className="mb-1 flex items-center gap-2 text-muted-foreground">
                      <span>Score: {source.score.toFixed(3)}</span>
                      <span>KW: {source.keywordScore.toFixed(3)}</span>
                      <span>Sem: {source.semanticScore.toFixed(3)}</span>
                      {source.viaFallback && (
                        <Badge variant="outline" className="text-[10px]">
                          fallback
                        </Badge>
                      )}
                    </div>
                    <p className="leading-relaxed">{source.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
