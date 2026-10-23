# AI 中文寫作導師 (AI Chinese Writing Coach)

Phase 1 MVP from the implementation plan: typed-text submission → rubric-anchored analysis → annotated feedback → weakness aggregation. Built as a Vercel-friendly Next.js full-stack app.

## Stack

- **Next.js 14 (App Router) + TypeScript + Tailwind**
- **Prisma + Postgres** (Vercel Postgres / Neon / Supabase — any works)
- **OpenRouter** (recommended) or Anthropic direct for analysis
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
  - `OPENROUTER_API_KEY` — from https://openrouter.ai/keys
  - (optional) `OPENROUTER_HTTP_REFERER`, `OPENROUTER_APP_NAME`
  - (optional fallback) `ANTHROPIC_API_KEY` — from https://console.anthropic.com/
  - (optional) `ANALYSIS_MODEL`, `COACH_MODEL`

Recommended low-cost defaults:
- `ANALYSIS_MODEL=google/gemini-2.5-flash`
- `COACH_MODEL=anthropic/claude-3.5-haiku`

### 4. Database schema (automatic)

Every **production** deploy runs `scripts/migrate-deploy.ts` before `next build` (see `buildCommand` in `vercel.json`); preview deploys skip it. The script:

- applies pending migrations in `prisma/migrations` with `prisma migrate deploy`;
- creates an empty database straight from `prisma/schema.prisma` (`db push`) and records every migration as applied;
- baselines a database first created with `prisma db push` (error P3005): migrations whose changes are already there are marked as applied, then the rest are applied.

If it fails, the build stops and the previous deployment stays live; the build log says why. Schema changes therefore need a migration folder in `prisma/migrations`, not just `db push`. If `DATABASE_URL` goes through a transaction pooler (e.g. Supabase port 6543 / pgbouncer), migrations need a direct connection: add `directUrl = env("DIRECT_URL")` to the datasource and set `DIRECT_URL`.

To run it by hand against the database in your shell: `node --import tsx scripts/migrate-deploy.ts --force`. Optional sample data: `npm run db:seed` (seeds rubric + 3 sample writing tasks).

### 5. Visit your deployed URL

- `/` — dashboard with coach greeting + recent submissions
- `/submissions/new` — paste a Chinese essay, submit, wait ~30–60s
- `/submissions/[id]` — annotated feedback + rubric scores + priorities
- `/weaknesses` — evidence-based weakness report

## Local dev

```bash
cp .env.example .env
# fill in DATABASE_URL and OPENROUTER_API_KEY
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

Each submission calls one LLM request. Cost depends on your OpenRouter model choice and token usage. The default setup uses `google/gemini-2.5-flash` for analysis and `anthropic/claude-3.5-haiku` for coaching as a lower-cost balance.
