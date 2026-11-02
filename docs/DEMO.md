# Demo Walkthrough

Five minutes, eight stops. Assumes `npm run db:seed && npm run db:demo`
and a dev server on :3000.

Sign in as `demo@adaptive.local` / `demo-password-1234`.

---

## 1. Landing — 20s

Scroll to **How it works**. The connector fills as it enters view.

> The claim is specific: it finds where your understanding stops, then
> teaches from there. Everything after this is that claim being tested.

## 2. Progress — 60s

The centrepiece. Point at **What to do next**.

> Four recommendations, four different reasons. Attention is top because
> it is blocking two downstream concepts, not because it is next in a list.

Then **Worth revisiting**.

> This is not "you got question three wrong." The system identified a
> specific belief — that attention only compares adjacent tokens — from
> how the answer was phrased.

Click **Work through it**. Note the response asks rather than tells.

## 3. Concept map — 45s

`/courses/generative-ai/map`.

> Every course is a prerequisite graph. Animated edges are hard
> dependencies. You are never sent somewhere you are not ready for.

Click **Attention**. The panel fills. Click **Embeddings** under
Prerequisites — the canvas pans.

## 4. Learn — 60s

Click a topic. Explanations are generated and cached.

> Explanation, worked example, and a check question. The map is embedded
> so structure stays visible while you read.

Ask the tutor something. Answer arrives in a few seconds.

## 5. Assessment — 60s

**Test yourself**. Answer one short question *specifically wrong* —
for example "each word becomes one token."

> MCQs are graded deterministically. Short answers go to the model, which
> grades understanding rather than keyword overlap — and records the
> misconception it spots.

Submit. The new misconception appears on Progress.

## 6. Materials — 45s

`/materials` — the seeded transformer notes.

Ask: **what is this**

> Worth noting: keyword search returns nothing for that question. This is
> semantic retrieval running locally, no API.

Then: **does attention only look at the previous token?**

> The answer corrects the misconception from step 2, grounded in their
> own uploaded document with the passage quoted.

Then ask something off-topic. It declines.

## 7. Student map — 45s

`/courses/generative-ai/my-map` — the saved attempt loads.

Click **Compare**.

> It caught the missing Tokenization → Embeddings link and the invented
> Tokenization → Attention one. The comparison is deterministic; only the
> wording is generated.

## 8. Admin — 30s

Requires `npx tsx scripts/make-admin.ts demo@adaptive.local` and a re-login.

> Who is stuck, which concepts nobody reaches, and source attribution.

---

## If something fails

| Symptom | Cause |
|---|---|
| `AI_NOT_CONFIGURED` | `GROQ_API_KEY` missing from `.env` |
| `AI_UNAVAILABLE` | Rate limit. Switch `LLM_PROVIDER` to `gemini` or `ollama` |
| Material Q&A slow on first ask | Embedding model loading, ~2s once per process |
| Empty Progress | `npm run db:demo` not run |

## Reset

If the demo data gets poked at and needs a fresh start:

```bash
npm run db:reset-demo
```

This wipes all learner data (keeping courses and concepts) and re-seeds the demo account.
