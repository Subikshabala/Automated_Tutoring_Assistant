'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  CheckCircle2,
  Network,
  RotateCcw,
  Sparkles,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { DifficultyBadge } from '@/components/difficulty-badge'
import { ConceptMapCanvas, getNeighbours } from '@/components/concept-map-canvas'
import { ConceptMapLegend } from '@/components/concept-map-legend'
import { ConceptExplanationCard } from '@/components/concept-explanation'
import { TutorChat } from '@/components/tutor-chat'
import { StartAssessmentButton } from '@/components/start-assessment-button'
import { useLearningHeartbeat } from '@/hooks/use-learning-heartbeat'
import { apiFetch } from '@/lib/fetcher'
import { cn } from '@/lib/utils'
import type { ConceptDto, ConceptGraph, ConceptRelationshipDto } from '@/lib/schemas/concept'
import type { ConceptExplanation } from '@/lib/schemas/ai'

export type ConceptWithExplanation = {
  concept: ConceptDto
  explanation: ConceptExplanation | null
  error: string | null
}

export type LearnViewProps = {
  topic: {
    id: string
    title: string
    description: string
    courseTitle: string
    courseSlug: string
    moduleTitle: string
    concepts: ConceptDto[]
    relationships: ConceptRelationshipDto[]
  }
  initialConceptId?: string
  initialExplanation?: ConceptExplanation | null
}

