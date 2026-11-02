'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Compass,
  FileText,
  LayoutDashboard,
  Network,
  Shield,
  User,
  type LucideIcon,
} from 'lucide-react'
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'

export type NavItem = {
  href: string
  label: string
  icon: LucideIcon
}

export const NAV_ITEMS: NavItem[] = [
  { href: '/explore', label: 'Explore', icon: Compass },
  { href: '/progress', label: 'Progress', icon: LayoutDashboard },
  { href: '/materials', label: 'Materials', icon: FileText },
  { href: '/concept-map', label: 'Concept Maps', icon: Network },
  { href: '/profile', label: 'Profile', icon: User },
  { href: '/admin', label: 'Admin', icon: Shield },
]

export function NavMain({ role }: { role?: 'USER' | 'ADMIN' }) {
  const pathname = usePathname()
  const items = NAV_ITEMS.filter(
    (item) => item.href !== '/admin' || role === 'ADMIN',
  )

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Platform</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => {
          const Icon = item.icon
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`)
          return (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton isActive={active} render={<Link href={item.href} />}>
                <Icon data-icon />
                <span>{item.label}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )
        })}
      </SidebarMenu>
    </SidebarGroup>
  )
}
