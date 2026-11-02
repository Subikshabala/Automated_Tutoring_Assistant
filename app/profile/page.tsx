import { redirect } from 'next/navigation'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { getSessionUser } from '@/lib/auth/session'
import { getAllCourseProgress } from '@/lib/repositories/progress'
import { countStartedConcepts } from '@/lib/repositories/learning'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Profile — Adaptive' }

export default async function ProfilePage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const [progress, viewedCount] = await Promise.all([
    getAllCourseProgress(user.id),
    countStartedConcepts(user.id),
  ])
  const totals = progress.reduce(
    (acc, p) => ({
      mastered: acc.mastered + p.masteredConcepts,
    }),
    { mastered: 0 },
  )

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
        <p className="text-sm text-muted-foreground">
          Your account and overall activity.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Account</CardTitle>
          <CardDescription>{user.email}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Name</span>
            <span className="text-sm font-medium">{user.name}</span>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Role</span>
            <Badge variant={user.role === 'ADMIN' ? 'default' : 'secondary'}>
              {user.role.toLowerCase()}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Activity</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-8">
          <div className="flex flex-col gap-0.5">
            <span className="text-2xl font-semibold tabular-nums">
              {viewedCount}
            </span>
            <span className="text-xs text-muted-foreground">
              concepts started
            </span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-2xl font-semibold tabular-nums">
              {totals.mastered}
            </span>
            <span className="text-xs text-muted-foreground">
              concepts mastered
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
