import Link from 'next/link'
import { Clock, Layers, Network } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { DifficultyBadge } from '@/components/difficulty-badge'
import type { CourseSummary } from '@/lib/schemas/course'

function plural(count: number, word: string) {
  return `${count} ${word}${count === 1 ? '' : 's'}`
}

export function CourseCard({ course }: { course: CourseSummary }) {
  return (
    <Link
      href={`/courses/${course.slug}`}
      className="group rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Card className="h-full transition-all duration-200 group-hover:border-primary/40 group-hover:shadow-md">
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <CardTitle className="leading-snug">{course.title}</CardTitle>
            <DifficultyBadge difficulty={course.difficulty} />
          </div>
          <CardDescription className="line-clamp-2">
            {course.description}
          </CardDescription>
        </CardHeader>

        <CardContent>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {course.category}
          </p>
        </CardContent>

        <CardFooter className="flex flex-wrap gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Layers data-icon className="size-4" />
            {plural(course.moduleCount, 'module')}
          </span>
          <span className="flex items-center gap-1.5">
            <Network data-icon className="size-4" />
            {plural(course.conceptCount, 'concept')}
          </span>
          <span className="flex items-center gap-1.5">
            <Clock data-icon className="size-4" />
            {course.estimatedHours}h
          </span>
        </CardFooter>
      </Card>
    </Link>
  )
}
