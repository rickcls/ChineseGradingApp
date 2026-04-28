# AI Project Context: Chinese Grading Webpage

This file is written for future AI agents and developers. It summarizes the current state of the project, what has already been built, and where the important code lives.

## Product Summary

This is an AI Chinese writing coach for Hong Kong students. Students can submit Chinese writing by typing, uploading photos, or uploading scans/PDFs. The app extracts text when needed, analyzes the writing against an HKDSE-style rubric, gives warm tutor-style feedback, highlights evidence spans, tracks recurring weaknesses, supports revision comparison, generates an AI reference passage, and lets students save useful phrases or lessons into a notebook.

The UI language is mostly Traditional Chinese, with a supportive coaching tone rather than a cold grading tone.

## Tech Stack

- Framework: Next.js 14 App Router
- Language: TypeScript
- UI: React 18, Tailwind CSS
- Database: PostgreSQL through Prisma
- ORM: Prisma Client
- Validation: Zod
- AI providers:
  - OpenRouter for most text and vision calls
  - Anthropic direct fallback path is also implemented
- OCR / document intake:
  - Vision model OCR for images
  - `pdfjs-dist` on the client to convert uploaded PDFs into page images before OCR
- Deployment target: Vercel-friendly full-stack Next.js app

## Important Commands

- `npm run dev`: start local Next.js dev server
- `npm run build`: run `prisma generate` and `next build`
- `npm run start`: start production server
- `npm run lint`: run Next lint
- `npm run db:push`: push Prisma schema to the database
- `npm run db:seed`: seed rubric/tasks from `prisma/seed.ts`

The `postinstall` script runs Prisma generation and copies PDF.js assets into `public/`.

## Environment Variables

Do not hard-code secrets. Expected environment variables include:

- `DATABASE_URL`: PostgreSQL connection string
- `OPENROUTER_API_KEY`: primary AI API key
- `ANTHROPIC_API_KEY`: optional direct Anthropic fallback
- `OPENROUTER_HTTP_REFERER`: optional OpenRouter metadata
- `OPENROUTER_APP_NAME`: optional OpenRouter metadata
- `ANALYSIS_MODEL`: optional analysis model override
- `ANALYSIS_FALLBACK_MODEL`: optional analysis fallback override
- `COACH_MODEL`: currently defined in AI config for coaching defaults
- `OCR_MODEL`: optional OCR model override
- `OCR_FALLBACK_MODEL`: optional OCR fallback override
- `MODEL_PASSAGE_MODEL`: optional reference passage model override
- `MODEL_PASSAGE_FALLBACK_MODEL`: optional reference passage fallback override
- `NOTEBOOK_NOTE_FALLBACK_MODEL`: optional fallback for AI-generated notebook notes
- `ANALYSIS_OPENROUTER_TIMEOUT_MS`, `OCR_OPENROUTER_TIMEOUT_MS`, `MODEL_PASSAGE_TIMEOUT_MS`, `MODEL_PASSAGE_REPAIR_TIMEOUT_MS`, `NOTEBOOK_NOTE_TIMEOUT_MS`: optional timeout tuning

## Authentication Model

The app currently uses anonymous cookie-based users, not a full login system.

- Middleware creates a `ccoach_uid` cookie if missing.
- `src/lib/auth.ts` reads that cookie and creates/fetches a `User` row.
- Default user display name is `同學`.
- Default grade level is `S2`.

Files:

- `src/middleware.ts`
- `src/lib/auth.ts`

## Data Model

Main Prisma models in `prisma/schema.prisma`:

- `User`: anonymous or future authenticated student identity
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

Status/state enums already exist for submissions, weakness profiles, notebook entry types, etc.

## Main Pages

- `/`: dashboard with greeting, recent submissions, average score, revision count, confirmed/improving weaknesses
- `/submissions/new`: submission form with typed, photo, and scan modes
- `/submissions/[id]`: full feedback page with scores, DSE level, strengths, priorities, annotations, revision workbench, model passage panel, and notebook quick save
- `/submissions/[id]/compare`: revision comparison view
- `/weaknesses`: ability map and recurring weakness report
- `/notebook`: notebook workspace for saved phrases/lessons/manual entries

Supporting UI components are in `src/components/`.

## Submission and Analysis Flow

Primary route: `src/app/api/submissions/route.ts`

1. Client posts text, grade level, optional task prompt, optional genre, and source.
2. Server validates input with Zod.
3. Server gets or creates the anonymous user.
4. A `Submission` is created with `verifiedText`.
5. `analyzeSubmission()` runs the AI rubric analysis.
6. An `Analysis` row is created.
7. AI error spans become `ErrorRecord` rows.
8. Submission status becomes `analyzed`.
9. `updateWeaknessProfiles()` updates long-term weakness state.
10. API returns the submission ID.

If analysis fails after submission creation, the submission is marked `failed`.

Important files:

- `src/components/SubmissionForm.tsx`
- `src/app/api/submissions/route.ts`
- `src/lib/analysis.ts`
- `src/lib/weakness.ts`

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
- Uses status machine:
  - `watching`
  - `confirmed`
  - `improving`
  - `resolved`

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
- Current note template is intentionally organized as `【學習重點】`, `【原文觀察】`, `【下次做法】`, `【示範句】`, and `【檢查清單】`

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

- Anonymous student session creation
- Dashboard with recent submissions and progress metrics
- Typed writing submission
- Photo/scan/PDF-to-OCR submission path
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

- No real authentication yet; anonymous cookie users only.
- Submission analysis is synchronous inside the API route. Long model calls can still hit hosting limits.
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
- Avoid replacing the anonymous user flow unless the task explicitly asks for real auth.
- Be careful with Prisma schema changes; update API routes and UI serializers together.
- Prefer small, local changes over broad rewrites because many flows are connected through submission, analysis, weakness, revision, model passage, and notebook data.
