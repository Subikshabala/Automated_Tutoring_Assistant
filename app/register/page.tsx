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

export const metadata = { title: 'Create account — Adaptive' }

export default function RegisterPage() {
  return (
    <div className="mx-auto flex min-h-svh w-full max-w-sm flex-col justify-center px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle>Create your account</CardTitle>
          <CardDescription>
            Your progress and materials stay tied to this account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<Skeleton className="h-72 w-full" />}>
            <AuthForm mode="register" />
          </Suspense>
        </CardContent>
        <CardFooter className="text-sm text-muted-foreground">
          Already registered?{' '}
          <Link href="/login" className="ml-1 font-medium text-foreground underline-offset-4 hover:underline">
            Sign in
          </Link>
        </CardFooter>
      </Card>
    </div>
  )
}
