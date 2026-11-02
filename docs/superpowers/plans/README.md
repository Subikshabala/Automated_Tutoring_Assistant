# AI Adaptive Learning Platform — Implementation Plan Index

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement these plans phase-by-phase. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an AI-powered adaptive technology learning platform where students explore courses, learn concepts with an AI tutor, get assessed, build concept maps, upload their own materials, and receive adaptive recommendations.

**Architecture:** Single Next.js 16 App Router application. Server-side API Route Handlers (`app/api/**/route.ts`) replace the Express backend described in the source architecture doc. Prisma + SQLite for persistence. Google Gemini for all AI generation with Zod-validated structured output. React Flow for concept-map visualisation. shadcn/ui (`base-nova` style, `@base-ui/react` primitives) for the entire UI layer.

**Tech Stack:** Next.js 16.3.6 · React 19.3.0 · TypeScript 5 · Tailwind CSS v4 · shadcn/ui (base-nova) · Prisma 7 · SQLite · Zod · TanStack Query · React Flow · Google Gemini API · jose (JWT) · bcryptjs · Vitest

---

## Phase Files

Read them in order. Each phase produces working, demoable software on its own.

| # | File | Slice | Outcome |
|---|------|-------|---------|
| 0 | [`phase-00-foundation.md`](./phase-00-foundation.md) | — | Prisma schema, DB, env, shared Zod contracts, test harness, app shell |
| 1 | [`phase-01-course-catalog.md`](./phase-01-course-catalog.md) | 1 | Browse courses → view course detail with modules/topics |
| 2 | [`phase-02-concept-map.md`](./phase-02-concept-map.md) | 2 | Interactive React Flow concept map per course |
| 3 | [`phase-03-ai-tutor.md`](./phase-03-ai-tutor.md) | 3 | Gemini-powered concept explanations + Q&A chat |
| 4 | [`phase-04-assessment-mastery.md`](./phase-04-assessment-mastery.md) | 4 | Generated quizzes, AI grading, mastery tracking |
| 5 | [`phase-05-materials-rag.md`](./phase-05-materials-rag.md) | 5 | Upload PDF/TXT → chunk → retrieve → grounded answers |
| 6 | [`phase-06-student-maps.md`](./phase-06-student-maps.md) | 6 | Student draws own map → compare vs canonical → feedback |
| 7 | [`phase-07-adaptive-engine.md`](./phase-07-adaptive-engine.md) | 7 | Next-best-action recommendations from mastery data |
| 8 | [`phase-08-auth-admin.md`](./phase-08-auth-admin.md) | 8 | Email/password auth, JWT sessions, admin CRUD |
| 9 | [`phase-09-polish.md`](./phase-09-polish.md) | — | Landing page, progress dashboard, profile, a11y pass |

---

## Non-Negotiable Rules

These come from the source architecture document. Violating any of them is a task failure.

1. **Never fake an implementation.** No mock data standing in for a real API call, no hardcoded "AI" responses. If a thing cannot be built yet, the phase is not done.
2. **Never expose `GEMINI_API_KEY` to the client.** All Gemini calls happen in Route Handlers or Server Components. The key is read from `process.env` server-side only.
3. **Validate every AI output with Zod** before it touches the database or the UI. A malformed model response must produce a handled error, not a crash.
4. **Vertical slices.** Each phase goes DB → API → UI and ends in something a human can click.
5. **TDD.** Write the failing test, watch it fail, write the minimum code, watch it pass, commit.
6. **shadcn/ui first.** Before writing custom markup, check whether a shadcn component already solves it (`Alert`, `Empty`, `Skeleton`, `Badge`, `Separator`, `Card`, `Field`). Follow `skills/shadcn.md`.

---

## Shared Conventions

Every phase assumes these. They are established in Phase 0.

- **Path alias:** `@/*` → project root. Import as `@/lib/prisma`, `@/components/ui/button`.
- **API shape:** success is `{ data: T }`, failure is `{ error: { code: string, message: string } }`. Status codes are meaningful (`400` validation, `401` unauth, `404` missing, `500` server).
- **Validation:** every Route Handler parses its input with a Zod schema from `@/lib/schemas/*` before doing work.
- **Dynamic params are Promises:** `const { courseId } = await params` — this is a Next.js 15+ requirement.
- **Prisma import:** `import prisma from '@/lib/prisma'` — never `new PrismaClient()` inline.
- **Spacing:** use `gap-*` on flex/grid containers, never `space-y-*`.
- **Icons:** always `data-icon` on a Lucide icon inside a shadcn component.
- **Tests:** colocated under `tests/`, mirroring source paths. Run with `npm test`.

---

## Progress Tracking

Update `PROGRESS.md` at the repository root after each completed task, not each completed phase.
