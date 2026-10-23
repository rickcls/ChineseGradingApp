# AI 中文寫作導師 — Codebase Reference

## What's built

A production Next.js full-stack app for HKDSE Chinese essay grading. The core loop is:

1. Student submits a Chinese essay (typed, photo, or scan) → `POST /api/submissions`
2. Server calls LLM (Claude via Anthropic SDK or OpenRouter) with HKDSE rubric-anchored prompt
3. LLM returns structured JSON: DSE level/scores, evidence-span errors, coach feedback, strengths, revision suggestions, model passage
4. Results stored in Postgres; weakness profiles updated with EWMA aggregation; credits deducted
5. Student sees annotated essay view across 9 tabbed sections, plus a revision workbench and AI-generated model passage

**Tech stack:** Next.js 16, React 19, TypeScript, Prisma 5 (Postgres), Clerk 7 (auth), Anthropic SDK, TailwindCSS 3.

---

## File structure

```
src/
  middleware.ts                      — Clerk auth middleware (route protection + legacy cookie migration)
  lib/
    db.ts                            — Prisma singleton
    anthropic.ts                     — Dual-path LLM adapter: Anthropic SDK or OpenRouter with fallback + timeout
    analysis.ts                      — LLM prompt build, response parse, Zod validation, offset realignment
    scoring.ts                       — Deterministic score caps from the rubric md (word count, structure band, content-led, short-board, evidence-backed typo count)
    rubric.ts                        — HKDSE 4-criterion rubric + DSE level/score mappings + typo deduction
    rubricGuide.ts                   — Loads dse-chinese-writing-rubric.md (the source of truth) into the prompt
    taxonomy.ts                      — Error taxonomy: 字詞/語法/標點/結構/內容/表達 × subcategories
    weakness.ts                      — EWMA aggregator, status state machine
    auth.ts                          — Clerk user lookup + role sync + legacy cookie migration
    credits.ts                       — Credit ledger: deduct, refund, unlimited flags, audit trail
    ocr.ts                           — Vision model invocation for photo/scan input modes (verbatim transcription, no auto-correct)
    ocrSuspect.ts                    — Flags errors that may be OCR misreads (□ placeholders, typos in untouched OCR text)
    notebook.ts                      — Learning note serialization (manual/phrase/lesson types)
    modelPassage.ts                  — AI-generated model essay management
    revisionSuggestions.ts           — Workbench suggestion prioritization (top 5 + top 2 errors)
    revisionPriority.ts              — Revision priority normalization + deduplication
  app/
    layout.tsx                       — HTML shell, Header, global Tailwind CSS
    page.tsx                         — Root redirect
    student/dashboard/page.tsx       — Student dashboard: submissions list, weakness summary
    teacher/dashboard/page.tsx       — Teacher dashboard: class overview, recent submissions
    admin/dashboard/page.tsx         — Admin portal: user directory, credit management, class creation
    submissions/
      new/page.tsx                   — Essay intake form: grade, topic, typed/photo/scan input
      [id]/page.tsx                  — 9-tab detail view (see UI pages below)
    api/
      submissions/route.ts           — POST: create → analyse → aggregate → deduct credit (SSE streaming)
      submissions/[id]/route.ts      — GET / DELETE single submission
      submissions/[id]/revision/route.ts      — POST: save revision session
      submissions/[id]/model-passage/route.ts — POST: generate/update model essay
      submissions/[id]/notebook-note/route.ts — POST: create learning note from submission
      notebook/route.ts              — POST: standalone notebook entry
      notebook/[entryId]/route.ts    — GET: fetch notebook entry
      ocr/route.ts                   — POST: OCR image → text
      weaknesses/route.ts            — POST: get weakness profiles for current user
      webhooks/clerk/route.ts        — Clerk user sync webhook
  components/
    Header.tsx                       — Top nav
    CoachCard.tsx                    — Feedback container with tone variants
    AnnotatedText.tsx                — Client: essay with inline <mark> highlights + detail panel
    SubmissionForm.tsx               — Client: multi-mode input with SSE progress streaming
    RevisionComposer.tsx             — Side-by-side revision editor with AI suggestions
    ModelPassagePanel.tsx            — AI model essay viewer
    NotebookWorkspace.tsx / NotebookQuickPanel.tsx — Note-taking UI
    admin/
      UserDirectory.tsx              — User list with role/credit columns
      RoleUpdateForm.tsx             — Change user role
      CreditAdjustmentForm.tsx       — Grant/deduct credits
      UnlimitedCreditsForm.tsx       — Toggle unlimited credits per user
      SyncClerkUsersButton.tsx       — Force-sync Clerk users to DB
prisma/
  schema.prisma                      — All DB models
  migrations/                        — Postgres migration history
```

