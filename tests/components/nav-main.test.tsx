import { describe, expect, it, vi } from 'vitest'
import { NAV_ITEMS } from '@/components/nav-main'

vi.mock('next/navigation', () => ({
  usePathname: () => '/explore',
}))

describe('NAV_ITEMS', () => {
  it('lists the six primary destinations', () => {
    expect(NAV_ITEMS.map((i) => i.href)).toEqual([
      '/explore',
      '/progress',
      '/materials',
      '/concept-map',
      '/profile',
      '/admin',
    ])
  })

  it('gives every item a label and an icon', () => {
    for (const item of NAV_ITEMS) {
      expect(item.label.length).toBeGreaterThan(0)
      expect(item.icon).toBeTruthy()
    }
  })
})
