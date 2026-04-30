# AI Project Context: Chinese Grading Webpage

This file is written for future AI agents and developers. It summarizes the current state of the project, what has already been built, and where the important code lives.

## Product Summary

This is an AI Chinese writing coach for Hong Kong students. Students can submit Chinese writing by typing, uploading photos, or uploading scans/PDFs. The app extracts text when needed, analyzes the writing against an HKDSE-style rubric, gives warm tutor-style feedback, highlights evidence spans, tracks recurring weaknesses, supports revision comparison, generates an AI reference passage, and lets students save useful phrases or lessons into a notebook.

The UI language is mostly Traditional Chinese, with a supportive coaching tone rather than a cold grading tone.

Three user roles exist: `student`, `teacher`, `admin`. An admin portal lets admins manage roles, credits, and class assignments.

## Tech Stack

- Framework: Next.js 16 App Router
- Language: TypeScript
- UI: React 19, Tailwind CSS
- Database: PostgreSQL through Prisma
- ORM: Prisma Client
- Validation: Zod
- Authentication: Clerk (`@clerk/nextjs` v7) with role-based access
- Clerk UI localization: `@clerk/localizations`
- Webhook verification: `svix` (for Clerk webhooks)
- AI providers:
  - OpenRouter for most text and vision calls
  - Anthropic direct fallback path is also implemented
- OCR / document intake:
  - Vision model OCR for images
  - `pdfjs-dist` on the client to convert uploaded PDFs into page images before OCR
- Deployment target: Vercel-friendly full-stack Next.js app
- Runtime: Node.js API routes for AI/OCR work; long-running AI routes set `maxDuration` up to 300 seconds

## Important Commands

- `npm run dev`: start local Next.js dev server
- `npm run build`: run `prisma generate` and `next build --webpack`
- `npm run start`: start production server
- `npm run lint`: run Next lint
- `npm run db:push`: push Prisma schema to the database
- `npm run db:seed`: seed rubric/tasks from `prisma/seed.ts`
- `npm run db:legacy-users`: inspect legacy anonymous users
- `npm run db:legacy-users:delete-empty`: delete empty legacy anonymous users

The `postinstall` script runs Prisma generation and copies PDF.js assets into `public/`.

## Environment Variables

Do not hard-code secrets. Expected environment variables include:

**Database**
- `DATABASE_URL`: PostgreSQL connection string

