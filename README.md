# AI 中文寫作導師 (AI Chinese Writing Coach)

Phase 1 MVP from the implementation plan: typed-text submission → rubric-anchored analysis → annotated feedback → weakness aggregation. Built as a Vercel-friendly Next.js full-stack app.

## Stack

- **Next.js 14 (App Router) + TypeScript + Tailwind**
- **Prisma + Postgres** (Vercel Postgres / Neon / Supabase — any works)
- **Anthropic Claude** for analysis (JSON-structured, rubric-anchored, tutor-voice)
- Cookie-based anonymous user (one row per browser) — swap in NextAuth when you're ready

## Scope vs. the plan

Included (Phase 0 + most of Phase 1):
- User model, rubric data, error taxonomy (字詞 / 語法 / 標點 / 結構 / 內容 / 表達)
- Submission pipeline (synchronous — no Celery required on Vercel)
- Analysis with evidence spans, strict JSON, tutor-voice prompt, "no rewrite" guardrail
- Annotated error view with severity highlighting
- Weakness aggregation: EWMA severity + watching → confirmed → improving → resolved state machine
- OCR-suspect field already present in schema + UI, so Phase 2 slots in cleanly

Deferred (extension points in place):
- OCR / handwriting (Phase 2) — `Submission.imageUrl`, `ocrCharConfidences`, `ErrorRecord.ocrSuspect` columns exist
- Revision Workspace (Phase 1 stretch) — `RevisionSession` model exists
- Reading practice (Phase 4)
- Real auth (currently anonymous cookie)

## Deploy to Vercel

### 1. Push this repo to GitHub

```bash
git add -A
git commit -m "Initial Chinese coach MVP"
git remote add origin git@github.com:YOU/chinese-coach.git
git push -u origin main
```

### 2. Provision a Postgres database

Pick one:
- **Vercel Postgres** — in the Vercel dashboard: Storage → Create → Postgres
- **Neon** — neon.tech, free tier, copy the pooled `DATABASE_URL`
- **Supabase** — supabase.com, settings → database → connection string (use pooler, port 6543)

Copy its `DATABASE_URL` (make sure it ends with `?sslmode=require`).

### 3. Import the repo in Vercel

- vercel.com → New Project → import your GitHub repo
- Framework preset: Next.js (auto-detected)
- **Environment Variables**:
  - `DATABASE_URL` — from step 2
  - `ANTHROPIC_API_KEY` — from https://console.anthropic.com/
  - (optional) `ANALYSIS_MODEL`, `COACH_MODEL`

### 4. Create the database schema

After the first deploy, run from your local machine **once**:

```bash
npm install
npx prisma db push          # uses DATABASE_URL from .env / shell
npm run db:seed             # optional — seeds rubric + 3 sample writing tasks
```

Or add a one-off deploy hook / run this from Vercel's CLI. `prisma generate` runs automatically on build via `postinstall` and the `build` script.

### 5. Visit your deployed URL

- `/` — dashboard with coach greeting + recent submissions
- `/submissions/new` — paste a Chinese essay, submit, wait ~30–60s
- `/submissions/[id]` — annotated feedback + rubric scores + priorities
- `/weaknesses` — evidence-based weakness report

## Local dev

```bash
cp .env.example .env
# fill in DATABASE_URL and ANTHROPIC_API_KEY
npm install
npx prisma db push
npm run db:seed
npm run dev
```

Open http://localhost:3000.

## Files you'll want to touch next

- `src/lib/rubric.ts` — add grade-specific rubrics (currently one generic 記敘文 rubric)
- `src/lib/analysis.ts` — prompt tuning, model routing
- `src/lib/weakness.ts` — aggregation thresholds (EWMA alpha, confirm counts)
- `prisma/schema.prisma` — already has the columns for OCR/revision/reading, wire UI when ready

## Cost notes

Each submission calls Claude once. With Opus 4.7 on a ~500-character essay, expect ~¥0.5–¥2 per analysis. For cost optimization, route short essays or revision feedback to `COACH_MODEL` (Haiku 4.5 by default).