---

## Database models (prisma/schema.prisma)

| Model | Purpose |
|---|---|
| `AppUser` | One row per Clerk user. Has `role` (student/teacher/admin), `credits`, `unlimitedCredits`, `gradeLevel`, `displayName`. |
| `Submission` | `rawText` (untouched OCR transcript for photo/scan, else same as typed text), `verifiedText` (what was graded), source mode (typed/photo/scan), `taskPrompt` (題目), `genre` (文體, null = model decides), status enum (uploaded/verified/analyzed/failed), OCR fields. |
| `Analysis` | HKDSE rubric scores (JSON), DSE level, overall score, model name, coach feedback, strengths, revision priorities. |
| `ErrorRecord` | Per-error row: category, subcategory, evidence span, char offsets, suggestion, severity 1–3, `ocrSuspect` flag. |
| `WeaknessProfile` | Per `(user, category, subcategory)`: EWMA severity, evidence count, 10-submission rolling window (JSON), status enum. |
| `RevisionSession` | Revision workspace: revised text, target error IDs, improvement delta. |
| `NotebookEntry` | Student learning notes: type (manual/phrase/lesson), content, linked submission. |
| `AiModelPassage` | AI-generated model essay with highlights, linked to a submission. |
| `CreditTransaction` | Audit trail for all credit changes (deduction, refund, admin grant) with attribution. |
| `Class` / `StudentClass` | Teacher class management + student enrolment. |
| `WritingTask` | Writing prompts with grade, genre, guidance, suggested length. |
| `FeedbackEvent` | Student reactions to specific errors (helpful/wrong/confusing) — for prompt tuning. |

The `ocrSuspect` column on `ErrorRecord` is the OCR safety rail, set in `persistAnalysis` via `buildOcrSuspectChecker` (`src/lib/ocrSuspect.ts`). Vision-model OCR gives no per-character confidence, so an error is suspect when its span overlaps an unresolved `□`, or when it is a 錯別字/形近字/同音字 error on characters the student left exactly as the OCR produced them (characters the student retyped during verification are trusted). Suspect errors are labelled "OCR 可能讀錯" in the UI and excluded from weakness aggregation.

---

## LLM layer (src/lib/anthropic.ts)

`generateModelText({ system, user, model, maxTokens, temperature })` routes to:

- **Anthropic SDK** if `ANTHROPIC_API_KEY` is set and no OpenRouter key is present.
- **OpenRouter** if `OPENROUTER_API_KEY` is set (OpenAI-compatible API at `https://openrouter.ai/api/v1/chat/completions`).

Both paths support a fallback model (`ANALYSIS_FALLBACK_MODEL`) retried on failure. System messages use `ephemeral` cache control for prompt caching.

Default models (overridable via env vars):

| Var | Default | Use |
|---|---|---|
| `ANALYSIS_MODEL` | `google/gemini-2.5-flash` | Main essay analysis |
| `ANALYSIS_FALLBACK_MODEL` | — | Retry on failure |
| `COACH_MODEL` | `anthropic/claude-3.5-haiku` | Lighter coaching calls |
| `OCR_MODEL` | — | Vision OCR (photo/scan mode) |
| `OCR_FALLBACK_MODEL` | — | OCR retry |

---

## Analysis pipeline (src/lib/analysis.ts)

### Rubric (HKDSE-aligned)

4-criterion rubric, 100 points total:

| Criterion | Max |
|---|---|
| 內容 (Content) | 40 |
| 表達 (Expression) | 30 |
| 結構 (Structure) | 20 |
| 標點 (Punctuation) | 10 |

`dse-chinese-writing-rubric.md` is the single source of truth; `rubric.ts`, `scoring.ts`, the prompt text in `analysis.ts` and the fallback in `rubricGuide.ts` must match it. Prompt version: `v11-2026-10-md-aligned`.