**Clerk (authentication)**
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`: Clerk publishable key
- `CLERK_SECRET_KEY`: Clerk secret key
- `NEXT_PUBLIC_CLERK_SIGN_IN_URL`: `/sign-in`
- `NEXT_PUBLIC_CLERK_SIGN_UP_URL`: `/sign-up`
- `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL`: `/`
- `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL`: `/`
- `CLERK_WEBHOOK_SECRET`: signing secret from the Clerk dashboard webhook config (required for `POST /api/webhooks/clerk`)
- `ADMIN_CLERK_USER_IDS`: comma-separated Clerk user IDs that are always treated as `admin` regardless of DB role (bootstrap admins)
- `UAT_UNLIMITED_CREDITS` or `GLOBAL_UNLIMITED_CREDITS`: truthy value (`1`, `true`, `yes`, `on`) makes all users effectively unlimited for submission credits

**AI**
- `OPENROUTER_API_KEY`: primary AI API key
- `ANTHROPIC_API_KEY`: optional direct Anthropic fallback
- `OPENROUTER_HTTP_REFERER`: optional OpenRouter metadata
- `OPENROUTER_APP_NAME`: optional OpenRouter metadata
- `FAST_FALLBACK_MODEL`: shared default/fallback model, defaults to `google/gemini-2.5-flash`
- `ANALYSIS_MODEL`: optional analysis model override
- `ANALYSIS_FALLBACK_MODEL`: optional analysis fallback override
- `COACH_MODEL`: coaching model (defaults to `anthropic/claude-3.5-haiku`)
- `OCR_MODEL`: optional OCR model override
- `OCR_FALLBACK_MODEL`: optional OCR fallback override
- `MODEL_PASSAGE_MODEL`: optional reference passage model override
- `MODEL_PASSAGE_FALLBACK_MODEL`: optional reference passage fallback override
- `NOTEBOOK_NOTE_FALLBACK_MODEL`: optional fallback for AI-generated notebook notes
- `ANALYSIS_OPENROUTER_TIMEOUT_MS`, `OCR_OPENROUTER_TIMEOUT_MS`, `MODEL_PASSAGE_TIMEOUT_MS`, `MODEL_PASSAGE_REPAIR_TIMEOUT_MS`, `NOTEBOOK_NOTE_TIMEOUT_MS`: optional timeout tuning

## Authentication Model

The app uses **Clerk** for authentication. All routes except `/sign-in`, `/sign-up`, and `/api/webhooks/*` are protected by `clerkMiddleware` in `src/proxy.ts` using Next's proxy entrypoint.

### User identity flow

1. User signs in via Clerk.
2. On first visit to a protected page, `getOrCreateAppUser()` in `src/lib/auth.ts` is called — it upserts an `AppUser` row in Postgres keyed by `clerkUserId`.
3. Legacy cookie-based rows (from before Clerk was added) are linked to the Clerk account on first sign-in by matching on email or the old `ccoach_uid` cookie.
4. The Clerk webhook at `POST /api/webhooks/clerk` handles `user.created` and `user.updated` events, creating/syncing DB records immediately on signup regardless of page visits.

### Roles

Three roles: `student` (default), `teacher`, `admin`.

Role is stored in two places:
- `AppUser.role` in Postgres (source of truth for credits/class logic)
- `publicMetadata.role` in Clerk (used by session claims and `requireRole` middleware checks)

`syncClerkRole()` in `auth.ts` keeps the Clerk metadata in sync automatically on every `getOrCreateAppUser()` call. Admins can also update roles via the admin portal, which writes both places atomically.

Bootstrap admins are set via `ADMIN_CLERK_USER_IDS` env var — those IDs are always treated as `admin` even if the DB row says otherwise.

### Key auth functions (src/lib/auth.ts)

- `getOrCreateAppUser()`: gets or creates the `AppUser` row, syncs Clerk metadata, ensures initial credits
- `getCurrentUserRole()`: reads role from DB / Clerk metadata / session claims
- `requireRole(roles)`: redirects to `/unauthorized` if current user's role is not in the allowed list

Files:
- `src/proxy.ts` — Clerk proxy middleware, public route list, auth protection
- `src/lib/auth.ts` — DB upsert, role sync, bootstrap admin check

## Credits Model

Students receive 3 initial free credits when their Clerk-linked `AppUser` is created or when an older linked user is found without the initial credit grant. Each essay submission costs 1 credit unless either global unlimited credits are enabled or the user has `unlimitedCredits` set in the admin portal.

Credit behavior:
- `deductCreditForSubmission()` charges before analysis starts.
- `refundCreditForSubmission()` refunds the credit if analysis fails after charging.
- `InsufficientCreditsError` returns a 402-style no-credit response from the submission API.
- All changes are logged in `CreditTransaction`.

Important file:
- `src/lib/credits.ts`

## Admin Portal

Route: `/admin/dashboard` (requires `admin` role)

Features:
- **User list**: all Clerk-linked `AppUser` rows with role badge and credit balance
- **Role management**: change any user's role (writes DB + Clerk metadata)
- **Credit management**: add or remove credits; toggle per-user unlimited credits
- **Class management**: create classes assigned to teachers; assign students to classes
- **Credit transaction log**: last 50 transactions with amounts and reasons
- **Sync from Clerk button**: backfills DB records for Clerk users who haven't visited a page yet (calls `syncClerkUsersAction`)

Legacy users (no `clerkUserId`) are hidden from role/credit management with a count note — they must sign in via Clerk to be managed.

Important files:
- `src/app/admin/dashboard/page.tsx`
- `src/app/admin/actions.ts` — all admin server actions
- `src/components/admin/RoleUpdateForm.tsx`
- `src/components/admin/CreditAdjustmentForm.tsx`
- `src/components/admin/UnlimitedCreditsForm.tsx`
- `src/components/admin/SyncClerkUsersButton.tsx`

### Clerk Webhook Setup

To ensure users appear in the admin immediately on signup:

1. In Clerk Dashboard → Webhooks → Add Endpoint
2. URL: `https://your-domain.com/api/webhooks/clerk`
3. Subscribe to: `user.created`, `user.updated`
4. Copy Signing Secret → set as `CLERK_WEBHOOK_SECRET` in env

File: `src/app/api/webhooks/clerk/route.ts`

## Data Model

Main Prisma models in `prisma/schema.prisma`:

- `AppUser`: authenticated student/teacher/admin identity (linked to Clerk via `clerkUserId`); holds role, credits, grade level
- `Submission`: original and verified student text, source, status, OCR metadata
- `Analysis`: scores, feedback, strengths, revision priorities, model metadata
- `ErrorRecord`: evidence spans, categories, severity, suggestions, offsets
- `WeaknessProfile`: long-term weakness aggregation and status
- `RevisionSession`: revised text and basic improvement metrics
- `AiModelPassage`: generated reference passage plus teaching highlights
- `NotebookEntry`: saved phrases, lessons, and manual notes
- `Rubric`: rubric JSON
- `WritingTask`: optional seeded writing prompts
- `FeedbackEvent`: placeholder for feedback/reaction tracking
- `CreditTransaction`: audit log of all credit changes (amount, reason, clerkUserId)
- `Class`: class entity with assigned teacher (`teacherClerkUserId`)
- `StudentClass`: many-to-many join between students and classes

Status/state enums already exist for submissions, weakness profiles, notebook entry types, etc.

## Main Pages

- `/`: redirects to `/dashboard`
- `/dashboard`: role-aware redirect → `/student/dashboard`, `/teacher/dashboard`, or `/admin/dashboard`
- `/student/dashboard`: student home with greeting, recent submissions, confirmed/improving weaknesses
- `/teacher/dashboard`: teacher view of assigned class and student submissions
- `/admin/dashboard`: admin portal (roles, credits, classes, sync)
- `/submissions/new`: submission form with typed, photo, and scan modes
- `/submissions/[id]`: full feedback page with scores, DSE level, strengths, priorities, annotations, revision workbench, model passage panel, and notebook quick save
- `/submissions/[id]/compare`: revision comparison view
- `/weaknesses`: ability map and recurring weakness report
- `/notebook`: notebook workspace for saved phrases/lessons/manual entries
- `/sign-in`, `/sign-up`: Clerk-hosted auth pages
- `/unauthorized`: shown when a user tries to access a page above their role

Supporting UI components are in `src/components/`.

## Submission and Analysis Flow

Primary route: `src/app/api/submissions/route.ts`

1. Client posts text, grade level, optional task prompt, optional genre, and source.
2. Server validates input with Zod.
3. Server requires `student` or `admin` role and updates the user's grade level if the request changes it.
4. Server deducts 1 credit unless unlimited credits apply.
5. A `Submission` is created with `verifiedText`.
6. `analyzeSubmission()` runs the AI rubric analysis.
7. An `Analysis` row is created.
8. AI error spans become `ErrorRecord` rows.
9. Submission status becomes `analyzed`.
10. `updateWeaknessProfiles()` updates long-term weakness state.
11. API returns the submission ID.

The client normally requests streaming (`stream: true`) and reads server-sent events for progress while the AI analysis runs. If analysis fails after charging, the submission is marked `failed` where possible and the credit is refunded.

Important files:
- `src/components/SubmissionForm.tsx`
- `src/app/api/submissions/route.ts`
- `src/lib/analysis.ts`
- `src/lib/weakness.ts`
- `src/lib/credits.ts`

## AI Analysis Behavior

`src/lib/analysis.ts` contains the main scoring prompt and post-processing. Current prompt version:

- `v5-2026-04-enriched-revision-suggestions`

The analysis asks the model to return strict JSON with:

- HKDSE `dse_level`
- scores for content, expression, structure, punctuation
- typo count and word count
- coach feedback
- strengths
- revision priorities
- error records with evidence spans and character offsets

The scoring is intentionally conservative and anchored to HKDSE level bands. It includes guardrails against over-scoring, whole-paragraph rewrites, and vague feedback.

AI wrapper and fallback logic live in `src/lib/anthropic.ts`. Despite the filename, it supports both OpenRouter chat completions and direct Anthropic calls.

## OCR Flow

Primary route: `src/app/api/ocr/route.ts`

Photo/scan submission is handled by `CameraCaptureFlow`:

1. User uploads images or scans.
2. For scan mode, PDFs are accepted and converted client-side to page images through `pdfjs-dist`.
3. Client posts up to 8 page images to `/api/ocr`.
4. Server uses a vision model to OCR each page.
5. For multi-page uploads, server asks the model to merge page text into one coherent transcript.
6. User can review/edit recognized text before submitting to analysis.

Important files:
- `src/components/CameraCaptureFlow.tsx`
- `src/app/api/ocr/route.ts`
- `src/lib/ocr.ts`
- `src/types/pdfjs-dist-legacy-webpack.d.ts`
- `src/types/public-pdfjs.d.ts`

## Weakness Tracking

Weaknesses are derived from persisted `ErrorRecord` rows after each analysis.

`src/lib/weakness.ts`:
- Ignores OCR-suspect errors
- Groups by `category::subcategory`
- Tracks evidence count, submission IDs, recent rolling counts, and severity EWMA
- Uses status machine: `watching` → `confirmed` → `improving` → `resolved`

The `/weaknesses` page also renders recent rubric averages as an ability map.

## Revision Workspace

Students can submit a revised version for an analyzed submission.

Primary route: `src/app/api/submissions/[id]/revision/route.ts`

The route:
- Validates revised text
- Verifies ownership
- Accepts optional targeted error IDs
- Calculates basic before/after metrics
- Counts how many targeted evidence spans changed
- Creates a `RevisionSession`
- Returns a compare URL

Important UI components:
- `src/components/RevisionComposer.tsx`
- `src/components/RevisionComparison.tsx`
- `src/components/RevisionSuggestionList.tsx`

## AI Reference Passage

Students can generate an AI reference passage for comparison and learning.

Primary route: `src/app/api/submissions/[id]/model-passage/route.ts`

`src/lib/modelPassage.ts`:
- Uses the original text, grade level, existing coach feedback, and revision priorities
- Generates a full reference passage
- Returns 5-8 teaching highlights
- Stores one `AiModelPassage` per submission through upsert
- Includes parsing/repair behavior for model JSON responses

Important UI:
- `src/components/ModelPassagePanel.tsx`

## AI Generated Notes and Notebook

Notebook entries let students save phrases, lessons, and manual notes.

Primary routes:
- `src/app/api/notebook/route.ts`
- `src/app/api/notebook/[entryId]/route.ts`
- `src/app/api/submissions/[id]/notebook-note/route.ts`

Notebook supports:
- Create, list, update, delete entries
- Filter by submission, tag, or text search
- Link entries to submissions and AI model passages
- Save source before/after text when useful
- Generate a structured AI reference note from a submission, latest analysis, strengths, and revision priorities
- Optionally target one marking focus: `內容`, `表達`, `結構`, or `標點`

AI note generation:
- Implemented in `src/lib/notebookNote.ts`
- Uses `COACH_MODEL` with `NOTEBOOK_NOTE_FALLBACK_MODEL`
- Validates model output with Zod before returning a draft
- Returns a draft only; the student still saves it through the normal notebook create route
- Current note template: `【學習重點】`, `【原文觀察】`, `【下次做法】`, `【示範句】`, `【檢查清單】`

Feedback page placement:
- `/submissions/[id]` has separate top-level tabs for `AI 參考範文` and `AI 參考筆記`
- The notes tab uses `NotebookQuickPanel` and calls the notebook-note API to fill the editable draft

Important files:
- `src/app/notebook/page.tsx`
- `src/components/NotebookWorkspace.tsx`
- `src/components/NotebookQuickPanel.tsx`
- `src/lib/notebookNote.ts`
- `src/lib/notebook.ts`

## Styling and UX Conventions

- Global styles are in `src/app/globals.css`.
- Tailwind config is in `tailwind.config.ts`.
- Shared card/button/panel styles use classes such as `paper-panel`, `paper-panel-strong`, `btn-primary`, `btn-secondary`, `pill`, and `section-kicker`.
- The UI should keep the existing warm, student-centered tone.
- Avoid changing Traditional Chinese user-facing copy into Simplified Chinese.
- Avoid making the app feel like a strict scoring machine; feedback should remain specific, gentle, and actionable.

## Current Completed Features

- Clerk-based authentication with role-based access control (student / teacher / admin)
- Anonymous-to-Clerk migration path (links old cookie users on first sign-in)
- Clerk webhook sync: DB record created immediately on Clerk signup
- Admin portal: user role management, credit management, class creation, student assignment, transaction log, Clerk sync button
- Teacher dashboard with class and student submission views
- Student dashboard with recent submissions and progress metrics
- Typed writing submission
- Photo/scan/PDF-to-OCR submission path
- Streaming submission analysis progress through server-sent events
- Credit deduction/refund flow with per-user and global unlimited-credit options
- AI HKDSE-style analysis
- Rubric scores, DSE level, typo bonus, word count
- Warm coach feedback
- Strengths and prioritized revision guidance
- Error annotations with evidence spans
- Weakness profile aggregation and ability map
- Revision session creation and comparison
- AI reference passage generation with teaching highlights
- AI reference note generation from feedback and revision priorities
- Notebook for saving phrases, lessons, generated notes, and manual entries
- Prisma schema for all current app data
- Seed script for initial rubric/tasks

## Known Limitations and Extension Points

- Submission analysis is synchronous inside the API route. Long model calls can still hit hosting limits.
- Vercel function max durations are configured for the main OCR/submission APIs, but a true queue would be safer for heavier usage.
- OCR uses AI vision models rather than deterministic OCR confidence maps.
- `FeedbackEvent` exists but there is no full UI flow for usefulness/error reactions yet.
- `Rubric` exists in the database, but core analysis currently uses local rubric helpers and markdown guide files.
- Reading practice models/enums exist conceptually, but the app is focused on writing.
- There is no job queue; if analysis/OCR grows heavier, add background processing.
- No automated test suite is currently documented in `package.json`.

## Safe Areas for Future Changes

- Prompt tuning: `src/lib/analysis.ts`, `src/lib/modelPassage.ts`, `src/lib/notebookNote.ts`, `src/lib/ocr.ts`
- Rubric changes: `src/lib/rubric.ts`, `src/lib/rubricGuide.ts`, `dse-chinese-writing-rubric.md`, `DSE中文寫作評分.md`
- Weakness thresholds: `src/lib/weakness.ts`
- Submission UX: `src/components/SubmissionForm.tsx`, `src/components/CameraCaptureFlow.tsx`
- Feedback page sections: `src/app/submissions/[id]/page.tsx`
- Notebook UX: `src/components/NotebookWorkspace.tsx`, `src/components/NotebookQuickPanel.tsx`
- Database shape: `prisma/schema.prisma`

## Cautions for Future AI Agents

- Do not read or expose `.env.local` values.
- Preserve the existing Chinese coaching tone.
- Keep AI outputs schema-validated with Zod when possible.
- Keep character offsets compatible with JavaScript string indexing, as error annotations depend on them.
- The auth model is now Clerk-based. Do not revert to anonymous cookie-only users. The legacy cookie path is only kept for migrating old anonymous sessions.
- Role changes must update both `AppUser.role` in Postgres AND `publicMetadata.role` in Clerk — see `updateUserRoleAction` in `src/app/admin/actions.ts` for the correct pattern.
- Submission credits must be deducted and refunded through `src/lib/credits.ts` so balances and `CreditTransaction` stay consistent.
- Be careful with Prisma schema changes; update API routes and UI serializers together.
- Prefer small, local changes over broad rewrites because many flows are connected through submission, analysis, weakness, revision, model passage, and notebook data.
- The auth protection entrypoint is `src/proxy.ts`. Do not add a second competing `src/middleware.ts` unless the Next.js version/Clerk guidance is intentionally being changed.
