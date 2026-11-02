import Link from 'next/link'
import { Suspense } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { AuthForm } from '@/components/auth-form'

export const metadata = { title: 'Sign in — Adaptive' }

export default function LoginPage() {
  return (
    <div className="mx-auto flex min-h-svh w-full max-w-sm flex-col justify-center px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>
            Pick up where you left off.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<Skeleton className="h-56 w-full" />}>
            <AuthForm mode="login" />
          </Suspense>
        </CardContent>
        <CardFooter className="text-sm text-muted-foreground">
          No account?{' '}
          <Link href="/register" className="ml-1 font-medium text-foreground underline-offset-4 hover:underline">
            Create one
          </Link>
        </CardFooter>
      </Card>
    </div>
  )
}
