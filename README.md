<<<<<<< HEAD
# Adaptive — AI Learning Platform

An AI tutor that assesses understanding concept by concept, then teaches the
gaps in prerequisite order.

## What it does

- **Course catalog** — browse courses organised as prerequisite graphs, not linear syllabi
- **Concept maps** — interactive prerequisite graphs with themed edges, animated dependencies, detail panels and navigable cross-references
- **AI tutor** — LLM-generated explanations with follow-up chat, grounded in the course definitions
- **Assessment** — generated quizzes; MCQs graded deterministically, short answers graded semantically by the model
- **Diagnostic assessment** — on first course visit, a short diagnostic places you on the map before you start
- **Mastery tracking** — EMA-smoothed score per concept, updated from assessment results
- **Adaptive recommendations** — situation-aware recommendations (blocked, shaky, nearly there, ready) with human-written reasons
- **Misconception tracking** — the model detects specific wrong beliefs from short-answer phrasing and offers Socratic repair
- **Session tracking** — learning sessions recorded automatically with resume support
- **Your own materials** — upload a PDF or text file, ask questions answered by hybrid semantic + keyword retrieval running locally
- **Student concept maps** — draw your own map, compare it against the canonical one, get specific structural feedback
- **Admin dashboard** — real analytics: who is stuck, which concepts are unreached, source attribution
- **Scroll-progress landing** — step-by-step connector that fills as you scroll through "How it works"
- **Curriculum accordion** — first module open, rest collapsed, expandable

## Try it quickly

```bash
npm install --legacy-peer-deps
cp .env.example .env     # add GROQ_API_KEY from console.groq.com
npx prisma migrate deploy
npx prisma generate
npm run db:seed          # 3 courses, 28 concepts
npm run db:demo          # a learner with history
npm run dev
```

Sign in as `demo@adaptive.local` / `demo-password-1234`, then follow
[`docs/DEMO.md`](./docs/DEMO.md).

## Setup

Requires Node 20 or later.

```bash
npm install --legacy-peer-deps
cp .env.example .env
```

Fill in `.env`:

- `LLM_PROVIDER` — one of `groq` (default), `gemini`, `openrouter`, `cerebras`, `ollama`
- The API key for your chosen provider (e.g. `GROQ_API_KEY` from [console.groq.com](https://console.groq.com))
- `JWT_SECRET` — generate with `openssl rand -base64 32`

Then set up the database:

```bash
npx prisma migrate deploy
npx prisma generate
npm run db:seed
```

## Running

```bash
npm run dev          # development server on :3000
npm run build        # production build
npm run start        # production server
npm test             # test suite
npm run typecheck    # type check
npm run lint         # lint
npm run db:demo      # seed a demo learner with realistic history
npm run db:reset-demo # wipe learner data and re-seed
npm run db:embed     # backfill embeddings for uploaded materials
```

## Making yourself an admin

Register an account through the UI, then:

```bash
npx tsx scripts/make-admin.ts your@email.com
```

Sign out and back in — the role is carried in the session token.

## Architecture

Single Next.js 16 App Router application. Server-side Route Handlers under
`app/api/` replace a separate backend. Prisma 7 with libsql adapter and SQLite for persistence.

| Directory | Contents |
|---|---|
| `app/` | Routes, pages and API handlers |
| `components/` | React components (`ui/` is shadcn-generated) |
| `lib/` | Domain logic, repositories, AI services, schemas |
| `lib/ai/` | OpenAI-compatible client with 5 providers by env var |
| `lib/text/` | Local embeddings (HuggingFace all-MiniLM-L6-v2), chunking, hybrid retrieval |
| `lib/repositories/` | All Prisma access |
| `lib/schemas/` | Zod contracts — the source of truth for types |
| `prisma/` | Schema, migrations, seed data |
| `tests/` | Vitest suite, mirroring the source layout |
| `scripts/` | CLI tools: admin, demo seed, embedding backfill |

### Rules this codebase follows

1. No faked implementations. If something cannot be built, it is not shipped.
2. API keys are read server-side only and never reach the client.
3. Every AI response is validated with Zod before it touches the database or the UI.
4. Route Handlers return `{ data }` on success and `{ error: { code, message } }` on failure.
5. Authorisation is enforced in every handler, not only in `proxy.ts`.

## Implementation plans

The phase-by-phase plans used to build this live in
[`docs/superpowers/plans/`](./docs/superpowers/plans/).
=======
# Automated_Tutoring_Assistant
>>>>>>> ca474b32121c212f63e51e97b6317069cee6ff34
