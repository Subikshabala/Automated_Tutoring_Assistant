import { Compass } from 'lucide-react'
import { CourseCard } from '@/components/course-card'
import { CourseFilters } from '@/components/course-filters'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { listCategories, listCourses } from '@/lib/repositories/course'
import { difficultySchema } from '@/lib/schemas/common'

export const metadata = {
  title: 'Explore courses — Adaptive',
}

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; difficulty?: string }>
}) {
  const { category, difficulty } = await searchParams

  const parsedDifficulty = difficultySchema.safeParse(difficulty)

  const [courses, categories] = await Promise.all([
    listCourses({
      category,
      difficulty: parsedDifficulty.success ? parsedDifficulty.data : undefined,
    }),
    listCategories(),
  ])

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Explore courses</h1>
        <p className="text-sm text-muted-foreground">
          Pick a subject. The tutor adapts to what you already understand.
        </p>
      </header>

      <CourseFilters categories={categories} />

      {courses.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Compass data-icon />
            </EmptyMedia>
            <EmptyTitle>No courses match those filters</EmptyTitle>
            <EmptyDescription>
              Clear a filter to widen the search.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => (
            <CourseCard key={course.id} course={course} />
          ))}
        </div>
      )}
    </div>
  )
}
