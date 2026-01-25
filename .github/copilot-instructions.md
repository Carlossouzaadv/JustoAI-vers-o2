## Quick orientation for AI coding agents working on JustoAI V2

This file contains short, actionable rules and examples so an AI coding agent can be productive immediately.

1. Big picture (one-liner)
   - Next.js 15 frontend + Node backend (Next API/Fastify patterns), Prisma + Supabase Postgres, Bull/BullMQ workers (Redis). Workers live in `src/workers` and job wiring uses `scripts/` helpers.

2. Developer workflows (commands you'll need)
   - Install & dev: `npm install` then `npm run dev` (frontend + API).
   - DB: `npm run db:generate`, `npm run db:migrate`, `npm run db:seed`, `npm run db:studio`.
   - Workers: `npm run worker:judit:dev` (dev), `npm run workers:start` / `workers:stop` for script-managed workers.
   - Build & checks: `npm run build`, `npm run lint`, `npm run type-check`, `npm run check:all` (runs type-check + lint + import checks).
   - Tests: `npm test` / `npm run test:watch` / `npm run test:ci`.

3. Project-specific conventions and constraints
   - Single Source of Truth: all shared utilities live under `src/lib/`. Import using the alias `@/lib/...` (never use `../../lib`). ESLint enforces this.
   - Type-safety mandate: `any`, unsafe `as` casts, and `@ts-ignore` are forbidden. Use Zod/type guards and narrowing. See `CLAUDE.md` for the explicit mandate.
   - Credit system: a mocked `creditService` returns 999 credits in development — real implementation needs Prisma wiring. File examples: `src/lib/services/creditService.ts` and `src/components/process/process-ai-analysis.tsx`.

4. Integration points to watch when editing code
   - JUDIT webhook flow: job queue → `juditOnboardingWorker` → webhook handler. Key files: `src/workers/juditOnboardingWorker.ts`, `src/lib/*webhook*`, and `src/app/api/*` handlers referenced in README.
   - Sentry: server and edge configs in `sentry.server.config.ts`, `sentry.edge.config.ts`, and client instrumentation in `src/instrumentation-client.ts`.
   - AI: Google Gemini usage is centralized; check `src/lib/` for wrappers and model selection (`.env` keys like `GOOGLE_API_KEY`, `TIMELINE_ENRICHMENT_MODEL`).

5. Small contract for changes an AI may make
   - Inputs: file path(s) changed, test(s) to run, environment context (dev vs prod).
   - Outputs: code edits, added tests (happy path + one edge), updated docs (one-line note in README or TODO.md), and verification steps run locally (type-check + lint + tests).
   - Error modes to avoid: breaking imports (use alias `@/lib`), introducing `any`/casts, forgetting to run `prisma generate` after schema changes.

6. How to add DB schema / migration changes
   - Edit `prisma/schema.prisma` then run:
     - `npm run db:generate`
     - `npm run db:migrate`
     - `npm run db:seed` (if seeding required)
   - After schema edits, update server code imports (`@/lib/prisma`) and ensure `prisma` client usage matches types.

7. Debugging recipe (quick)
   - Reproduce locally: `npm run dev` and open `http://localhost:3000`.
   - Start worker if the change touches background processing: `npm run worker:judit:dev`.
   - Check Sentry / Admin observability: dev UI at `/admin/observability` to see logged errors (or local Sentry config).
   - Run `npm run check:all` to catch type / lint / circular import issues.

8. Examples of patterns to mimic
   - Import correct way:
     - `import { prisma } from "@/lib/prisma";`
   - Webhook handler idempotency: look for idempotency metadata handling in webhook files and follow that pattern.

9. Files & docs worth checking when unsure
   - `README.md`, `CLAUDE.md`, `docs/CONFIGURATION_REFERENCE.md`, `TODO.md`, `src/lib/`, `src/workers/`, `prisma/`, and `scripts/`.

10. When to pause & ask a human
    - If a change requires new secrets or infra (Redis/Supabase/Gemini) that you cannot mock locally.
    - If a production behavior is ambiguous (billing, credits, legal consequences) — request explicit instructions.

If this looks good, I will commit this file. Tell me if you want shorter or more prescriptive guidance for any specific area (workers, Prisma, AI model usage, or webhook handlers).
