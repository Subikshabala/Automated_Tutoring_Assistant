import { redirect } from 'next/navigation'
import Link from 'next/link'
import { AlertTriangle, ExternalLink } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { getSessionUser } from '@/lib/auth/session'
import { listCourses } from '@/lib/repositories/course'
import {
  listLearnerOverview,
  getPlatformStats,
} from '@/lib/repositories/admin'
import { listSources } from '@/lib/repositories/source'
import { allowedTransitions } from '@/lib/schemas/source'
import { AdminSourceActions } from '@/components/admin-source-actions'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Admin — Adaptive' }

function tierLabel(level: number) {
  switch (level) {
    case 1: return 'T1 — Primary'
    case 2: return 'T2 — Secondary'
    case 3: return 'T3 — Curated'
    default: return 'T4 — Community'
  }
}

function statusColor(status: string) {
  switch (status) {
    case 'PUBLISHED': return 'default' as const
    case 'APPROVED': return 'secondary' as const
    case 'ARCHIVED': return 'outline' as const
    case 'DRAFT': return 'ghost' as const
    default: return 'secondary' as const
  }
}

export default async function AdminPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')
  if (user.role !== 'ADMIN') redirect('/progress')

  const [courses, stats, learners, sources] = await Promise.all([
    listCourses({}),
    getPlatformStats(),
    listLearnerOverview(),
    listSources(),
  ])

  const statCards = [
    { label: 'Courses', value: stats.courses },
    { label: 'Learners', value: stats.learners },
    { label: 'Assessments taken', value: stats.assessmentsTaken },
    { label: 'Materials uploaded', value: stats.materialsUploaded },
    { label: 'Untouched concepts', value: stats.untouchedConcepts, highlight: true },
    { label: 'Open misconceptions', value: stats.openMisconceptions, highlight: true },
  ]

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
        <p className="text-sm text-muted-foreground">
          Platform content and activity.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {statCards.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="flex flex-col gap-1 pt-6">
              <span
                className={`text-3xl font-semibold tabular-nums ${
                  stat.highlight && stat.value > 0
                    ? 'text-amber-600 dark:text-amber-400'
                    : ''
                }`}
              >
                {stat.value}
              </span>
              <span className="text-xs text-muted-foreground">
                {stat.label}
              </span>
            </CardContent>
          </Card>
        ))}
      </div>

      <Separator />

      <Tabs defaultValue="learners">
        <TabsList>
          <TabsTrigger value="learners">Learners</TabsTrigger>
          <TabsTrigger value="sources">Sources</TabsTrigger>
          <TabsTrigger value="content">Content</TabsTrigger>
        </TabsList>

        <TabsContent value="learners">
          <Card>
            <CardContent className="overflow-x-auto pt-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="pb-2 pr-4 font-medium">Name</th>
                    <th className="pb-2 pr-4 font-medium">Email</th>
                    <th className="pb-2 pr-4 font-medium">Role</th>
                    <th className="pb-2 pr-4 font-medium text-right">Started</th>
                    <th className="pb-2 pr-4 font-medium text-right">Mastered</th>
                    <th className="pb-2 pr-4 font-medium text-right">Needs review</th>
                    <th className="pb-2 pr-4 font-medium text-right">Misconceptions</th>
                    <th className="pb-2 font-medium">Last active</th>
                  </tr>
                </thead>
                <tbody>
                  {learners.map((l) => {
                    const struggling =
                      l.needsReview >= 3 || l.openMisconceptions >= 2
                    return (
                      <tr
                        key={l.id}
                        className={`border-b last:border-0 ${
                          struggling
                            ? 'bg-amber-50/60 dark:bg-amber-950/20'
                            : ''
                        }`}
                      >
                        <td className="py-2 pr-4">
                          <div className="flex items-center gap-2">
                            {struggling && (
                              <AlertTriangle
                                data-icon
                                className="size-4 shrink-0 text-amber-500"
                              />
                            )}
                            {l.name}
                          </div>
                        </td>
                        <td className="py-2 pr-4 text-muted-foreground">
                          {l.email}
                        </td>
                        <td className="py-2 pr-4">
                          <Badge variant={l.role === 'ADMIN' ? 'default' : 'outline'}>
                            {l.role}
                          </Badge>
                        </td>
                        <td className="py-2 pr-4 text-right tabular-nums">
                          {l.conceptsStarted}
                        </td>
                        <td className="py-2 pr-4 text-right tabular-nums">
                          {l.conceptsMastered}
                        </td>
                        <td className="py-2 pr-4 text-right tabular-nums">
                          {l.needsReview}
                        </td>
                        <td className="py-2 pr-4 text-right tabular-nums">
                          {l.openMisconceptions}
                        </td>
                        <td className="py-2 text-muted-foreground">
                          {l.lastActiveAt
                            ? new Date(l.lastActiveAt).toLocaleDateString()
                            : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sources">
          <div className="flex flex-col gap-4">
            <AdminSourceActions />
            {sources.length === 0 ? (
              <Card>
                <CardContent className="pt-6 text-center text-sm text-muted-foreground">
                  No sources yet. Create one to start attributing course claims.
                </CardContent>
              </Card>
            ) : (
              <div className="flex flex-col gap-2">
                {sources.map((source) => {
                  const transitions = allowedTransitions(source.status)
                  return (
                    <Card key={source.id}>
                      <CardHeader>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex flex-col gap-1">
                            <CardTitle className="text-base">
                              {source.title}
                            </CardTitle>
                            <CardDescription>
                              {source.courseName ?? 'No course'} ·{' '}
                              {tierLabel(source.authorityLevel)}
                            </CardDescription>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={statusColor(source.status)}>
                              {source.status}
                            </Badge>
                            {transitions.length > 0 && (
                              <span className="text-xs text-muted-foreground">
                                → {transitions.join(', ')}
                              </span>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                    </Card>
                  )
                })}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="content">
          <div className="flex flex-col gap-2">
            {courses.map((course) => (
              <Card key={course.id}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-col gap-1">
                      <CardTitle className="text-base">{course.title}</CardTitle>
                      <CardDescription>{course.category}</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">
                        {course.moduleCount} modules
                      </Badge>
                      <Badge variant="secondary">
                        {course.conceptCount} concepts
                      </Badge>
                      <Link
                        href={`/courses/${course.slug}`}
                        className="text-muted-foreground transition-colors hover:text-foreground"
                        aria-label={`Open ${course.title}`}
                      >
                        <ExternalLink data-icon className="size-4" />
                      </Link>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
