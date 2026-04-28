# AI 中文寫作導師 — Codebase Reference

## What was built

Phase 0 + Phase 1 of the implementation plan, adapted to run as a Vercel-native Next.js full-stack app (no Python/FastAPI/Celery required). The core loop is:

1. Student pastes a Chinese essay → `POST /api/submissions`
2. Server calls LLM (via OpenRouter or Anthropic direct) with a rubric-anchored, tutor-voice prompt
3. LLM returns structured JSON: rubric scores, evidence-span errors, coach feedback, strengths, revision priorities
4. Results stored in Postgres; weakness profiles updated with EWMA aggregation
5. Student sees annotated essay view with clickable error chips and longitudinal weakness report

---

## File structure

```
src/
  middleware.ts             — sets ccoach_uid cookie on first visit (edge, no DB call)
  lib/
    db.ts                   — Prisma singleton
    anthropic.ts            — OpenRouter (primary) / Anthropic SDK (fallback) adapter
    analysis.ts             — LLM prompt build, response parse, validation
    rubric.ts               — Rubric definitions: criteria, score bands, descriptors
    taxonomy.ts             — Error taxonomy: 字詞/語法/標點/結構/內容/表達
    weakness.ts             — EWMA aggregator, status state machine
    auth.ts                 — Cookie-based anonymous user (read cookie, upsert User row)
  app/
    layout.tsx              — HTML shell, Header, global Tailwind CSS
    page.tsx                — Dashboard: coach greeting, focus areas, recent submissions
    submissions/
      new/page.tsx          — Essay intake form (client-side grade + prompt + textarea)
      [id]/page.tsx         — Annotated feedback: rubric scores, coach card, error chips
    weaknesses/page.tsx     — Longitudinal weakness report grouped by status
    api/
      submissions/route.ts       — POST: create → analyse → aggregate. GET: list for user.
      submissions/[id]/route.ts  — GET: single submission with errors
      weaknesses/route.ts        — GET: all weakness profiles for current user
  components/
    Header.tsx              — Top nav with links to all main pages
    CoachCard.tsx           — Bordered card used throughout for feedback blocks
    AnnotatedText.tsx       — Client component: renders essay with inline <mark> highlights
    SubmissionForm.tsx      — Client component: grade selector + topic input + textarea + submit
prisma/
  schema.prisma             — All DB models (see section below)
  seed.ts                   — Seeds default rubric + 3 sample writing tasks
```

---

## Database models (prisma/schema.prisma)

| Model | Purpose |
|---|---|
| `User` | One row per browser cookie. Has gradeLevel, displayName. |
| `Submission` | Raw text, verified text, status enum (uploaded/verified/analyzed/failed), OCR fields for Phase 2. |
| `Analysis` | Rubric scores (JSON), overall score, model name, coach feedback, strengths, revision priorities. |
| `ErrorRecord` | Per-error row: category, subcategory, evidence span, char offsets, suggestion, severity 1–3, `ocrSuspect` flag. |
| `WeaknessProfile` | Per `(user, category, subcategory)`: EWMA severity, evidence count, rolling window (JSON), status enum. |
| `RevisionSession` | Placeholder for Phase 1 stretch goal — revision workspace. |
| `Rubric` | Rubric JSON keyed by gradeLevel + type + genre. Seeded by `prisma/seed.ts`. |
| `WritingTask` | Writing prompts with grade, genre, guidance, suggested length. |
| `FeedbackEvent` | Student reactions to errors ("helpful" / "wrong" / "confusing") — gold for prompt tuning. |

The `ocrSuspect` column on `ErrorRecord` is the key safety rail from the plan: any error whose evidence overlaps low-confidence OCR characters must be set `true`, and the weakness aggregator excludes those rows. Phase 2 wires this up — the column and UI already exist.

---

## LLM layer (src/lib/anthropic.ts)

`generateModelText({ system, user, model, maxTokens, temperature })` routes to:

- **OpenRouter** if `OPENROUTER_API_KEY` is set (default, cheaper). Sends a standard OpenAI-compatible chat request to `https://openrouter.ai/api/v1/chat/completions`.
- **Anthropic SDK** (`@anthropic-ai/sdk`) if only `ANTHROPIC_API_KEY` is set.

Default models (overridable via env vars):
- `ANALYSIS_MODEL` = `google/gemini-2.5-flash` (via OpenRouter)
- `COACH_MODEL` = `anthropic/claude-3.5-haiku` (via OpenRouter)

To switch to Claude Opus 4.7 direct: set `ANTHROPIC_API_KEY` and `ANALYSIS_MODEL=claude-opus-4-7`.

---

## Analysis pipeline (src/lib/analysis.ts)

### Prompt design (from the plan)

- System prompt passes the full rubric descriptors verbatim so model scores are anchored.
- Requires per-error evidence spans (exact quote + char offsets) — no vague feedback.
- Tutor-voice instruction: encouraging, specific, Socratic (ask-before-telling).
- Hard rule: "絕不替學生重寫整篇文章" (never rewrite the essay).
- Outputs strict JSON with schema defined in the user prompt.

### Validation

1. Parse JSON from model output (strips markdown fences if present).
2. Zod schema validation.
3. Filter errors whose offsets are out of range or whose category/subcategory is not in the taxonomy.
4. Cap `overall_score` to the rubric total max.

---

## Weakness aggregation (src/lib/weakness.ts)

