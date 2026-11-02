import { HelpCircle, Lightbulb, Target } from 'lucide-react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import type { ConceptExplanation } from '@/lib/schemas/ai'

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Target
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-1.5">
      <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon data-icon className="size-3.5" />
        {title}
      </h3>
      {children}
    </section>
  )
}

export function ConceptExplanationCard({
  explanation,
}: {
  explanation: ConceptExplanation
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">{explanation.title}</CardTitle>
      </CardHeader>

      <CardContent className="flex flex-col gap-5">
        <p className="text-[15px] leading-relaxed">
          {explanation.simpleExplanation}
        </p>

        <Separator />

        <Section icon={Target} title="Why it matters">
          <p className="text-sm leading-relaxed text-muted-foreground">
            {explanation.whyItMatters}
          </p>
        </Section>

        <Section icon={Lightbulb} title="Example">
          <p className="rounded-lg bg-muted px-4 py-3 text-sm leading-relaxed">
            {explanation.example}
          </p>
        </Section>

        <Section icon={Target} title="Key points">
          <ul className="flex flex-col gap-1.5">
            {explanation.keyPoints.map((point) => (
              <li key={point} className="flex gap-2 text-sm leading-snug">
                <span className="mt-1.5 size-1 shrink-0 rounded-full bg-primary" />
                {point}
              </li>
            ))}
          </ul>
        </Section>

        <Section icon={HelpCircle} title="Check yourself">
          <p className="rounded-lg border border-dashed px-4 py-3 text-sm italic leading-relaxed">
            {explanation.checkQuestion}
          </p>
        </Section>
      </CardContent>
    </Card>
  )
}
