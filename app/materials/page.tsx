import { redirect } from 'next/navigation'
import { MaterialsClient } from './materials-client'
import { listMaterials } from '@/lib/repositories/material'
import { getSessionUser } from '@/lib/auth/session'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Your materials — Adaptive',
}

export default async function MaterialsPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')
  const materials = await listMaterials(user.id)

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Your materials</h1>
        <p className="text-sm text-muted-foreground">
          Upload your own notes or papers. Answers come only from what you
          uploaded — never from the model&apos;s general knowledge.
        </p>
      </header>

      <MaterialsClient initial={materials} />
    </div>
  )
}
