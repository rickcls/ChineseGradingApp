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
    scoring.ts                       — Deterministic score caps from the rubric md (word count, structure band, content-led, short-board, evidence-backed typo count) + the uncertain-level range
    rubric.ts                        — HKDSE 4-criterion rubric + DSE level/score mappings + typo deduction
    rubricGuide.ts                   — Loads dse-chinese-writing-rubric.md (the source of truth) into the prompt
    taxonomy.ts                      — Error taxonomy: 字詞/語法/標點/結構/內容/表達 × subcategories
    hkLexicon.ts                     — Rule-based pre-check: 粵語入文 lexicon, 歐化句式 patterns, 一逗到底 sentences
    weakness.ts                      — EWMA aggregator, status state machine
    auth.ts                          — Clerk user lookup + role sync + legacy cookie migration
    credits.ts                       — Credit ledger: deduct, refund, unlimited flags (`hasUnlimitedCredits`: site-wide test switch, per-user flag, or admin), audit trail
    creditReasons.ts                 — Credit transaction reason codes → Chinese labels; reasons an admin can pick
    signupCredits.ts                 — The 3 free sign-up credits and their reason code (used by auth, the Clerk webhook and the admin sync)
    ocr.ts                           — Vision model invocation for photo/scan input modes (verbatim transcription, no auto-correct)
    ocrSuspect.ts                    — Flags errors that may be OCR misreads (□ placeholders, typos in untouched OCR text)
    teacherReview.ts                 — Teacher access scope (students in the teacher's classes) + teacher review validation
    calibration.ts                   — AI-vs-teacher calibration metrics (agreement, bias, weighted kappa, run-to-run stability)
    topicAnalysis.ts                 — 審題助手: 題眼, requirements, off-topic traps, three 立意 angles (no essay writing)
    themeElevation.ts                — 立意昇華: three-level theme deepening ladder tied to the student's own story
    manuscript.ts                    — Lays an essay out on a 20-column 原稿紙 grid and maps annotations to red-pen marks
    regradeCompare.ts                — Re-grade snapshot of a revision + before → after comparison (level, criteria, issue counts, noise)
    practiceDrill.ts / drillView.ts  — 150-字 weakness drills: task generation from the student's own errors, requirement check
    examTimer.ts                     — 限時模擬: countdown phases, pacing vs 600 字, local draft format
    assignments.ts                   — Teacher assignments: input validation, class/student scopes, progress (未交/已交/遲交/逾期), model-passage lock, class common issues + level spread
    genres.ts                        — Shared 文體 options (essay form + assignments)
    notebook.ts                      — Learning note serialization (manual/phrase/lesson types)
    modelPassage.ts                  — AI-generated model essay management
    revisionSuggestions.ts           — Workbench suggestion prioritization (top 5 + top 2 errors)
    revisionPriority.ts              — Revision priority normalization + deduplication
  app/
    layout.tsx                       — HTML shell, Header, global Tailwind CSS
    error.tsx                        — Friendly error page (retry / back home) instead of the framework's server-error screen
    page.tsx                         — Root redirect
    student/dashboard/page.tsx       — Student dashboard: submissions list, weakness summary
    teacher/dashboard/page.tsx       — Teacher dashboard: class overview, recent submissions
    admin/dashboard/page.tsx         — 管理後台 with tabs: 用戶與點數 / 班級 / 點數紀錄 (?tab=users|classes|credits)
    admin/actions.ts                 — Admin server actions; they return { ok, message } for inline feedback instead of throwing
    submissions/
      new/page.tsx                   — Essay intake form: grade, topic, typed/photo/scan input
      [id]/page.tsx                  — 9-tab detail view (see UI pages below)
      [id]/report/page.tsx           — Printable 批改報告: 原稿紙 grid with red-pen marks, numbered notes, scores (print → PDF)
    teacher/assignments/new/page.tsx — Teacher: set a writing task for a class
    teacher/assignments/[id]/page.tsx — Teacher: one task's roster (submission status, level), level spread, class common issues, release/delete controls
    api/
      submissions/route.ts           — POST: create → analyse → aggregate → deduct credit (SSE streaming)
      submissions/[id]/route.ts      — GET / DELETE single submission
      submissions/[id]/revision/route.ts      — POST: save revision session
      submissions/[id]/revision/regrade/route.ts — POST: re-grade the latest revision (1 credit, refunded on failure)
      drills/route.ts                — POST: start (or resume) a 150-字 drill for a weakness (free; 10 new per user per 24h)
      drills/[id]/check/route.ts     — POST: check a drill response (max 3 checks; completed drills are locked)
      submissions/[id]/model-passage/route.ts — POST: generate/update model essay
      submissions/[id]/notebook-note/route.ts — POST: create learning note from submission
      submissions/[id]/errors/[errorId]/feedback/route.ts — POST: student reaction to an annotation (helpful/wrong/confusing)
      teacher/submissions/[id]/review/route.ts — POST: teacher's own scores/level/comment (upsert per teacher)
      teacher/assignments/route.ts   — POST: create an assignment for a class the teacher manages
      teacher/assignments/[id]/route.ts — PATCH: release/re-lock the AI 參考範文 or change the due date; DELETE (essays are kept, unlinked)
      topic-analysis/route.ts        — POST: 審題助手 (free; cached per topic; 20 new topics per user per 24h)
      submissions/[id]/theme-elevation/route.ts — POST: generate 立意昇華 suggestions, stored on Analysis.themeElevation
      notebook/route.ts              — POST: standalone notebook entry
      notebook/[entryId]/route.ts    — GET: fetch notebook entry
      ocr/route.ts                   — POST: OCR image → text
      weaknesses/route.ts            — POST: get weakness profiles for current user
      webhooks/clerk/route.ts        — Clerk user sync webhook
  components/
    Header.tsx                       — Top nav
    CoachCard.tsx                    — Feedback container with tone variants
    AnnotatedText.tsx                — Client: essay with inline <mark> highlights + detail panel + 有幫助／批改有錯／看不明白 buttons
    SubmissionForm.tsx               — Client: multi-mode input with SSE progress streaming, timed mode, local draft autosave/restore
    ExamTimerPanel.tsx               — Client: 限時模擬 presets and the sticky countdown bar
    RevisionComposer.tsx             — Side-by-side revision editor with AI suggestions
    ModelPassagePanel.tsx            — AI model essay viewer
    TeacherReviewForm.tsx            — Client: teacher score/level/comment form on the teacher submission page
    TopicAnalysisPanel.tsx           — Client: 審題助手 panel on the new-submission form
    ThemeElevationPanel.tsx          — Client: 立意昇華 panel on the submission page (examples can be saved to the notebook)
    ManuscriptSheet.tsx              — 原稿紙 grid renderer (circles for typos/punctuation, wavy underline for wording, ① markers)
    PrintButton.tsx                  — Client: window.print() for the report page
    RegradePanel.tsx                 — Client: 重新評分 button / before → after result on the compare page
    MicroDrillPanel.tsx              — Client: 150-字 drill on confirmed/improving weakness cards
    ModelPassageLockedNotice.tsx     — Shown instead of the AI 參考範文 while an assignment keeps it locked
    teacher/AssignmentForm.tsx       — Client: new-assignment form (class, topic, 文體, instructions, due date)
    teacher/AssignmentControls.tsx   — Client: release/re-lock the AI 參考範文, delete the assignment
    NotebookWorkspace.tsx / NotebookQuickPanel.tsx — Note-taking UI
    admin/
      AdminUserDirectory.tsx         — User list (search, role/credit filters, sort) + the selected user's panel; Clerk IDs only under 技術資料
      UserManageForm.tsx             — Client: role, credit change (+1/+5/+10, reason, note) and unlimited flag saved with one 儲存變更
      ClassManager.tsx               — Client: create/rename/re-teacher/delete classes, add many students with search, remove students, 全班加點
      ActionMessage.tsx              — Inline success/error line for admin forms
      SyncClerkUsersButton.tsx       — Force-sync Clerk users to DB
prisma/
  schema.prisma                      — All DB models
  migrations/                        — Postgres migration history
scripts/
  migrate-deploy.ts                  — Vercel production build step: migrate deploy, baselining a db-push-created or empty database
  eval-grading.ts                    — npm run eval:grading: grade gold essays N times, report agreement with teachers
  export-teacher-reviews.ts          — npm run eval:export-reviews: export teacher reviews as gold essays
eval/
  README.md                          — Gold essay format and how to read the calibration report (eval/gold, eval/results are git-ignored)
```

---

## Database models (prisma/schema.prisma)

| Model | Purpose |
|---|---|
| `AppUser` | One row per Clerk user. Has `role` (student/teacher/admin), `credits`, `unlimitedCredits`, `gradeLevel`, `displayName`. |
| `Submission` | `rawText` (untouched OCR transcript for photo/scan, else same as typed text), `verifiedText` (what was graded), source mode (typed/photo/scan), `taskPrompt` (題目), `genre` (文體, null = model decides), `timedMinutes` / `writingSeconds` (限時模擬 limit and time used), `assignmentId` (set when written for a teacher's assignment), status enum (uploaded/verified/analyzed/failed), OCR fields. |
| `Analysis` | HKDSE rubric scores (JSON), DSE level, overall score, model name, coach feedback, strengths, revision priorities, `themeElevation` (立意昇華 JSON, generated on demand). |
| `ErrorRecord` | Per-error row: category, subcategory, evidence span, char offsets, suggestion, severity 1–3, `ocrSuspect` flag, `studentReaction` (latest helpful/wrong/confusing). |
| `WeaknessProfile` | Per `(user, category, subcategory)`: EWMA severity, evidence count, 10-submission rolling window (JSON), status enum. |
| `RevisionSession` | Revision workspace: revised text, target error IDs, improvement delta, `regrade` (JSON snapshot of the re-grade, if any). |
| `NotebookEntry` | Student learning notes: type (manual/phrase/lesson), content, linked submission. |
| `AiModelPassage` | AI-generated model essay with highlights, linked to a submission. |
| `CreditTransaction` | Audit trail for all credit changes (deduction, refund, admin grant) with attribution. |
| `Class` / `StudentClass` | Teacher class management + student enrolment. |
| `Assignment` | A writing task for one class: `taskPrompt`, `genre`, `instructions`, `dueAt` (end of the chosen day, HK time), `modelPassageReleased` (default false), creator. Deleting it unlinks, never deletes, students' essays. |
| `WritingTask` | Writing prompts with grade, genre, guidance, suggested length. |
| `FeedbackEvent` | Append-only log of student reactions to errors (helpful/wrong/confusing/cleared) — for prompt tuning. |
| `PracticeDrill` | 150-字 drill per (user, category, subcategory): task JSON, latest response and feedback, attempts, `completedAt`. Practice only; never changes weakness profiles. |
| `TopicAnalysis` | 審題助手 result per (user, topic, genre, prompt version); serves as cache and daily-limit counter. |
| `TeacherReview` | A teacher's own marking of an analysis: scores, typo count, DSE level, comment. One per (analysis, teacher). Shown to the student; exported as calibration gold data. |

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

`dse-chinese-writing-rubric.md` is the single source of truth; `rubric.ts`, `scoring.ts`, the prompt text in `analysis.ts` and the fallback in `rubricGuide.ts` must match it. Prompt version: `v12-2026-10-hk-precheck`.

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
- HK pre-check (`src/lib/hkLexicon.ts`): before the call, a rule scan finds Cantonese words (嘅、咗、冇、佢哋…), Europeanised patterns (作出…的決定、在…的情況下、當…的時候、進行討論、有著) and run-on comma sentences, with exact offsets. They are listed in the user prompt for the model to confirm or dismiss in context. After parsing, any *certain* Cantonese hit outside quotation marks that no model error covers is added as a 表達/粵語入文 error (at most 15), so these never slip through. Context-dependent words (點解、一齊、俾、唔…) are only ever judged by the model.
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

**Level range (`levelRange` / `storedLevelRange` in `scoring.ts`):** the displayed level stays the conservative point estimate, but when the final total ± 2 points (`SCORE_NOISE_POINTS`, short-board caps included) crosses a band boundary, or the holistic level came out lower than the scores support, the submission page, the 批改報告 and the teacher page also show 「可能介乎 Level X–Y」. The same ±2 threshold labels re-grade changes as normal AI variation.

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

Excluded from aggregation (`countsTowardWeakness`): `ocrSuspect = true` errors and errors whose `studentReaction` is `"wrong"`. When a student flags or unflags an error after grading, `resyncErrorWeakness` recounts that submission's contribution to the one affected profile from its `ErrorRecord`s (the EWMA is left unchanged).

---

## Credit system (src/lib/credits.ts)

- Each submission costs a student 1 credit; re-grading a revision also costs 1 credit (reason `revision_regrade`, refunded as `revision_regrade_refund` on failure).
- Admins are never charged or refunded (`hasUnlimitedCredits`), so they can try the student side freely; their essays are left out of the admin's 教師檢視 list.
- 審題助手, 立意昇華, model passages, notebook notes and 150-字 drills are free (審題 and drills have daily limits).
- Essays written for a teacher's assignment cost the student 1 credit like any other submission.
- Credits are deducted before analysis begins; automatically refunded on failure.
- `GLOBAL_UNLIMITED_CREDITS=true` env var bypasses all credit checks (for UAT/dev).
- Per-user `unlimitedCredits` flag bypasses checks for that user only.
- All changes are recorded in `CreditTransaction` with admin attribution. Admin changes store a reason code (`class_distribution` 課堂派發, `compensation` 補償, `testing` 測試, `admin_adjustment` 其他) plus an optional note after 「：」; `formatCreditReason` shows every code in Chinese.
- 全班加點 gives every student in a class the same amount in one transaction.
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
| 字詞 | 錯別字, 形近字, 同音字, 詞語搭配不當, 成語誤用 |
| 語法 | 語序, 成分殘缺, 搭配不當, 句式雜糅, 歐化句式 |
| 標點 | 逗號誤用, 句號問號混淆, 引號使用, 一逗到底 |
| 結構 | 中心不明, 段落銜接, 詳略失當, 開頭結尾 |
| 內容 | 材料單薄, 脫離題意, 立意平淡 |
| 表達 | 修辭貧乏, 用詞單一, 語言乾澀, 粵語入文 |

`validCategory(category, subcategory)` silently drops any model-hallucinated category outside the taxonomy.

---

## UI pages

### Student Dashboard (`/student/dashboard`)
- 老師佈置的任務 (only for students in a class): the latest assignments with status, due date and 「開始寫」 (→ `/submissions/new?assignment=…`) or 「看批改結果」.
- Lists recent submissions + weakness summary (confirmed weaknesses as focus areas, improving as encouragement).
- Coach greeting adapts to submission count (first time / returning / veteran).

### Weakness Report (`/weaknesses`)
- Ability radar and weakness profiles by status. Confirmed and improving weaknesses offer 「做個 150 字小練習」: a short task built from the student's own past errors in that subcategory (OCR-suspect and student-flagged errors excluded), 2–3 checkable requirements, then a per-requirement ✓/✗ check, praise, next step and an optional one-sentence fix quoted from the response. No score, no model answer.

### Teacher Dashboard (`/teacher/dashboard`)
- Class list, recent submissions across all students in teacher's classes.
- 寫作任務: the latest assignments with 已交 x / class size, 「佈置新任務」, and a 「佈置任務」 link on each class card.

### Assignments (`/teacher/assignments/new`, `/teacher/assignments/[id]`)
- A teacher (or admin) sets a topic, optional 文體, instructions and due date for one of their classes.
- The task page lists every enrolled student with 未提交 / 已提交 / 遲交 / 逾期未交 (lateness judged on the first submission), the latest essay's AI level and score, whether it was reviewed, and a link to the teacher submission page.
- It also shows the AI level spread and the class's most common problems (per subcategory: how many students' latest essays have it, excluding OCR suspects and student-flagged errors), as material for the next lesson.
- The AI 參考範文 is locked for assigned essays until the teacher presses 「開放 AI 參考範文」 (it can be re-locked). Locked: the model-passage API returns 403 and the submission and compare pages show `ModelPassageLockedNotice`.

### Teacher Submission (`/teacher/submissions/[id]`)
- Essay, AI feedback and annotations (with "學生回報有誤" / "OCR 可能讀錯" markers).
- 「老師覆核」 form: four scores, typo count, level (with the score-derived level as a hint) and a comment. The student sees it at the top of their submission page, and it overrides the AI estimate for them.

### Admin Dashboard (`/admin/dashboard`) — 管理後台
- Tabs: **用戶與點數** (directory + one panel per user: role, credit change, unlimited flag, one 儲存變更; inline result messages; an admin can't change their own role), **班級** (create, rename, change teacher, delete with its assignments, add many students with search, remove students, 全班加點), **點數紀錄** (latest 100, filter by user and type 管理員調整 / 提交與退回 / 新用戶贈送, Chinese reasons, who made each change).
- When `GLOBAL_UNLIMITED_CREDITS` is on, a banner says so and each user's badge still shows the balance that applies once it is off.
- Admin menu: 管理後台, 教師檢視, then 試用學生功能 (學生主頁, 新作提交, 作品紀錄, 學習筆記, 能力地圖). Teacher menu: 學生作品, 佈置任務.

### New Submission (`/submissions/new`)
- Grade selector (P5–S6), 文體 selector, topic field.
- 審題助手 panel: after typing the topic, 「先審題」 shows 題眼, requirements, off-topic traps, three 立意 angles (基本 → 深入 → 深刻) and a writing checklist. Free; does not write the essay.
- Three input modes: typed textarea (live char count), photo (camera), scan (image upload).
- 限時模擬 (typed mode, optional): presets 135 / 90 / 45 minutes. A sticky bar shows the countdown, the phase (審題列大綱 → 寫作 → 檢查), pacing against 600 字, and warnings at 15 and 5 minutes. Paste is blocked while the timer runs; at time-up (or 「完成，交卷」) the essay locks and can still be submitted. The limit and time used are saved on the submission and shown on its page. Grading ignores timing.
- The typed essay, topic, genre and timer are autosaved to `localStorage` (`essay-draft-v1`); on return the form offers 恢復草稿 / 捨棄, and a restored timer keeps counting from its original start. The draft is cleared after a successful submission.
- On submit: `POST /api/submissions` with SSE streaming — progress events shown during analysis.
- With `?assignment=<id>` (student must be enrolled in its class): a banner shows the class, topic, 文體, instructions and due date; topic and 文體 are locked, the draft is kept under its own key, and the server replaces any client-sent topic/genre with the assignment's.
- Button disabled below 20 chars.

### Submission Detail (`/submissions/[id]`) — 9 tabs

| Tab | Content |
|---|---|
| 1. 評語 | Coach feedback text, strengths, revision priorities |
| 2. 準則 | 4-criterion rubric score breakdown |
| 3. 修改指南 | Detailed per-suggestion revision instructions with before/after |
| 3b. 立意昇華 | `ThemeElevationPanel`: current theme + diagnosis, then 個人成長 → 人情與社會 → 哲理與文化, each with a one-sentence example from the student's own story and a 生硬套用 warning |
| 4. 標注 | `AnnotatedText`: inline error highlights (yellow/orange/red by severity), click for detail; students can mark each annotation helpful / wrong / confusing |
| 5. 工作台 | `RevisionComposer`: side-by-side revision editor with top-5 AI suggestions |
| 6. 模範文章 | `ModelPassagePanel`: AI-generated model essay |
| 7. 筆記 | `NotebookWorkspace`: extractable learning notes from this submission |
| 8. 錯誤分類 | Error list grouped by taxonomy category |
| 9. 對比 | Before/after revision comparison (`/submissions/[id]/compare`), with 「重新評分」: the latest revision is graded by the same pipeline and compared with the original — level, four criteria, error counts per issue (cleared ✓ / new), new feedback. Changes within ±2 points are labelled as normal AI variation. Re-grades are stored on the RevisionSession, not as submissions, so they never feed weakness tracking. |

### 批改報告 (`/submissions/[id]/report`)
- Linked from the submission page header as 「批改報告（可列印／PDF）」.
- The essay on a 20-column 原稿紙 grid. Typos are circled; for punctuation errors only the marks themselves are circled, with a wavy underline when the problem is a missing mark; wording/grammar problems get a wavy red underline. ①② markers match the numbered notes below.
- Also shows the AI-estimated level (and the teacher's level if reviewed), the four scores, coach and teacher comments, strengths and the top three priorities, plus an "AI 估算，只供參考" disclaimer.
- Annotations the student flagged as wrong are left out. Print styles (A4, header/footer hidden) live at the end of `globals.css`; on phones the grid scrolls sideways.

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
| `COACH_MODEL` | No | Default: `anthropic/claude-3.5-haiku`. Used for notebook notes, 審題助手 and 立意昇華 |
| `TOPIC_ANALYSIS_MODEL` / `THEME_ELEVATION_MODEL` / `PRACTICE_DRILL_MODEL` | No | Override `COACH_MODEL` for 審題助手 / 立意昇華 / drills (`*_FALLBACK_MODEL` overrides the fallback) |
| `OCR_MODEL` / `OCR_FALLBACK_MODEL` | No | Vision models for photo/scan mode |
| `GLOBAL_UNLIMITED_CREDITS` | No | `true` bypasses all credit checks (UAT) |
| `OPENROUTER_HTTP_REFERER` | No | Optional OpenRouter attribution |
| `OPENROUTER_APP_NAME` | No | Optional OpenRouter attribution |

---

## What's not built yet

| Feature | Schema ready? |
|---|---|
| Reading practice: passage + comprehension questions | No |
| Parent views | No |

---

## Deploying (Vercel)

`vercel.json`'s `buildCommand` is `prisma generate && node --import tsx scripts/migrate-deploy.ts && next build`. On production builds (`VERCEL_ENV=production`; previews skip it) the script runs `prisma migrate deploy`. If the database has no migration history (P3005, it was created with `db push`) it marks `20260428000000_role_credit_system` and `20260429000000_unlimited_credits` as applied when `AppUser.unlimitedCredits` exists, or every migration when the database already matches the schema, then deploys the rest. An empty database is created with `db push` and every migration is marked as applied, because the migration history starts from an existing schema. Any failure stops the build, so code never ships without its schema. Every schema change therefore needs a migration folder (generate it with `prisma migrate diff --from-schema-datamodel <previous schema> --to-schema-datamodel prisma/schema.prisma --script`).

---

## Testing

`npm test` runs vitest over `tests/**/*.test.ts`. The tests cover the deterministic logic (score caps, level bands, typo deduction, offset realignment, JSON extraction, OCR-suspect detection, weakness status, calibration metrics) and `analyzeSubmission` against a mocked model; none call a real model or need a database.

Grading quality is measured separately with `npm run eval:grading` against teacher-graded essays; see `eval/README.md`.
