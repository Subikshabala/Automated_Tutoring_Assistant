import Link from 'next/link'
import { GraduationCap } from 'lucide-react'
import { NavMain } from '@/components/nav-main'
import { ModeToggle } from '@/components/mode-toggle'
import { UserMenu } from '@/components/user-menu'
import { getSessionUser } from '@/lib/auth/session'
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'

export async function AppShell({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser()

  return (
    <SidebarProvider>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-background focus:px-4 focus:py-2 focus:ring-2 focus:ring-ring"
      >
        Skip to content
      </a>
      <Sidebar collapsible="icon">
        <SidebarHeader className="h-14 justify-center border-b border-sidebar-border">
          <Link href="/" className="flex items-center gap-2 px-2 py-1.5">
            <GraduationCap data-icon className="size-5 text-primary" />
            <span className="font-semibold group-data-[collapsible=icon]:hidden">
              Adaptive
            </span>
          </Link>
        </SidebarHeader>
        <SidebarContent>
          <NavMain role={user?.role} />
        </SidebarContent>
      </Sidebar>

      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background px-4">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-4" />
          <div className="ml-auto flex items-center gap-1">
            <ModeToggle />
            <UserMenu user={user} />
          </div>
        </header>
        {/* min-w-0 lets wide children (React Flow, tables) shrink instead of
            pushing the whole inset past the viewport. */}
        <main
          id="main-content"
          className="flex min-w-0 flex-1 flex-col gap-6 p-6"
        >
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
