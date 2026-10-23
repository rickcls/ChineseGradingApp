// Applies prisma/migrations during Vercel production builds (vercel.json buildCommand).
// Preview and local builds are skipped unless --force is passed.
//
// The production database was first created with `prisma db push`, so it may have no
// migration history. `migrate deploy` then fails with P3005; in that case the migrations
// whose changes are already in the database are marked as applied (baselined) first.
// The migration history starts from an existing schema, so an empty database is created
// with `db push` instead and every migration is marked as applied.
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import path from "node:path";

const PRISMA = path.join("node_modules", ".bin", "prisma");
const SCHEMA = path.join("prisma", "schema.prisma");
const MIGRATIONS_DIR = path.join("prisma", "migrations");

// Migrations from before migration history was used; their changes were applied with `db push`.
const PRE_HISTORY_MIGRATIONS = ["20260428000000_role_credit_system", "20260429000000_unlimited_credits"];

// Fails unless the change made by the last pre-history migration is present.
const PRE_HISTORY_CHECK_SQL = `
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'AppUser' AND column_name = 'unlimitedCredits'
  ) THEN
    RAISE EXCEPTION 'AppUser.unlimitedCredits is missing';
  END IF;
END $$;
`;

const EMPTY_DATABASE_CHECK_SQL = `
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = current_schema()) THEN
    RAISE EXCEPTION 'The database is empty';
  END IF;
END $$;
`;

type Result = { status: number; output: string };

function prisma(args: string[], input?: string, quiet = false): Result {
  const run = spawnSync(PRISMA, args, { encoding: "utf8", input });
  const output = `${run.stdout ?? ""}${run.stderr ?? ""}`;
  if (output.trim() && !quiet) console.log(output.trimEnd());
  if (run.error) console.error(run.error.message);
  return { status: run.status ?? 1, output };
}

function migrationNames() {
  return readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function markApplied(names: string[]) {
  for (const name of names) {
    const result = prisma(["migrate", "resolve", "--applied", name, "--schema", SCHEMA]);
    // P3008: already recorded as applied (e.g. another build baselined it first).
    if (result.status !== 0 && !result.output.includes("P3008")) return false;
  }
  return true;
}

// 0: database matches the schema, 2: it differs, anything else: the diff failed.
function schemaDiff() {
  return prisma(["migrate", "diff", "--from-schema-datasource", SCHEMA, "--to-schema-datamodel", SCHEMA, "--exit-code"]).status;
}

function baseline() {
  console.log("[migrate] The database has no migration history (it was created with `prisma db push`). Baselining.");

  if (schemaDiff() === 0) {
    console.log("[migrate] The database already matches the schema; marking every migration as applied.");
    return markApplied(migrationNames());
  }

  if (prisma(["db", "execute", "--stdin", "--schema", SCHEMA], PRE_HISTORY_CHECK_SQL).status !== 0) {
    console.error(
      "[migrate] The database is older than the last pre-history migration (AppUser.unlimitedCredits is missing). " +
        "Baseline it by hand: https://pris.ly/d/migrate-baseline",
    );
    return false;
  }

  console.log(`[migrate] Marking ${PRE_HISTORY_MIGRATIONS.join(", ")} as applied.`);
  return markApplied(PRE_HISTORY_MIGRATIONS) && prisma(["migrate", "deploy", "--schema", SCHEMA]).status === 0;
}

function isEmptyDatabase() {
  return prisma(["db", "execute", "--stdin", "--schema", SCHEMA], EMPTY_DATABASE_CHECK_SQL, true).output.includes(
    "The database is empty",
  );
}

function createDatabase() {
  console.log("[migrate] The database is empty; creating it from prisma/schema.prisma.");
  return prisma(["db", "push", "--skip-generate", "--schema", SCHEMA]).status === 0 && markApplied(migrationNames());
}

function deployMigrations() {
  const deploy = prisma(["migrate", "deploy", "--schema", SCHEMA]);
  return deploy.status === 0 || (deploy.output.includes("P3005") && baseline());
}

function main() {
  const force = process.argv.includes("--force");
  if (process.env.VERCEL_ENV !== "production" && !force) {
    console.log(`[migrate] Skipping migrations (VERCEL_ENV=${process.env.VERCEL_ENV ?? "unset"}).`);
    return 0;
  }

  if (!(isEmptyDatabase() ? createDatabase() : deployMigrations())) {
    console.error("[migrate] Migrations failed; stopping the build so the current deployment stays live.");
    return 1;
  }

  const diff = schemaDiff();
  if (diff === 0) console.log("[migrate] The database matches prisma/schema.prisma.");
  else console.warn("[migrate] Warning: the database still differs from prisma/schema.prisma (see above).");
  return 0;
}

process.exit(main());
