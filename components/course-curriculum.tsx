'use client'

import Link from 'next/link'
import { BookOpen } from 'lucide-react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import type { ModuleSummary } from '@/lib/schemas/course'

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? '' : 's'}`
}

export function CourseCurriculum({
  courseSlug,
  modules,
}: {
  courseSlug: string
  modules: ModuleSummary[]
}) {
  if (modules.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <BookOpen data-icon />
          </EmptyMedia>
          <EmptyTitle>No curriculum yet</EmptyTitle>
          <EmptyDescription>
            This course has no modules. Check back later.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <Accordion
      multiple
      defaultValue={[modules[0].id]}
      className="flex flex-col gap-3"
    >
      {modules.map((module, index) => {
        const conceptCount = module.topics.reduce(
          (sum, t) => sum + t.conceptCount,
          0,
        )

        return (
          <AccordionItem
            key={module.id}
            value={module.id}
            className="rounded-xl border bg-card px-5 transition-colors duration-200 hover:border-primary/30"
          >
            <AccordionTrigger className="py-4 hover:no-underline">
              <div className="flex flex-1 flex-col gap-1 text-left">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-mono text-sm text-muted-foreground">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className="text-base font-semibold">
                    {module.title}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {module.description}
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Badge variant="secondary" className="text-xs">
                    {plural(module.topics.length, 'topic')}
                  </Badge>
                  <Badge variant="secondary" className="text-xs">
                    {plural(conceptCount, 'concept')}
                  </Badge>
                </div>
              </div>
            </AccordionTrigger>

            <AccordionContent className="pb-4">
              <div className="flex flex-col gap-2">
                {module.topics.map((topic) => (
                  <Link
                    key={topic.id}
                    href={`/learn/${courseSlug}/${topic.id}`}
                    className="flex items-center justify-between gap-4 rounded-lg border px-4 py-3 transition-all duration-200 hover:border-primary/40 hover:bg-accent hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="text-sm font-medium">{topic.title}</span>
                      <span className="text-xs text-muted-foreground">
                        {topic.description}
                      </span>
                    </div>
                    <Badge variant="outline" className="shrink-0">
                      {plural(topic.conceptCount, 'concept')}
                    </Badge>
                  </Link>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        )
      })}
    </Accordion>
  )
}
