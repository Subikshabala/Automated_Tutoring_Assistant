'use client'

import { useScrollProgress } from '@/hooks/use-scroll-progress'
import { cn } from '@/lib/utils'

export type Step = {
  title: string
  description: string
}

export function HowItWorks({ steps }: { steps: Step[] }) {
  const { ref, progress } = useScrollProgress()

  return (
    <section
      ref={ref as React.Ref<HTMLElement>}
      className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-16 sm:py-20"
    >
      <h2 className="text-center text-2xl font-semibold tracking-tight">
        How it works
      </h2>

      <div className="relative">
        {/* Connector. Vertical on mobile, horizontal from sm up. */}
        <div
          data-testid="step-track"
          aria-hidden="true"
          className={cn(
            'absolute bg-border',
            // mobile: a vertical line down the left, behind the markers
            'left-5 top-0 h-full w-px',
            // desktop: a horizontal line across the marker row
            'sm:left-0 sm:top-5 sm:h-px sm:w-full',
          )}
        >
          <div
            data-testid="step-fill"
            style={{
              transform: `scaleX(${progress})`,
              ['--p' as string]: String(progress),
            }}
            className={cn(
              'h-full w-full origin-top bg-primary sm:origin-left',
              'transition-transform duration-300 ease-out',
              // On mobile the line is vertical, so scale the other axis.
              'max-sm:[transform:scaleY(var(--p))]',
            )}
          />
        </div>

        <ol className="relative grid gap-8 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4">
          {steps.map((step, index) => {
            // A marker is "reached" once the fill passes its position.
            const position = steps.length > 1 ? index / (steps.length - 1) : 0
            const reached = progress >= position

            return (
              <li
                key={step.title}
                className="flex gap-4 sm:flex-col sm:items-center sm:gap-3 sm:text-center"
              >
                <div
                  data-testid={`step-marker-${index}`}
                  data-reached={reached}
                  className={cn(
                    'flex size-10 shrink-0 items-center justify-center rounded-full',
                    'border-2 text-sm font-semibold',
                    'transition-colors duration-300',
                    reached
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-background text-muted-foreground',
                  )}
                >
                  {index + 1}
                </div>

                <div className="flex flex-col gap-1.5">
                  <h3 className="text-base font-semibold">{step.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {step.description}
                  </p>
                </div>
              </li>
            )
          })}
        </ol>
      </div>
    </section>
  )
}
