import type { Metadata } from 'next'
import { ThemeProvider } from '@/components/theme-provider'
import { QueryProvider } from '@/lib/query-provider'
import { AppShell } from '@/components/app-shell'
import { ConditionalShell } from '@/components/conditional-shell'
import { Toaster } from '@/components/ui/sonner'
import './globals.css'


export const metadata: Metadata = {
  title: {
    default: 'Adaptive — AI learning that follows your actual understanding',
    template: '%s',
  },
  description:
    'An AI tutor that assesses your understanding concept by concept, then teaches exactly the gaps — grounded in a real prerequisite map.',
  keywords: [
    'adaptive learning',
    'AI tutor',
    'concept map',
    'mastery learning',
  ],
  openGraph: {
    title: 'Adaptive',
    description:
      'Learn what you actually do not know. An AI tutor built on prerequisite graphs and real assessment.',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      {/* suppressHydrationWarning: browser extensions such as Grammarly inject
          attributes into <body> before React hydrates. */}
      <body className="antialiased" suppressHydrationWarning>
        <ThemeProvider>
          <QueryProvider>
            <ConditionalShell shell={<AppShell>{children}</AppShell>}>
              {children}
            </ConditionalShell>
            <Toaster />
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
