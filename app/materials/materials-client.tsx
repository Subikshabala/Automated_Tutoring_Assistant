'use client'

import { useState } from 'react'
import { MaterialUpload } from '@/components/material-upload'
import { MaterialList } from '@/components/material-list'
import type { MaterialSummary } from '@/lib/schemas/material'

export function MaterialsClient({
  initial,
}: {
  initial: MaterialSummary[]
}) {
  const [materials, setMaterials] = useState(initial)

  return (
    <div className="flex flex-col gap-6">
      <MaterialUpload
        onUploaded={(material) => setMaterials((prev) => [material, ...prev])}
      />
      <MaterialList materials={materials} />
    </div>
  )
}