export function LearnView({
  topic,
  initialConceptId,
  initialExplanation = null,
}: LearnViewProps) {
  const [activeId, setActiveId] = useState(
    initialConceptId ?? topic.concepts[0]?.id ?? '',
  )

  useLearningHeartbeat(topic.id, activeId)

  const [explanations, setExplanations] = useState<Record<string, ConceptExplanation>>(
    () => {
      const initialMap: Record<string, ConceptExplanation> = {}
      const firstId = initialConceptId ?? topic.concepts[0]?.id
      if (firstId && initialExplanation) {
        initialMap[firstId] = initialExplanation
      }
      return initialMap
    },
  )

  const detailRef = useRef<HTMLElement | null>(null)
  const isFirstRender = useRef(true)

  useEffect(() => {
    // Do not scroll on mount — the learner has not asked for anything yet.
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    if (!activeId) return

    if (detailRef.current && typeof detailRef.current.scrollIntoView === 'function') {
      const prefersReducedMotion =
        typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches

      detailRef.current.scrollIntoView({
        behavior: prefersReducedMotion ? 'auto' : 'smooth',
        block: 'start',
      })
    }
  }, [activeId])

  const [loadingIds, setLoadingIds] = useState<Record<string, boolean>>({})
  const [errors, setErrors] = useState<Record<string, string | null>>({})

  const activeConcept = useMemo(
    () => topic.concepts.find((c) => c.id === activeId) ?? topic.concepts[0] ?? null,
    [topic.concepts, activeId],
  )

  const graph: ConceptGraph = useMemo(
    () => ({
      concepts: topic.concepts,
      relationships: topic.relationships,
    }),
    [topic.concepts, topic.relationships],
  )

  const { prerequisites, unlocks } = useMemo(
    () => getNeighbours(graph, activeId),
    [graph, activeId],
  )

  const fetchExplanation = useCallback(
    async (conceptId: string, { force = false }: { force?: boolean } = {}) => {
    if (!conceptId || explanations[conceptId] || loadingIds[conceptId]) return
    // A concept that already failed must not refetch on every render.
    // Only an explicit retry (force) clears the error and tries again.
    if (!force && errors[conceptId]) return

    setLoadingIds((prev) => ({ ...prev, [conceptId]: true }))
    setErrors((prev) => ({ ...prev, [conceptId]: null }))

    try {
      const result = await apiFetch<{
        explanation: ConceptExplanation
        cached: boolean
      }>('/api/ai/explain', {
        method: 'POST',
        json: { conceptId },
      })

      setExplanations((prev) => ({
        ...prev,
        [conceptId]: result.explanation,
      }))
    } catch (err) {
      setErrors((prev) => ({
        ...prev,
        [conceptId]:
          err instanceof Error
            ? err.message
            : 'Could not load explanation for this concept.',
      }))
    } finally {
      setLoadingIds((prev) => ({ ...prev, [conceptId]: false }))
    }
    },
    [explanations, loadingIds, errors],
  )

  useEffect(() => {
    if (activeId && !explanations[activeId]) {
      void fetchExplanation(activeId)
    }
  }, [activeId, explanations, fetchExplanation])

  const allObjectives = useMemo(
    () =>
      Array.from(
        new Set(topic.concepts.flatMap((concept) => concept.objectives)),
      ),
    [topic.concepts],
  )

  const activeExplanation = activeConcept ? explanations[activeConcept.id] : null
  const isLoading = activeConcept ? Boolean(loadingIds[activeConcept.id]) : false
  const activeError = activeConcept ? errors[activeConcept.id] : null

  return (
    <div className="flex flex-col gap-8">
      {/* 1. MODULE INTRODUCTION */}
      <section className="flex flex-col gap-5 rounded-xl border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="text-xs uppercase tracking-wider font-semibold">
              {topic.moduleTitle}
            </Badge>
            <Badge variant="secondary" className="text-xs">
              {topic.concepts.length} {topic.concepts.length === 1 ? 'concept' : 'concepts'}
            </Badge>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">{topic.title}</h1>
          <p className="text-base text-muted-foreground leading-relaxed max-w-3xl">
            {topic.description}
          </p>
        </div>

        {allObjectives.length > 0 && (
          <div className="flex flex-col gap-2 pt-1">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Sparkles data-icon className="size-3.5 text-primary" />
              What you will learn
            </h2>
            <ul className="grid gap-2 sm:grid-cols-2">
              {allObjectives.map((obj, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 text-sm text-foreground/90 leading-snug"
                >
                  <CheckCircle2 data-icon className="size-4 shrink-0 text-emerald-500 mt-0.5" />
                  <span>{obj}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-col gap-2 pt-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Concepts in this topic
          </span>
          <div className="flex flex-wrap gap-2">
            {topic.concepts.map((concept) => (
              <button
                key={concept.id}
                type="button"
                onClick={() => setActiveId(concept.id)}
                className={cn(
                  'flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all duration-200 text-left cursor-pointer',
                  activeId === concept.id
                    ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary shadow-sm'
                    : 'bg-background hover:bg-accent text-foreground hover:border-primary/40',
                )}
              >
                <span>{concept.name}</span>
                <DifficultyBadge difficulty={concept.difficulty} />
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* 2. INTERACTIVE CONCEPT MAP */}
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Network data-icon className="size-5 text-primary" />
            <h2 className="text-xl font-semibold tracking-tight">Concept map</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            Click a node to see its breakdown below
          </p>
        </div>

        <ConceptMapLegend />

        <ConceptMapCanvas
          graph={graph}
          selectedId={activeId}
          onSelectConcept={setActiveId}
          hideDetailPanel={true}
          className="w-full shadow-sm"
        />
      </section>

      {/* 3. DETAILED EXPLANATION OF SELECTED CONCEPT */}
      {activeConcept && (
        <section
          ref={detailRef}
          className="flex scroll-mt-20 flex-col gap-6"
        >
          <div className="flex flex-col gap-1 border-b pb-4">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Selected concept
              </span>
              <DifficultyBadge difficulty={activeConcept.difficulty} />
            </div>
            <h2 className="text-2xl font-bold tracking-tight">{activeConcept.name}</h2>
            <p className="text-base text-muted-foreground leading-relaxed">
              {activeConcept.definition}
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
            {/* Main column: Detailed breakdown & objectives */}
            <div className="flex flex-col gap-6">
              {/* Concept Objectives and Relationships summary */}
              {(activeConcept.objectives.length > 0 ||
                prerequisites.length > 0 ||
                unlocks.length > 0) && (
                <Card className="bg-muted/30">
                  <CardContent className="flex flex-col gap-4 p-5">
                    {activeConcept.objectives.length > 0 && (
                      <div className="flex flex-col gap-2">
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Learning objectives
                        </h3>
                        <ul className="flex flex-col gap-1.5">
                          {activeConcept.objectives.map((obj, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm leading-snug">
                              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                              <span>{obj}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {(prerequisites.length > 0 || unlocks.length > 0) && (
                      <div className="grid gap-4 sm:grid-cols-2 pt-2 border-t">
                        {prerequisites.length > 0 && (
                          <div className="flex flex-col gap-1.5 pt-2">
                            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              Prerequisites
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {prerequisites.map((p) => (
                                <Button
                                  key={p.id}
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-xs"
                                  onClick={() => setActiveId(p.id)}
                                >
                                  {p.name}
                                </Button>
                              ))}
                            </div>
                          </div>
                        )}

                        {unlocks.length > 0 && (
                          <div className="flex flex-col gap-1.5 pt-2">
                            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              Unlocks
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {unlocks.map((u) => (
                                <Button
                                  key={u.id}
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-xs"
                                  onClick={() => setActiveId(u.id)}
                                >
                                  {u.name}
                                </Button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Detailed AI Explanation */}
              {isLoading ? (
                <Card className="flex flex-col gap-4 p-6">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-6 w-48" />
                  </div>
                  <Skeleton className="h-16 w-full" />
                  <Separator />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-20 w-full" />
                </Card>
              ) : activeExplanation ? (
                <ConceptExplanationCard explanation={activeExplanation} />
              ) : activeError ? (
                <Card className="flex flex-col items-center justify-center gap-3 p-8 text-center border-dashed">
                  <p className="text-sm text-destructive">{activeError}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      void fetchExplanation(activeConcept.id, { force: true })
                    }
                  >
                    <RotateCcw data-icon className="size-3.5" />
                    Retry loading explanation
                  </Button>
                </Card>
              ) : null}
            </div>

            {/* Side column: AI Tutor Chat */}
            <div className="flex flex-col gap-4">
              <Card className="flex h-[28rem] flex-col overflow-hidden p-4 shadow-sm lg:sticky lg:top-20 lg:h-[38rem]">
                <div className="mb-3 flex shrink-0 items-center justify-between">
                  <h3 className="text-sm font-semibold flex items-center gap-1.5">
                    <Sparkles data-icon className="size-4 text-primary" />
                    Ask the tutor
                  </h3>
                  <Badge variant="outline" className="text-[11px] font-normal truncate max-w-[160px]">
                    {activeConcept.name}
                  </Badge>
                </div>
                <TutorChat
                  key={activeConcept.id}
                  conceptId={activeConcept.id}
                  conceptName={activeConcept.name}
                  className="flex-1 min-h-0"
                />
              </Card>
            </div>
          </div>
        </section>
      )}

      {/* 4. ASSESSMENT CTA */}
      <section className="pt-2">
        <Separator className="mb-8" />
        <Card className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between bg-muted/40 border-dashed">
          <div className="flex flex-col gap-1">
            <h3 className="text-base font-semibold">Ready to test your understanding?</h3>
            <p className="text-sm text-muted-foreground">
              Take the practice assessment for {topic.title}.
            </p>
          </div>
          <div className="shrink-0">
            <StartAssessmentButton topicId={topic.id} />
          </div>
        </Card>
      </section>
    </div>
  )
}