Called after every analysis. Implements the plan's algorithm exactly:

**EWMA**: `severity_ewma = 0.3 × new_severity + 0.7 × old_severity` (only over non-OCR-suspect errors).

**Status transitions:**

| Status | Condition |
|---|---|
| `watching` | Default. New categories start here. |
| `confirmed` | `evidenceCount ≥ 3` AND errors across `≥ 2` distinct submissions on `≥ 2` distinct days. |
| `improving` | Last 2 submissions show ≥ 50% reduction in error count vs. prior 2. |
| `resolved` | Last 3 consecutive submissions show zero errors in the category. |

**Dashboard shows only `confirmed` weaknesses** as focus areas (max 2–3). `watching` is invisible to the student. This is the anti-discouragement guard from the plan.

Excluded from aggregation: `ocrSuspect = true` errors, student-flagged errors (via `FeedbackEvent`), draft submissions.

---

## Auth (src/middleware.ts + src/lib/auth.ts)

**Middleware** (`src/middleware.ts`) runs on every non-static request, generates a `crypto.randomUUID()` and sets it as `ccoach_uid` cookie if missing. This runs at the edge, no DB needed.

**auth.ts** reads that cookie and does a DB `findOrCreate` — the UUID becomes the user's primary key. No email or password required for Phase 1.

To add proper auth later: integrate NextAuth, move the user ID from cookie to JWT session, keep the rest of the app unchanged.

---

## Error taxonomy (src/lib/taxonomy.ts)

Six top-level categories from the plan, each with subcategories:

| Category | Subcategories |
|---|---|
| 字詞 | 錯別字, 形近字, 同音字, 詞語搭配不當 |
| 語法 | 語序, 成分殘缺, 搭配不當, 句式雜糅 |
| 標點 | 逗號誤用, 句號問號混淆, 引號使用 |
| 結構 | 中心不明, 段落銜接, 詳略失當, 開頭結尾 |
| 內容 | 材料單薄, 脫離題意, 立意平淡 |
| 表達 | 修辭貧乏, 用詞單一, 語言乾澀 |

`validCategory(category, subcategory)` is called after parsing the model output to silently drop any category the model hallucinated outside the taxonomy.

---

## Rubric (src/lib/rubric.ts)

One starter rubric: `DEFAULT_WRITING_RUBRIC` — generic 記敘文, 100 points total:

| Criterion | Max |
|---|---|
| 內容 | 25 |
| 結構 | 20 |
| 語言 | 25 |
| 字詞與標點 | 15 |
| 表達與立意 | 15 |

Each criterion has four score bands (優/良/中/下) with Chinese descriptors passed verbatim into the system prompt. Add grade-specific rubrics in `rubric.ts` and upsert them via `prisma/seed.ts`.

---

## UI pages

### Dashboard (`/`)
- Server component; reads cookie, fetches last 5 submissions + up to 3 confirmed weaknesses + up to 3 improving weaknesses.
- Coach greeting adapts to submission count (first time, returning, veteran).
- Shows only `confirmed` weaknesses as "本週的練習重點".
- Shows `improving` weaknesses as encouragement.

### New Submission (`/submissions/new`)
- Client form: grade selector (P5–S6), optional topic field, large textarea with live char count.
- On submit: `POST /api/submissions`, waits, redirects to detail page.
- Button is disabled below 20 chars; shows "導師正在閱讀…" during analysis.

### Submission Detail (`/submissions/[id]`)
- Shows overall score, coach feedback card, strengths, revision priorities.
- Score breakdown table with per-criterion marks.
- `AnnotatedText` component: essay with `<mark>` highlights coloured by severity (1=yellow, 2=orange, 3=red). Click a mark → shows category + suggestion in a callout below.
- Error list grouped by category at the bottom.

### Weakness Report (`/weaknesses`)
- All profiles ordered: confirmed → watching → improving → resolved.
- Shows evidence count, EWMA severity, first/last seen dates.
- Only surfaces categories with real submission evidence.

---

## Environment variables

| Var | Required | Default | Notes |
|---|---|---|---|
| `DATABASE_URL` | Yes | — | Postgres connection string |
| `OPENROUTER_API_KEY` | Recommended | — | Primary LLM route. Get from openrouter.ai |
| `ANTHROPIC_API_KEY` | Fallback | — | Used if OpenRouter key not set |
| `ANALYSIS_MODEL` | No | `google/gemini-2.5-flash` | Main analysis model |
| `COACH_MODEL` | No | `anthropic/claude-3.5-haiku` | Lighter coaching calls |
| `OPENROUTER_HTTP_REFERER` | No | — | Optional OpenRouter attribution |
| `OPENROUTER_APP_NAME` | No | — | Optional OpenRouter attribution |

---

## What's not built yet (from the plan)

| Phase | Feature | Schema ready? |
|---|---|---|
| 2 | OCR / handwriting: photo upload, Baidu OCR, verification UI | Yes — `Submission.imageUrl`, `ocrCharConfidences`, `ErrorRecord.ocrSuspect` |
| 1 stretch | Revision workspace: side-by-side editor, targeted error checklist | Yes — `RevisionSession` model |
| 4 | Reading practice: passage + comprehension questions | No |
| — | Real auth (email/password, SSO) | Ready to swap in NextAuth |
| — | Parent/teacher views, assignment mode | No |
| — | `FeedbackEvent` UI (was wrong / helpful buttons) | Model exists, no UI |
