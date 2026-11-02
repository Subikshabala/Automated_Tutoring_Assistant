import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3 rounded-xl border p-6">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-16 w-full max-w-2xl" />
      </div>
      <Skeleton className="h-[400px] w-full rounded-xl" />
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <Skeleton className="h-96 w-full rounded-xl" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    </div>
  )
}
