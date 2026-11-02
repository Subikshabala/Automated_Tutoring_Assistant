'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import type { Difficulty } from '@/lib/schemas/common'

const DIFFICULTIES: { value: Difficulty; label: string }[] = [
  { value: 'BEGINNER', label: 'Beginner' },
  { value: 'INTERMEDIATE', label: 'Intermediate' },
  { value: 'ADVANCED', label: 'Advanced' },
]

export function CourseFilters({ categories }: { categories: string[] }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const activeCategory = searchParams.get('category')
  const activeDifficulty = searchParams.get('difficulty')

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(searchParams.toString())
    if (value === null || next.get(key) === value) {
      next.delete(key)
    } else {
      next.set(key, value)
    }
    const query = next.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
          variant={!activeCategory && !activeDifficulty ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => {
            const next = new URLSearchParams(searchParams.toString())
            next.delete('category')
            next.delete('difficulty')

            const query = next.toString()
            router.replace(query ? `${pathname}?${query}` : pathname, {
              scroll: false,
            })
          }}
        >
          All
        </Button>

      {categories.map((category) => (
        <Button
          key={category}
          variant={activeCategory === category ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => setParam('category', category)}
        >
          {category}
        </Button>
      ))}

      <Separator orientation="vertical" className="mx-1 h-5" />

      {DIFFICULTIES.map((d) => (
        <Button
          key={d.value}
          variant={activeDifficulty === d.value ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => setParam('difficulty', d.value)}
        >
          {d.label}
        </Button>
      ))}
    </div>
  )
}
