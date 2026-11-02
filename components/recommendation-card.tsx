import Link from 'next/link'
import { ArrowRight, BookOpen, RotateCcw, Target } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type {
  LearningAction,
  Recommendation,
} from '@/lib/schemas/recommendation'
import type { Situation } from '@/lib/adaptive'

const SITUATION_LABEL: Record<Situation, string> = {
  FIRST_STEP: 'Start here',
  NEWLY_UNLOCKED: 'Just unlocked',
  READY: 'Ready',
  GATEWAY: 'High leverage',
  NEARLY_THERE: 'Almost there',
  SHAKY: 'Needs another pass',
  BLOCKED_DOWNSTREAM: 'Blocking others',
  FOUNDATIONAL_GAP: 'Revisit',
}

const SITUATION_VARIANT: Record<Situation, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  FIRST_STEP: 'default',
  NEWLY_UNLOCKED: 'default',
  READY: 'secondary',
  GATEWAY: 'default',
  NEARLY_THERE: 'secondary',
  SHAKY: 'outline',
  BLOCKED_DOWNSTREAM: 'destructive',
  FOUNDATIONAL_GAP: 'destructive',
}

const ACTION_ICON: Record<LearningAction, typeof BookOpen> = {
  LEARN: BookOpen,
  PRACTISE: Target,
  REVIEW: RotateCcw,
}

const ACTION_ACCENT: Record<LearningAction, string> = {
  LEARN: 'border-l-blue-500',
  PRACTISE: 'border-l-amber-500',
  REVIEW: 'border-l-destructive',
}

export function RecommendationCard({
  recommendation,
}: {
  recommendation: Recommendation
}) {
  const Icon = ACTION_ICON[recommendation.action]
  const href = recommendation.topicId
    ? `/learn/${recommendation.courseSlug}/${recommendation.topicId}`
    : `/courses/${recommendation.courseSlug}`

  return (
    <Link href={href} className="group block">
      <Card
        className={cn(
          'flex flex-row items-start gap-4 border-l-4 p-4 transition-all duration-200 group-hover:border-primary/40 group-hover:shadow-md',
          ACTION_ACCENT[recommendation.action],
        )}
      >
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted transition-colors group-hover:bg-accent">
          <Icon data-icon className="size-4" />
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{recommendation.conceptName}</span>
            <Badge variant={SITUATION_VARIANT[recommendation.situation]} className="text-xs">
              {SITUATION_LABEL[recommendation.situation]}
            </Badge>
            {recommendation.masteryScore > 0 && (
              <span className="text-xs tabular-nums text-muted-foreground">
                {recommendation.masteryScore}
              </span>
            )}
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {recommendation.reason}
          </p>
        </div>

        <ArrowRight
          data-icon
          className="mt-2 size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-1"
        />
      </Card>
    </Link>
  )
}
