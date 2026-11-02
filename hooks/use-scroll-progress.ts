'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Reports how far a element has travelled through the viewport, 0 to 1.
 *
 * Returns 1 immediately when the user prefers reduced motion, so the
 * caller can render a completed state rather than an animation.
 */
export function useScrollProgress() {
  const ref = useRef<HTMLElement | null>(null)
  const reducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const [progress, setProgress] = useState(() => (reducedMotion ? 1 : 0))

  useEffect(() => {
    if (reducedMotion) return

    const element = ref.current
    if (!element) return

    let frame = 0

    const update = () => {
      frame = 0
      const rect = element.getBoundingClientRect()
      const viewport = window.innerHeight

      // 0 when the top edge enters from below, 1 when the element has
      // travelled most of the way up. The 0.6 keeps the fill finishing
      // before the section leaves view entirely.
      const travelled = viewport - rect.top
      const span = viewport * 0.6 + rect.height * 0.4

      setProgress(Math.min(1, Math.max(0, travelled / span)))
    }

    const onScroll = () => {
      // Coalesce to one update per frame.
      if (frame === 0) frame = requestAnimationFrame(update)
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          window.addEventListener('scroll', onScroll, { passive: true })
          update()
        } else {
          window.removeEventListener('scroll', onScroll)
        }
      },
      { threshold: 0 },
    )

    observer.observe(element)
    update()

    return () => {
      observer.disconnect()
      window.removeEventListener('scroll', onScroll)
      if (frame !== 0) cancelAnimationFrame(frame)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- reducedMotion is stable across renders
  }, [])

  return { ref, progress }
}
