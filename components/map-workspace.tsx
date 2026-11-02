'use client'

import { useCallback, useRef, useState } from 'react'
import { GitCompare, Plus, Save, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Spinner } from '@/components/ui/spinner'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import {
  MapEditor,
  addNode,
  removeNode,
  renameNode,
  toSavePayload,
  type EditorState,
  type MapEditorHandle,
} from '@/components/map-editor'
import { MapComparisonView } from '@/components/map-comparison'
import { apiFetch } from '@/lib/fetcher'
import type { MapComparison } from '@/lib/map-compare'
import type { MapFeedback } from '@/lib/schemas/student-map'
import { ConceptPalette, type PaletteConcept } from '@/components/concept-palette'

type CompareResult = {
  comparison: MapComparison
  feedback: MapFeedback
}

export function MapWorkspace({
  courseSlug,
  conceptPalette,
  initial,
}: {
  courseSlug: string
  conceptPalette: PaletteConcept[]
  initial: ({ id: string; title: string } & EditorState) | null
}) {
  const editorRef = useRef<MapEditorHandle | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [mapId, setMapId] = useState(initial?.id)
  const [title, setTitle] = useState(initial?.title ?? 'My concept map')
  const [state, setState] = useState<EditorState>({
    nodes: initial?.nodes ?? [],
    edges: initial?.edges ?? [],
  })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [newLabel, setNewLabel] = useState('')
  const [saving, setSaving] = useState(false)
  const [comparing, setComparing] = useState(false)
  const [result, setResult] = useState<CompareResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const selected = state.nodes.find((n) => n.id === selectedId) ?? null

  const addConcept = useCallback(
    (label: string) => {
      const trimmed = label.trim()
      if (!trimmed) return

      const anchor = editorRef.current?.viewportCentre() ?? { x: 0, y: 0 }
      const next = addNode(state, trimmed, anchor)
      const created = next.nodes[next.nodes.length - 1]

      setState(next)
      setSelectedId(created.id)
      requestAnimationFrame(() => editorRef.current?.focusNode(created.id))
    },
    [state],
  )

  function handleAdd() {
    addConcept(newLabel)
    setNewLabel('')
    inputRef.current?.focus()
  }

  async function save() {
    if (state.nodes.length === 0) {
      setError('Add at least one concept before saving.')
      return
    }

    setSaving(true)
    setError(null)
    try {
      const saved = await apiFetch<{ id: string } & EditorState>(
        '/api/concept-maps',
        {
          method: 'POST',
          json: toSavePayload(state, courseSlug, title, mapId),
        },
      )
      setMapId(saved.id)
      setState({ nodes: saved.nodes, edges: saved.edges })
      toast.success('Map saved')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save your map')
    } finally {
      setSaving(false)
    }
  }

  async function compare() {
    if (!mapId) {
      setError('Save your map before comparing it.')
      return
    }

    setComparing(true)
    setError(null)
    try {
      const response = await apiFetch<CompareResult>(
        `/api/concept-maps/${mapId}/compare`,
        { method: 'POST' },
      )
      setResult(response)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not compare your map')
    } finally {
      setComparing(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card className="flex flex-col gap-4 p-4">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Name your map"
          className="max-w-sm font-medium"
        />

        <Separator />

        <div className="flex flex-wrap items-center gap-2">
          <Input
            ref={inputRef}
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            placeholder="Or add your own concept..."
            className="max-w-xs"
          />
          <Button
            variant="secondary"
            onClick={handleAdd}
            disabled={newLabel.trim().length === 0}
          >
            <Plus data-icon />
            Add
          </Button>

          <div className="ml-auto flex gap-2">
            <Button onClick={() => void save()} disabled={saving}>
              {saving ? <Spinner data-icon /> : <Save data-icon />}
              Save
            </Button>
            <Button
              variant="outline"
              onClick={() => void compare()}
              disabled={comparing || !mapId}
            >
              {comparing ? <Spinner data-icon /> : <GitCompare data-icon />}
              Compare
            </Button>
          </div>
        </div>

        {selected && (
          <>
            <Separator />
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Selected
              </span>
              <Input
                value={selected.label}
                onChange={(e) =>
                  setState((prev) => renameNode(prev, selected.id, e.target.value))
                }
                className="max-w-xs"
              />
              <Button
                variant="ghost"
                size="icon"
                aria-label="Delete concept"
                onClick={() => {
                  setState((prev) => removeNode(prev, selected.id))
                  setSelectedId(null)
                }}
              >
                <Trash2 data-icon />
              </Button>
            </div>
          </>
        )}
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <ConceptPalette
        concepts={conceptPalette}
        usedLabels={state.nodes.map((n) => n.label)}
        onAdd={addConcept}
      />

      <MapEditor
        handleRef={editorRef}
        state={state}
        onChange={setState}
        onSelect={setSelectedId}
        selectedId={selectedId}
      />

      {result && (
        <MapComparisonView
          comparison={result.comparison}
          feedback={result.feedback}
        />
      )}
    </div>
  )
}
