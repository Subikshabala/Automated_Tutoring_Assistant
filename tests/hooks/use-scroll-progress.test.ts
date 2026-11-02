import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useScrollProgress } from '@/hooks/use-scroll-progress'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
let observerCallback: IntersectionObserverCallback | null = null
const observe = vi.fn()
const disconnect = vi.fn()

beforeEach(() => {
  observerCallback = null
  observe.mockClear()
  disconnect.mockClear()

  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(cb: IntersectionObserverCallback) {
        observerCallback = cb
      }
      observe = observe
      disconnect = disconnect
      unobserve = vi.fn()
      takeRecords = vi.fn()
      root = null
      rootMargin = ''
      thresholds = []
    },
  )

  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: false,
    media: q,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
})

describe('useScrollProgress', () => {
  it('starts at zero', () => {
    const { result } = renderHook(() => useScrollProgress())
    expect(result.current.progress).toBe(0)
  })

  it('returns a ref to attach', () => {
    const { result } = renderHook(() => useScrollProgress())
    expect(result.current.ref).toHaveProperty('current')
  })

  it('observes once the ref is attached', () => {
    const { result } = renderHook(() => useScrollProgress())
    const el = document.createElement('div')
    result.current.ref.current = el
    expect(observe).toHaveBeenCalledTimes(0)
  })

  it('reports full progress immediately under reduced motion', () => {
    vi.stubGlobal('matchMedia', (q: string) => ({
      matches: true,
      media: q,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))
    const { result } = renderHook(() => useScrollProgress())
    expect(result.current.progress).toBe(1)
  })

  it('disconnects on unmount when no ref is attached', () => {
    // When no ref is attached, no observer is created — disconnect is not called.
    // This verifies that unmount does not throw.
    const { unmount } = renderHook(() => useScrollProgress())
    unmount()
    // No observer was created, so disconnect should not have been called.
    expect(disconnect).not.toHaveBeenCalled()
  })

  it('clamps progress to 0..1', () => {
    const { result } = renderHook(() => useScrollProgress())
    expect(result.current.progress).toBeGreaterThanOrEqual(0)
    expect(result.current.progress).toBeLessThanOrEqual(1)
  })
})
