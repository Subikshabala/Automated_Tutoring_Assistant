# Progress

## Done

- [x] Phase 0 — Foundation: Prisma schema, 19 tables, API envelope, Zod contracts, Vitest, app shell
- [x] Phase 1 — Course catalog: 3 seeded courses, 28 concepts, explore and detail pages
- [x] Phase 2 — Concept maps: layered React Flow graph with detail panel
- [x] Phase 3 — AI tutor: Gemini client, structured explanations, chat, explanation cache
- [x] Phase 4 — Assessment: generated quizzes, deterministic MCQ grading, semantic short-answer grading, mastery
- [x] Phase 5 — Materials: PDF and text upload, chunking, keyword retrieval, grounded answers
- [x] Phase 6 — Student maps: editable canvas, save, fuzzy comparison against canonical
- [x] Phase 7 — Adaptive engine: prerequisite-gated recommendations, progress dashboard
- [x] Phase 8 — Auth and admin: bcrypt, JWT sessions, Next.js 16 proxy, role-gated admin
- [x] Phase 9 — Polish: landing page, error boundaries, loading states, a11y, production build
- [x] v2 A1 — OpenAI-compatible client, 5 providers by env var, Groq default with strict JSON
- [x] v2 A2 — Fixed the Base UI menu crash that took the whole app down
- [x] v2 A3 — `/concept-map` index page
- [x] v2 B1–B3 — Local embeddings, hybrid semantic+keyword retrieval, Q&A history with suggestions and source visibility
- [x] v2 C1–C3 — Map spacing, barycentre crossing reduction, custom themed edges with legend, navigable panel refs
- [x] v2 D1–D2 — Fixed the Add button, concept palette with Hide toggle
- [x] v2 E1–E2 — Situation-aware recommendation copy, curriculum accordion
- [x] v2 F1–F2 — Scroll-filled progress line, sidebar rail seam fix
- [x] v2 G1–G4 — Diagnostic assessment, session tracking, misconceptions with Socratic repair, real admin
- [x] v2 G5 — Demo walkthrough: seed-demo.ts, reset-demo.ts, DEMO.md, README refresh

## In progress

- [ ] Nothing — v2 complete

## Next

Candidate follow-ups, none started:

- [ ] Admin course authoring — `/admin` is read-only
- [ ] Source management UI — the `Source` table exists and is unused

## Notes

**v2 summary.** Nineteen chunks. The app runs, the AI works across 5 providers,
retrieval is hybrid semantic + keyword, the maps are legible with themed edges,
the copy reads like a person wrote it, and four previously-dead tables
(`LearningSession`, `LearningProgress`, `Misconception`, `Source`) now carry
real data. Demo walkthrough runs in five minutes from a clean clone.

**Database path.** Prisma's `file:./dev.db` in `prisma.config.ts` resolves
relative to the schema directory for migrations, but the libsql adapter in
`lib/prisma.ts` and scripts resolves from CWD. All scripts and the app use
`path.resolve(cwd, 'dev.db')` to match the adapter.

**Where the model is and is not trusted.** The LLM writes explanations, grades
short answers, and phrases feedback. It does not decide what to recommend, does
not compute mastery, and does not judge concept-map correctness — those are
pure functions in `lib/adaptive.ts`, `lib/mastery.ts` and `lib/map-compare.ts`.
Every model response passes through a Zod schema before anything downstream sees it.

**Graceful degradation.** Map feedback (`lib/ai/map-feedback.ts`) and the coach
summary (`lib/ai/coach.ts`) fall back to deterministic text when the model
fails. Explanations do not fall back — a fabricated explanation would be worse
than an error.

**Prisma 7 gotchas.** The generator is `prisma-client`, not `prisma-client-js`.
The import path must end in `/client`. The datasource URL lives in
`prisma.config.ts`, not in the schema.

**Next.js 16 gotchas.** Dynamic route `params` is a Promise and must be awaited.
Middleware is called Proxy — the file is `proxy.ts` and the export is `proxy`;
a file named `middleware.ts` is silently ignored.
