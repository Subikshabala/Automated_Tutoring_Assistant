import Link from 'next/link'
import {
  ArrowRight,
  FileText,
  GraduationCap,
  Map,
  Network,
  PenTool,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CourseCard } from '@/components/course-card'
import { HowItWorks } from '@/components/how-it-works'
import { ModeToggle } from '@/components/mode-toggle'
import { listCourses } from '@/lib/repositories/course'

export const dynamic = 'force-dynamic'

const STEPS = [
  {
    title: 'Assess',
    description:
      'A short diagnostic finds where your understanding actually stops.',
  },
  {
    title: 'Learn',
    description:
      'The tutor explains the next concept in the order the prerequisites demand.',
  },
  {
    title: 'Prove it',
    description:
      'Short answers are graded on understanding, not keyword matching.',
  },
  {
    title: 'Adapt',
    description: 'Your mastery scores reshape what comes next.',
  },
]

const DIFFERENTIATORS = [
  {
    icon: Network,
    title: 'Concept maps, not syllabi',
    description:
      'Every course is a prerequisite graph. You are never sent to a topic you are not ready for.',
  },
  {
    icon: PenTool,
    title: 'Draw your own map',
    description:
      'Sketch what you think connects to what, then compare it against the canonical structure and see exactly where your model is wrong.',
  },
  {
    icon: FileText,
    title: 'Bring your own material',
    description:
      'Upload lecture notes or a paper. Answers come only from that document, with the supporting passages quoted.',
  },
]

export default async function LandingPage() {
  const courses = await listCourses({})

  return (
    <div className="flex min-h-svh flex-col bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
          <Link
            href="/"
            className="flex items-center gap-2 font-semibold tracking-tight"
          >
            <GraduationCap aria-hidden="true" className="size-5 text-primary" />
            Adaptive
          </Link>
          <div className="flex items-center gap-2">
            <ModeToggle />
           <Button
              variant="ghost"
              size="sm"
              nativeButton={false}
              render={<Link href="/login" />}
            >
              Sign in
            </Button>
            <Button
              size="sm"
              nativeButton={false}
              render={<Link href="/register" />}
            >
              Get started
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto flex w-full max-w-6xl flex-col items-center gap-6 px-4 py-16 text-center sm:py-20 md:py-28">
        <h1 className="max-w-3xl text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl lg:text-6xl">
          Learn what you actually do not know.
        </h1>
        <p className="max-w-2xl text-lg text-muted-foreground md:text-xl">
          An AI tutor that assesses your understanding concept by concept, then
          teaches exactly the gaps — grounded in a real prerequisite map, not a
          linear syllabus.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button
            size="lg"
            nativeButton={false}
            render={<Link href="/explore" />}
          >
            Start learning
            <ArrowRight aria-hidden="true" data-icon />
          </Button>
          <Button
            variant="outline"
            size="lg"
            nativeButton={false}
            render={<Link href="/courses/generative-ai/map" />}
          >
            <Map aria-hidden="true" data-icon />
            See a concept map
          </Button>
        </div>
      </section>

      {/* Proof strip — real courses from the database */}
      {courses.length > 0 && (
        <section className="border-y border-border bg-muted/30">
          <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-12">
            <h2 className="text-center text-sm font-medium uppercase tracking-wider text-muted-foreground">
              Available courses
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {courses.map((course) => (
                <CourseCard key={course.id} course={course} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* How it works */}
      <HowItWorks steps={STEPS} />

      {/* Differentiators */}
      <section className="border-t border-border bg-muted/20">
        <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-16">
          <h2 className="text-center text-2xl font-semibold tracking-tight">
            What makes this different
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {DIFFERENTIATORS.map((d) => (
              <Card key={d.title} className="border-border">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
                      <d.icon aria-hidden="true" data-icon className="size-4" />
                    </div>
                    <CardTitle className="text-base">{d.title}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {d.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 py-10 text-center">
          <Link
            href="/"
            className="flex items-center gap-2 font-semibold tracking-tight"
          >
            <GraduationCap aria-hidden="true" className="size-5 text-primary" />
            Adaptive
          </Link>
          <p className="max-w-md text-sm text-muted-foreground">
            A research prototype exploring how prerequisite graphs and AI
            assessment can replace linear course playback.
          </p>
          <nav className="flex gap-4 text-sm text-muted-foreground">
            <Link href="/explore" className="hover:text-foreground">
              Explore courses
            </Link>
            <Link href="/login" className="hover:text-foreground">
              Sign in
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  )
}
