import { Check, Lightbulb, X } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import type { EdgeRef, MapComparison } from '@/lib/map-compare'
import type { MapFeedback } from '@/lib/schemas/student-map'

function BadgeSection({
  title,
  items,
  variant,
}: {
  title: string
  items: string[]
  variant: 'secondary' | 'destructive' | 'outline'
}) {
  if (items.length === 0) return null
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item) => (
          <Badge key={item} variant={variant}>
            {item}
          </Badge>
        ))}
      </div>
    </section>
  )
}

function EdgeSection({
  title,
  edges,
  variant,
}: {
  title: string
  edges: EdgeRef[]
  variant: 'secondary' | 'destructive' | 'outline'
}) {
  if (edges.length === 0) return null
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      <div className="flex flex-wrap gap-1.5">
        {edges.map((edge) => (
          <Badge key={`${edge.from}-${edge.to}`} variant={variant}>
            {edge.from} → {edge.to}
          </Badge>
        ))}
      </div>
    </section>
  )
}

export function MapComparisonView({
  comparison,
  feedback,
}: {
  comparison: MapComparison
  feedback: MapFeedback
}) {
  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">How your map compares</CardTitle>
          <CardDescription>{feedback.summary}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-semibold tabular-nums">
              {comparison.score}
            </span>
            <span className="text-sm text-muted-foreground">out of 100</span>
          </div>
          <Progress value={comparison.score} />
        </CardContent>
      </Card>

      {(feedback.strengths.length > 0 || feedback.gaps.length > 0) && (
        <Card>
          <CardContent className="flex flex-col gap-4 pt-6">
            {feedback.strengths.length > 0 && (
              <section className="flex flex-col gap-2">
                <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <Check data-icon className="size-3.5" />
                  What you got right
                </h3>
                <ul className="flex flex-col gap-1.5">
                  {feedback.strengths.map((item) => (
                    <li key={item} className="text-sm leading-snug">
                      {item}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {feedback.gaps.length > 0 && (
              <section className="flex flex-col gap-2">
                <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <X data-icon className="size-3.5" />
                  What to fix
                </h3>
                <ul className="flex flex-col gap-1.5">
                  {feedback.gaps.map((item) => (
                    <li key={item} className="text-sm leading-snug">
                      {item}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <Separator />

            <section className="flex items-start gap-2 rounded-lg bg-muted px-4 py-3">
              <Lightbulb data-icon className="mt-0.5 size-4 shrink-0" />
              <p className="text-sm leading-relaxed">{feedback.nextStep}</p>
            </section>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Structural detail</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <BadgeSection
            title="Concepts you included"
            items={comparison.matchedConcepts}
            variant="secondary"
          />
          <BadgeSection
            title="Concepts you missed"
            items={comparison.missingConcepts}
            variant="destructive"
          />
          <BadgeSection
            title="Not in this course"
            items={comparison.unrecognisedNodes}
            variant="outline"
          />
          <EdgeSection
            title="Connections you got right"
            edges={comparison.correctEdges}
            variant="secondary"
          />
          <EdgeSection
            title="Connections you missed"
            edges={comparison.missingEdges}
            variant="destructive"
          />
          <EdgeSection
            title="Connections not in the course map"
            edges={comparison.incorrectEdges}
            variant="outline"
          />
        </CardContent>
      </Card>
    </div>
  )
}
