import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SidebarProvider, SidebarRail } from '@/components/ui/sidebar'

vi.mock('next/navigation', () => ({
  usePathname: () => '/explore',
}))

beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
})

describe('SidebarRail', () => {
  it('does not cover the header band', () => {
    const { container } = render(
      <SidebarProvider>
        <SidebarRail />
      </SidebarProvider>,
    )
    const rail = container.querySelector('[data-slot="sidebar-rail"]')

    // Either suppressed entirely, or offset below the 56px header.
    if (rail) {
      expect(rail.className).toContain('top-14')
    } else {
      expect(rail).toBeNull()
    }
  })

  it('never sits above the sticky header', () => {
    const { container } = render(
      <SidebarProvider>
        <SidebarRail />
      </SidebarProvider>,
    )
    const rail = container.querySelector('[data-slot="sidebar-rail"]')
    if (rail) {
      expect(rail.className).not.toContain('z-20')
    }
  })

  it('keeps its indicator transparent until hover', () => {
    const { container } = render(
      <SidebarProvider>
        <SidebarRail />
      </SidebarProvider>,
    )
    const rail = container.querySelector('[data-slot="sidebar-rail"]')
    if (rail) {
      expect(rail.className).toContain('hover:after:bg-sidebar-border')
    }
  })
})
