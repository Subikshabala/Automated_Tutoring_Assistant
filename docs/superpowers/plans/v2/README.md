# v2 — Make It Actually Work

> **For agentic workers:** Each file is a self-contained chunk, ~150–250 lines. Execute in order within a part. Parts A–B are blocking; C–G can interleave once A is done.

**Why this exists:** v1 shipped all nine phases and 556 tests pass, but the running app is broken in ways tests cannot catch — a dead model id, a crashing menu primitive, retrieval that returns nothing for ordinary questions, and four database tables nothing writes to.

This plan closes the gap between "the test suite is green" and "a person can sit down and use it."

---

## Current state

| | |
|---|---|
| Tests | 556 passing, 69 files |
| Build | Succeeds |
| **App at runtime** | **Crashes on load** (`MenuGroupContext`) |
| **Every AI feature** | **Dead** (`gemini-2.0-flash` shut down) |
| **Material Q&A** | **Returns "not covered" for most questions** |

### The three courses

| Course | Modules | Topics | Concepts | Edges |
|---|---|---|---|---|
| Generative AI Foundations | 2 | 4 | 11 | 11 |
| Cybersecurity Essentials | 2 | 3 | 9 | 9 |
| Building AI Agents | 2 | 3 | 8 | 9 |
| **Total** | **6** | **10** | **28** | **29** |

### Dead schema

Four tables exist and are never written to. Verified by grepping every call site.

| Table | Intended | Fixed in |
|---|---|---|
| `LearningSession` | Time on topic | G2 |
| `LearningProgress` | Per-concept viewed/completed | G2 |
| `Misconception` | What a learner got wrong | G3 |
| `Source` | Citations with authority tiers | G4 |

---

## Parts

### A — Unblock
The app does not run. Nothing else matters until these three land.

| File | Fixes |
|---|---|
| [`A1-ai-provider-swap.md`](./A1-ai-provider-swap.md) | `gemini-2.0-flash` is shut down. Swap to an OpenAI-compatible client, default Groq, provider chosen by env var. |
| [`A2-fix-menu-crash.md`](./A2-fix-menu-crash.md) | `DropdownMenuLabel` outside a `Menu.Group` throws and takes the whole app down. |
| [`A3-fix-concept-map-route.md`](./A3-fix-concept-map-route.md) | Sidebar links to `/concept-map`, which was never built. 404. |

### B — RAG
Retrieval is pure keyword TF-IDF. `"what is this"` tokenises to `[]` and short-circuits before the model is ever called.

| File | Builds |
|---|---|
| [`B1-local-embeddings.md`](./B1-local-embeddings.md) | `@xenova/transformers` in-process. No API, no key, no rate limit. |
| [`B2-hybrid-retrieval.md`](./B2-hybrid-retrieval.md) | Cosine similarity fused with keyword score. Document-level fallback. |
| [`B3-material-qa-ux.md`](./B3-material-qa-ux.md) | Suggested questions, per-passage citation, honest empty state. |

### C — Concept map
Nodes are cramped, edges cross, labels are unstyled white pills.

| File | Fixes |
|---|---|
| [`C1-layout-spacing.md`](./C1-layout-spacing.md) | Column width vs node width, barycentre ordering to uncross edges. |
| [`C2-edge-styling.md`](./C2-edge-styling.md) | Custom edge component, themed labels, colour per relationship type. |
| [`C3-panel-navigation.md`](./C3-panel-navigation.md) | Prerequisite/unlock badges become buttons that select and scroll. |

### D — Student map
`Add` appears to do nothing. The canvas starts empty with no hint of what to add.

| File | Fixes |
|---|---|
| [`D1-fix-add-node.md`](./D1-fix-add-node.md) | New nodes land in the viewport, not offscreen at origin. |
| [`D2-concept-palette.md`](./D2-concept-palette.md) | A palette of the course's real concepts to click or drag in. |

### E — Content
Recommendation copy reads like a mail merge. Curriculum dumps everything expanded.

| File | Fixes |
|---|---|
| [`E1-recommendation-copy.md`](./E1-recommendation-copy.md) | Varied, specific reasons that name what is actually blocking. |
| [`E2-curriculum-accordion.md`](./E2-curriculum-accordion.md) | First module open, rest collapsed. |

### F — Visual
| File | Fixes |
|---|---|
| [`F1-landing-progress-line.md`](./F1-landing-progress-line.md) | Connected 1→4 line with scroll-triggered fill. |
| [`F2-sidebar-rail-seam.md`](./F2-sidebar-rail-seam.md) | The real seam culprit: `SidebarRail`'s `after:w-[2px]`. |

### G — End-to-end
What turns this from a feature list into a demo.

| File | Builds |
|---|---|
| [`G1-diagnostic-assessment.md`](./G1-diagnostic-assessment.md) | Cold-start quiz. Without it the adaptive engine has no data and every recommendation is identical. |
| [`G2-session-tracking.md`](./G2-session-tracking.md) | Wire up `LearningSession` + `LearningProgress`. |
| [`G3-misconceptions.md`](./G3-misconceptions.md) | Capture from grading, surface on Progress, feed Socratic repair. |
| [`G4-admin-real.md`](./G4-admin-real.md) | Source management, learner overview. Make `/admin` worth visiting. |
| [`G5-demo-walkthrough.md`](./G5-demo-walkthrough.md) | Seeded demo account with realistic history, plus a scripted click-path. |

---

## Dependency order

```
A1 ──┬── B1 ── B2 ── B3
     │
     ├── C1 ── C2 ── C3
     │
     ├── D1 ── D2
     │
     ├── E1   E2
     │
     ├── F1   F2
     │
     └── G1 ── G2 ── G3 ── G4 ── G5
A2, A3 independent — do them first, they are small
```

A1 blocks everything that calls the model. A2 blocks everything, full stop.

---

## Conventions

Unchanged from v1. Restated because they are easy to violate.

- `gap-*` on flex/grid, never `space-y-*`
- `size-*` for equal dimensions
- Semantic tokens only — `text-muted-foreground`, `bg-card`, `border-border`
- `data-icon` on every Lucide icon inside a shadcn component
- `<Button render={<Link/>}>` **must** also set `nativeButton={false}`
- Dynamic route `params` is a Promise — `await params`
- `cookies()` is a Promise — `await cookies()`
- Tests run with `npm test -- --fileParallelism=false` (SQLite locks otherwise)
- Lint scoped: `npx eslint app/ lib/ components/ hooks/ tests/`

## Verification gate

Every chunk ends with all four green:

```bash
npm run typecheck
npx eslint app/ lib/ components/ hooks/ tests/
npm test -- --fileParallelism=false
npm run build
```

Test count must not drop below 556.
