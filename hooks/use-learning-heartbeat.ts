'use client'

import { useEffect, useRef } from 'react'

const INTERVAL_MS = 30_000

/**
 * Reports time spent on the active concept.
 *
 * Pauses when the tab is hidden, and flushes on unmount so switching
 * concepts does not lose the trailing partial interval.
 */
export function useLearningHeartbeat(topicId: string, conceptId: string) {
  const accumulated = useRef(0)
  const lastTick = useRef(0)

  useEffect(() => {
    accumulated.current = 0
    lastTick.current = Date.now()

    const send = (seconds: number) => {
      if (seconds <= 0) return
      void fetch('/api/learning/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topicId, conceptId, seconds }),
        keepalive: true,
      }).catch(() => {
        // Tracking is best-effort. Never surface a failure to the learner.
      })
    }

    const tick = () => {
      if (document.hidden) {
        // Discard the elapsed window — the learner was not looking.
        lastTick.current = Date.now()
        return
      }
      const elapsed = Math.round((Date.now() - lastTick.current) / 1000)
      lastTick.current = Date.now()
      accumulated.current += elapsed
      send(elapsed)
    }

    const timer = setInterval(tick, INTERVAL_MS)

    return () => {
      clearInterval(timer)
      // Flush the partial interval on concept change or unmount.
      const elapsed = Math.round((Date.now() - lastTick.current) / 1000)
      if (!document.hidden) send(elapsed)
    }
  }, [topicId, conceptId])
}
