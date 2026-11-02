# Adaptive — AI Learning Platform

An AI tutor that assesses understanding concept by concept, then teaches the gaps in prerequisite order.

**Watch first:** [`docs/media/adaptive-demo-walkthrough.mp4`](./docs/media/adaptive-demo-walkthrough.mp4) — a 2:45 silent screen capture of the whole product. The written companion is [`docs/DEMO.md`](./docs/DEMO.md).

---

## Contents

1. [What it does](#what-it-does)
2. [Prerequisites](#prerequisites)
3. [Install](#install)
4. [Configure](#configure)
5. [Run](#run)
6. [The five-minute demo](#the-five-minute-demo)
7. [Using it properly](#using-it-properly)
8. [Admin](#admin)
9. [Commands](#commands)
10. [How it works](#how-it-works)
11. [Troubleshooting](#troubleshooting)

---

## What it does

| | |
|---|---|
| **Courses as graphs** | Every course is a prerequisite graph, not a linear syllabus. You are never sent to a topic you are not ready for. |
| **Diagnostic first** | A short cold-start quiz finds where your understanding actually stops, so the first recommendation is already personal. |
| **AI tutor** | Structured explanations — simple explanation, why it matters, a worked example, key points, a check question — plus follow-up chat. |
| **Real grading** | MCQs graded deterministically. Short answers graded on understanding, not keyword overlap. |
| **Misconceptions** | When grading spots a specific wrong belief, it is recorded with evidence and surfaced with a Socratic repair flow that asks rather than tells. |
| **Adaptive path** | Mastery scores reshape what comes next. Recommendations name what is blocking what. |
| **Your own material** | Upload a PDF or text file. Answers come only from that document, with passages quoted. Retrieval is semantic and runs locally. |
| **Draw your own map** | Sketch what connects to what, compare against the canonical structure, see exactly where your model is wrong. |

Three seeded courses: Generative AI Foundations, Cybersecurity Essentials, Building AI Agents — 6 modules, 10 topics, 28 concepts, 29 prerequisite edges.

---

## Prerequisites

| Need | Version | Where |
|---|---|---|
| Node.js | 20+ | [nodejs.org](https://nodejs.org/) — LTS installer |
| npm | 10+ | ships with Node |
| An LLM API key | — | [console.groq.com](https://console.groq.com) — free, GitHub sign-in, no card |

**Windows:** use PowerShell or Windows Terminal, not `cmd.exe`. On WSL, follow the Linux path instead.

**macOS:** `brew install node` if you use Homebrew.

**Linux:** `sudo apt install nodejs npm`, or [nvm](https://github.com/nvm-sh/nvm) for version control.

---

## Install

### 1. Unzip

**Windows (PowerShell)**
```powershell
Expand-Archive -Path adaptive-learning-platform.zip -DestinationPath adaptive
cd adaptive
```

**macOS / Linux**
```bash
unzip adaptive-learning-platform.zip -d adaptive
cd adaptive
```

### 2. Dependencies

```bash
npm install --legacy-peer-deps
```

The flag is required — some packages have conflicting peer ranges. It is safe.

If that fails on Windows:
```powershell
npm config set legacy-peer-deps true
npm install
```

### 3. Database

```bash
npx prisma migrate deploy
npx prisma generate
npm run db:seed
```

Expected from the seed:
```
seeded generative-ai: 2 modules, 11 concepts, 11 relationships
seeded cybersecurity-essentials: 2 modules, 9 concepts, 9 relationships
seeded ai-agents: 2 modules, 8 concepts, 9 relationships
```

---

## Configure

### 1. Create `.env`

**macOS / Linux**
```bash
cp .env.example .env
```

**Windows**
```powershell
Copy-Item .env.example .env
```

### 2. Add an LLM key

Get a free Groq key at [console.groq.com](https://console.groq.com), then set:

```env
LLM_PROVIDER="groq"
LLM_MODEL="openai/gpt-oss-20b"
GROQ_API_KEY="gsk_your_key_here"
```

Groq is the default because the free tier is generous (~30 req/min, 1000/day), inference is fast, and it supports **strict JSON schema** — the model is constrained during decoding so it cannot emit malformed JSON.

<details>
<summary>Using a different provider</summary>

Change two environment variables. No code edits.

| Provider | `LLM_PROVIDER` | `LLM_MODEL` | Key variable |
|---|---|---|---|
| Groq | `groq` | `openai/gpt-oss-20b` | `GROQ_API_KEY` |
| Google Gemini | `gemini` | `gemini-2.5-flash` | `GEMINI_API_KEY` |
| OpenRouter | `openrouter` | `meta-llama/llama-3.3-70b-instruct:free` | `OPENROUTER_API_KEY` |
| Cerebras | `cerebras` | `qwen-3.8-27b` | `CEREBRAS_API_KEY` |
| Ollama (local) | `ollama` | `qwen2.5:7b` | none needed |

Ollama runs entirely on your machine — unlimited, no key, no data leaves the host. Needs ~8GB RAM for a 7B model.

</details>

### 3. Generate a JWT secret

**macOS / Linux / Git Bash**
```bash
openssl rand -base64 32
```

**Windows PowerShell**
```powershell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }) -as [byte[]])
```

Paste the result into `.env`:
```env
JWT_SECRET="your-generated-secret"
```

### Finished `.env`

```env
DATABASE_URL="file:./dev.db"
LLM_PROVIDER="groq"
LLM_MODEL="openai/gpt-oss-20b"
GROQ_API_KEY="gsk_..."
JWT_SECRET="..."
```

> Never commit `.env`. It is gitignored.

---

## Run

```bash
npm run dev
```

Open **http://localhost:3000**. Stop with `Ctrl+C`.

---

## The five-minute demo

Skip manual data entry. Seed a learner with realistic history:

```bash
npm run db:demo
```

Sign in as:

```
demo@adaptive.local
demo-password-1234
```

This account is deliberately shaped so every page has something to show:

| Concept | Mastery | Status |
|---|---|---|
| Tokenization | 92 | Mastered |
| Embeddings | 85 | Mastered |
| Context Window | 71 | Practising |
| Temperature and Sampling | 55 | Learning |
| Attention | 38 | Needs review |

Plus one recorded misconception about attention, two learning sessions, an uploaded document that happens to **contradict** that misconception, and a saved concept map with both a missing edge and an invented one.

Now follow [`docs/DEMO.md`](./docs/DEMO.md) — eight stops, ~5 minutes. The video shows the same path.

To start over at any point:

```bash
npm run db:reset-demo
```

---

## Using it properly

### Create an account

`/register` — any email, password 8+ characters.

### Take the diagnostic

Open a course. A banner offers a short diagnostic spanning the prerequisite depth range. Take it — without it the adaptive engine has no data and every recommendation looks the same. Skippable if you would rather start at the beginning.

### Explore

`/explore` — filter by category and difficulty. Click through to a course.

### Study the concept map

From a course, **View concept map**. Animated edges are hard prerequisites; dashed are lateral links. Click any node for its definition, objectives, and connections. Clicking a prerequisite in the side panel pans the canvas to it.

### Learn a topic

Click a topic name. The page gives you the module intro, an embedded concept map, the AI explanation for the selected concept, and a tutor chat that knows which concept you are on. Clicking a concept in the map swaps the explanation below.

### Test yourself

**Test yourself** on any learn page generates a quiz. MCQs grade instantly; short answers go to the model, which judges understanding rather than wording — and records any specific misconception it detects.

### Check your progress

`/progress` shows a resume card, what to do next with a reason for each item, anything worth revisiting, per-course completion, and per-concept mastery bars.

A recommendation tells you *why*:

> *"Attention is at 38, and Temperature and Sampling depends on it. Worth fixing before moving on."*

### Work through a misconception

Under **Worth revisiting**, click **Work through it**. The tutor asks a question designed to make the contradiction visible rather than stating the correction. Answering a later assessment well on that concept resolves it automatically.

### Upload your own material

`/materials` — drop a PDF, TXT, or MD file up to 10 MB. Open it and ask questions. Suggested questions are generated from the document itself.

Answers come **only** from your document. Ask something it does not cover and it says so rather than guessing. Supporting passages are quoted, and you can expand the retrieved passages to audit what the search actually found.

First question in a session takes ~2s longer — the embedding model loads once per process.

### Draw your own map

**Draw your own map** from a course. Pick concepts from the palette, or type your own. Drag from a node's right edge to another's left to mark a prerequisite. Save, then **Compare**.

Hide the palette first if you want to test unaided recall.

The comparison is deterministic — it names every concept you missed, every connection you missed, and every connection you invented. Only the narrative wording is AI-generated.

---

## Admin

```bash
npx tsx scripts/make-admin.ts your@email.com
```

Sign out and back in — the role is carried in the session token.

`/admin` has three tabs: **Learners** (who is stuck, flagged when they have several concepts needing review or open misconceptions), **Sources** (citation management with an enforced approval workflow), and **Content** (course and concept coverage).

Six platform stats, including *untouched concepts* — concepts no learner has ever attempted, which usually means they are unreachable in the graph or nobody wants them.

---

## Commands

| Command | Does |
|---|---|
| `npm run dev` | Development server on :3000 |
| `npm run build` | Production build |
| `npm run start` | Production server |
| `npm test -- --fileParallelism=false` | 816 tests across 91 files |
| `npm run typecheck` | TypeScript, no emit |
| `npm run lint` | ESLint |
| `npm run db:seed` | 3 courses, 28 concepts |
| `npm run db:demo` | Demo learner with history |
| `npm run db:reset-demo` | Wipe learner data, reseed demo |
| `npm run db:embed` | Backfill embeddings for existing material |

> Tests need `--fileParallelism=false`. Parallel workers contend for the SQLite file.

---

## How it works

Single Next.js 16 App Router application. Route Handlers under `app/api/` replace a separate backend. Prisma and SQLite for persistence.

```
app/                    Routes, pages, API handlers
  api/                  REST endpoints
  explore/              Course catalog
  courses/[slug]/       Detail, concept map, student map
  learn/[slug]/         AI tutor
  assessment/[id]/      Quiz runner
  materials/            Upload and grounded Q&A
  progress/             Mastery dashboard
  admin/                Learner overview, sources
components/             React components (ui/ is shadcn)
lib/
  ai/                   Provider registry, client, prompts, services
  auth/                 Password hashing, JWT, guards
  repositories/         All database access
  schemas/              Zod contracts — source of truth for types
  text/                 Extraction, chunking, embeddings, retrieval
prisma/                 Schema, migrations, seed data
scripts/                CLI utilities
tests/                  816 tests mirroring source layout
```

### Design decisions worth knowing

**The model never decides correctness.** Mastery scoring, recommendation ranking, and concept-map comparison are pure, deterministic, unit-tested functions. The AI writes prose and grades short answers. It does not decide what you should study next or whether your map is right.

**Every AI response is schema-validated.** `lib/ai/client.ts` is the single choke point. Nothing downstream sees unvalidated model output. On Groq, strict JSON schema makes malformed output structurally impossible; elsewhere Zod catches it.

**Retrieval is local and hybrid.** Cosine similarity over `all-MiniLM-L6-v2` embeddings running in-process, fused with keyword TF-IDF. No embedding API, no rate limit, no data leaving the machine. The model is always consulted — a retrieval miss falls back to the document's opening sections rather than refusing, because deciding whether a document answers a question is a judgement, not a similarity threshold.

**Graceful degradation.** Map feedback and the coach summary fall back to deterministic text when the model is unavailable, because the underlying computation is still valid. Explanations do not fall back — a fabricated explanation is worse than an error.

### Stack

Next.js 16.3.6 · React 19 · TypeScript 5 · Tailwind v4 · shadcn/ui (base-nova, Base UI primitives) · Prisma 7 · SQLite · Zod 4 · TanStack Query · React Flow · `@huggingface/transformers` · OpenAI SDK · jose · bcryptjs · Vitest

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `AI_NOT_CONFIGURED` | No key for the selected provider. Check `LLM_PROVIDER` matches the key you set. |
| `AI_UNAVAILABLE` | Rate limited or provider down. Switch `LLM_PROVIDER` to `gemini` or `ollama`. |
| First material question is slow | Embedding model loading, ~2s, once per process. |
| Progress page is empty | Run `npm run db:demo`, or take a diagnostic. |
| `npm install` peer conflicts | `npm install --legacy-peer-deps` |
| `Cannot find module '@/app/generated/prisma/client'` | `npx prisma generate` |
| `SQLITE_BUSY` during tests | `npm test -- --fileParallelism=false` |
| Port 3000 in use | `npm run dev -- -p 3001` |
| `openssl` not found on Windows | Use Git Bash, or the PowerShell snippet above. |
| Admin link missing after promotion | Sign out and back in — the role lives in the JWT. |

### Full reset

```bash
rm dev.db
npx prisma migrate deploy
npm run db:seed
npm run db:demo
```

Deletes all accounts and progress, rebuilds the three courses and the demo learner.

---

## Documentation

| File | Contents |
|---|---|
| [`docs/DEMO.md`](./docs/DEMO.md) | Eight-stop walkthrough with presenter notes |
| [`docs/media/adaptive-demo-walkthrough.mp4`](./docs/media/adaptive-demo-walkthrough.mp4) | Screen capture of the same path |
| [`README.md`](./README.md) | Shorter project overview |
| [`PROGRESS.md`](./PROGRESS.md) | Build history and handoff notes |
| [`docs/superpowers/plans/`](./docs/superpowers/plans/) | The implementation plans this was built from |
