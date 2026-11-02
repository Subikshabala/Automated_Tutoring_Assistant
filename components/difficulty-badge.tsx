import { Badge } from '@/components/ui/badge'
import type { Difficulty } from '@/lib/schemas/common'

const LABEL: Record<Difficulty, string> = {
  BEGINNER: 'Beginner',
  INTERMEDIATE: 'Intermediate',
  ADVANCED: 'Advanced',
}

const VARIANT: Record<Difficulty, 'secondary' | 'default' | 'destructive'> = {
  BEGINNER: 'secondary',
  INTERMEDIATE: 'default',
  ADVANCED: 'destructive',
}

export function DifficultyBadge({ difficulty }: { difficulty: Difficulty }) {
  return <Badge variant={VARIANT[difficulty]}>{LABEL[difficulty]}</Badge>
}
