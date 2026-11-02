import Link from 'next/link'
import { SearchX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'

export default function CourseNotFound() {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <SearchX data-icon />
        </EmptyMedia>
        <EmptyTitle>Course not found</EmptyTitle>
        <EmptyDescription>
          That course does not exist, or it has not been published yet.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button nativeButton={false} render={<Link href="/explore" />}>Back to explore</Button>
      </EmptyContent>
    </Empty>
  )
}
