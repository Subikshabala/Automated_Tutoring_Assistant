import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <Skeleton className="h-5 w-48" />
      <Skeleton className="h-8 w-72" />
      <Skeleton className="h-2 w-full" />
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-44 w-full rounded-xl" />
      ))}
    </div>
  )
}