DSE levels from the final score (after typo deduction), following the md's N matrix (score ≈ N × 10):

| Level | 5** | 5* | 5 | 4 | 3 | 2 | 1 | U |
|---|---|---|---|---|---|---|---|---|
| Min score | 95 | 90 | 70 | 60 | 50 | 30 | 20 | 0 |

### Prompt design

- System prompt passes full HKDSE rubric descriptors with per-level anchor tables and conservative bias (requires 3-condition verification for Level 5+).
- Requires per-error evidence spans (exact quote + char offsets) — no vague feedback.
- Tutor-voice instruction: encouraging, specific, Socratic.
- Hard rule: "絕不替學生重寫整篇文章" (never rewrite the essay).
- Generates 3–8 structured revision suggestions per submission, each with: focus area, issue, reasoning, how-to steps, before/after examples.
- Typo deduction (whole essay): 0–2 → 0, 3–4 → −1, 5–7 → −2, 8+ → −3. It lowers the final score, so it can lower the level.
- Every typo must be listed in `errors`; the deduction uses the count of validated typo errors, not the model's `typo_count`.
- Genre (文體) and topic (題目) are passed when given; the model applies the md's genre-specific focus (§1.2) and 審題 rules (§3.1).
- The essay is wrapped in `<student_essay>` tags; instructions inside it are ignored (prompt-injection guard).
- `coach_feedback` must not state a numeric level; the UI shows the code-derived level so the two can never disagree.

### Validation

1. Parse JSON from model output (strips markdown fences if present).
2. Zod schema validation.
3. Offset realignment — model UTF-16 predictions are matched against actual source text using a distance heuristic to handle OCR drift.
4. Filter errors whose offsets are out of range or whose category/subcategory is not in the taxonomy.
5. Score bounds enforcement, then the deterministic caps in `scoring.ts`:
   - word count (counted in code) under 400 → content ≤ N4;
   - structure ≤ content N + 1;
   - content N ≤ 2 → expression and structure ≤ N4;
   - short-board level cap (any N ≤ 6 → Level 4 max, N ≤ 4 → Level 3 max);
   - final level = lower of the model's holistic level and the score-derived level.

---

## Weakness aggregation (src/lib/weakness.ts)

Called after every analysis.

**EWMA**: `severity_ewma = 0.3 × new_severity + 0.7 × old_severity` (non-OCR-suspect errors only, 10-submission rolling window).

**Status transitions:**

| Status | Condition |
|---|---|
| `watching` | Default. New categories start here. Invisible to students. |
| `confirmed` | `evidenceCount ≥ 3` AND errors across `≥ 2` distinct submissions on `≥ 2` distinct days. |
| `improving` | Last 2 submissions show ≥ 50% reduction in error count vs. prior 2. |
| `resolved` | Last 3 consecutive submissions show zero errors in the category. |

Excluded from aggregation: `ocrSuspect = true` errors. (Excluding student-flagged errors via `FeedbackEvent` is planned; there is no UI for it yet.)

---

## Credit system (src/lib/credits.ts)

- Each submission costs 1 credit (students and admins).
- Credits are deducted before analysis begins; automatically refunded on failure.
- `GLOBAL_UNLIMITED_CREDITS=true` env var bypasses all credit checks (for UAT/dev).
- Per-user `unlimitedCredits` flag bypasses checks for that user only.
- All changes are recorded in `CreditTransaction` with admin attribution.
- New users receive 3 free credits on signup (set during Clerk webhook sync).

---

## Auth (src/middleware.ts + src/lib/auth.ts)

**Middleware** uses Clerk to protect routes. Public routes: sign-in, sign-up, webhooks.

**auth.ts**:
- `getCurrentUser()` — reads Clerk session, upserts `AppUser` row, syncs role to Clerk public metadata.
- `bootstrapAdminByClerkId()` — promotes Clerk user IDs listed in `ADMIN_CLERK_USER_IDS` env var to admin on first login.
- Legacy migration: if a `ccoach_uid` cookie exists from the old anonymous system, the Clerk user inherits that user's submissions.

---

## Error taxonomy (src/lib/taxonomy.ts)

Six top-level categories, each with subcategories:

| Category | Subcategories |
|---|---|
| 字詞 | 錯別字, 形近字, 同音字, 詞語搭配不當 |
| 語法 | 語序, 成分殘缺, 搭配不當, 句式雜糅 |
| 標點 | 逗號誤用, 句號問號混淆, 引號使用 |
| 結構 | 中心不明, 段落銜接, 詳略失當, 開頭結尾 |
| 內容 | 材料單薄, 脫離題意, 立意平淡 |
| 表達 | 修辭貧乏, 用詞單一, 語言乾澀 |

`validCategory(category, subcategory)` silently drops any model-hallucinated category outside the taxonomy.

---

## UI pages

### Student Dashboard (`/student/dashboard`)
- Lists recent submissions + weakness summary (confirmed weaknesses as focus areas, improving as encouragement).
- Coach greeting adapts to submission count (first time / returning / veteran).

### Teacher Dashboard (`/teacher/dashboard`)
- Class list, recent submissions across all students in teacher's classes.

### Admin Dashboard (`/admin/dashboard`)
- User directory with role/credit columns, credit adjustment, unlimited credit toggle, Clerk user sync.
- Class creation and student enrolment.

### New Submission (`/submissions/new`)
- Grade selector (P1–S6), optional topic field.
- Three input modes: typed textarea (live char count), photo (camera), scan (image upload).
- On submit: `POST /api/submissions` with SSE streaming — progress events shown during analysis.
- Button disabled below 20 chars.

### Submission Detail (`/submissions/[id]`) — 9 tabs

| Tab | Content |
|---|---|
| 1. 評語 | Coach feedback text, strengths, revision priorities |
| 2. 準則 | 4-criterion rubric score breakdown |
| 3. 修改指南 | Detailed per-suggestion revision instructions with before/after |
| 4. 標注 | `AnnotatedText`: inline error highlights (yellow/orange/red by severity), click for detail |
| 5. 工作台 | `RevisionComposer`: side-by-side revision editor with top-5 AI suggestions |
| 6. 模範文章 | `ModelPassagePanel`: AI-generated model essay |
| 7. 筆記 | `NotebookWorkspace`: extractable learning notes from this submission |
| 8. 錯誤分類 | Error list grouped by taxonomy category |
| 9. 對比 | Before/after revision comparison |

---

## Environment variables

| Var | Required | Notes |
|---|---|---|
| `DATABASE_URL` | Yes | Postgres connection string |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Yes | Clerk frontend key |
| `CLERK_SECRET_KEY` | Yes | Clerk backend key |
| `CLERK_WEBHOOK_SECRET` | Yes | For `/api/webhooks/clerk` |
| `ADMIN_CLERK_USER_IDS` | Yes | Comma-separated Clerk IDs to bootstrap as admins |
| `ANTHROPIC_API_KEY` | One of these | Direct Anthropic SDK path |
| `OPENROUTER_API_KEY` | One of these | OpenRouter path (primary if set) |
| `ANALYSIS_MODEL` | No | Default: `google/gemini-2.5-flash` |
| `ANALYSIS_FALLBACK_MODEL` | No | Retry model on analysis failure |
| `COACH_MODEL` | No | Default: `anthropic/claude-3.5-haiku` |
| `OCR_MODEL` / `OCR_FALLBACK_MODEL` | No | Vision models for photo/scan mode |
| `GLOBAL_UNLIMITED_CREDITS` | No | `true` bypasses all credit checks (UAT) |
| `OPENROUTER_HTTP_REFERER` | No | Optional OpenRouter attribution |
| `OPENROUTER_APP_NAME` | No | Optional OpenRouter attribution |

---

## What's not built yet

| Feature | Schema ready? |
|---|---|
| `FeedbackEvent` UI (was wrong / helpful buttons on errors) | Model exists, no UI |
| Reading practice: passage + comprehension questions | No |
| Assignment mode (teacher assigns tasks to class) | Class model exists, no assignment flow |
| Parent views | No |

---

## Testing

`npm test` runs vitest over `tests/**/*.test.ts`. The tests cover the deterministic logic only (score caps, level bands, typo deduction, offset realignment, JSON extraction, OCR-suspect detection, weakness status); there are no tests that call a model.
