# 🧠 Claude Code Development Guide for JustoAI V2

This document provides guidance for AI-assisted development on this project using Claude Code and similar tools.

---

## 📋 Project Context

**Project**: JustoAI V2 - Enterprise SaaS Platform for Legal Process Management with AI
**Tech Stack**: Next.js 15, React 19, TypeScript, Prisma, PostgreSQL, Redis, Railway, Vercel
**Status**: Production-ready with separate web and workers deployment on Railway
**Current Focus**: Infrastructure optimization and worker deployment

### Key Principles

- ✅ **Security First**: Never commit secrets, always use `.env.example` templates
- ✅ **Modular Architecture**: Workers separate from web service
- ✅ **Cost Optimization**: 96% JUDIT API cost reduction, auto-sleep workers
- ✅ **Observability**: Structured logging, metrics, dashboards
- ✅ **Resilience**: Retries, error handling, graceful degradation

---

## 🌿 Git Workflow & Branching Strategy

### Branch Types & Naming Convention

```
main                          # Production-ready code
├── infra/separate-workers   # Infrastructure improvements
├── feature/new-feature       # New features
├── fix/bug-description       # Bug fixes
├── docs/update-guide         # Documentation
└── refactor/module-name      # Refactoring
```

### Branch Rules

**DO:**
- ✅ Use descriptive branch names
- ✅ Create PRs before merging to main
- ✅ Reference issues in commit messages
- ✅ Keep branches focused and small

**DON'T:**
- ❌ Commit secrets or API keys
- ❌ Push directly to main
- ❌ Create branches from branches (always from main)
- ❌ Leave unfinished work on branches

---

## 📝 Commit Message Convention

### Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Code style (formatting, missing semicolons, etc)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `chore`: Build process, dependencies, tooling
- `infra`: Infrastructure changes (Railway, deployment)

### Scope

The scope should specify what part of the system is affected:

```
feat(workers): add JUDIT connection test
fix(redis): handle reconnection gracefully
docs(railway): add workers deployment guide
infra(docker): update railway dockerfile
```

### Subject Line

- ✅ Use imperative mood ("add feature", not "added feature")
- ✅ Don't capitalize first letter
- ✅ No period at the end
- ✅ Max 50 characters

### Body

```
- Include motivation for the change
- Explain what was changed and why
- Explain what side effects it has
- Link any related issues: Fixes #123
```

### Examples

**Good:**
```
feat(workers): add JUDIT onboarding worker with resilience

- Implement BullMQ-based job queue
- Add exponential backoff retries (30s, 60s, 120s)
- Include structured logging with context
- Add safety checks for missing JUDIT_API_KEY

Fixes #45
```

**Not Good:**
```
Updated stuff
Fixed things
Done
```

---

## 🔐 Secrets Management

### ⚠️ CRITICAL: Never Commit Secrets

**Files that MUST NEVER be committed:**
```
❌ .env
❌ .env.local
❌ .env.*.local
❌ .secrets
❌ config/secrets.json
❌ Any file with API keys
```

**What CAN be committed:**
```
✅ .env.example (template with placeholders)
✅ .env.production.example (template)
✅ .env.workers.example (template)
✅ .env.railway.example (template)
```

### Using `.env.example` Correctly

```bash
# Create local env from example
cp .env.example .env.local

# Edit with REAL values (locally only!)
nano .env.local

# Verify it's ignored
git status  # Should NOT show .env.local

# Keep example with placeholders
git add .env.example
```

### Storing Secrets

**Local Development:**
```bash
# All secrets in .env.local (NEVER committed)
DATABASE_URL=postgresql://user:pass@localhost/db
JUDIT_API_KEY=your_real_key_here
```

**Railway Production:**
```bash
# Via Railway Dashboard UI (NOT in code)
# 1. Railway → Project → Service → Variables
# 2. Add each secret manually
# 3. Railway injects at runtime
```

### If You Accidentally Commit Secrets

1. **IMMEDIATELY** revoke all exposed keys
2. Remove from git history: `git rm --cached .env.local`
3. Force push: `git push origin --force-with-lease`
4. Update `.gitignore` to prevent future leaks
5. Commit removal: `git commit -m "security: remove exposed .env.local"`

---

## 🚀 Development Workflows

### Workflow 1: Adding a New Feature

```bash
# 1. Create branch from main
git checkout main
git pull origin main
git checkout -b feature/my-feature-name

# 2. Make changes and commit
# - Make incremental commits
# - Use meaningful commit messages
# - Test locally

git add .
git commit -m "feat(module): add new functionality

- Added X feature
- Updated Y component
- Testing with Z"

# 3. Push and create PR
git push -u origin feature/my-feature-name

# 4. GitHub: Create PR with template
# - Title: "feat: add new functionality"
# - Description: See PR template below
# - Request reviewers

# 5. Address review feedback
# - Make commits for each feedback item
# - Don't force push (preserve history)

# 6. Merge (when approved)
# - Use "Squash and merge" for small features
# - Use "Create a merge commit" for complex features
```

### Workflow 2: Railway Infrastructure Changes

```bash
# 1. Create infra branch
git checkout -b infra/description

# 2. Make infrastructure files
# - Docker configs
# - Railway TOML templates
# - Deployment scripts
# - Documentation

# 3. Create focused commits
git commit -m "infra(railway): add workers deployment guide

- Created comprehensive deployment documentation
- Added step-by-step instructions for both services
- Included troubleshooting and cost optimization"

# 4. Push and create PR
git push -u origin infra/description

# 5. PR body must include:
# - What infrastructure changes
# - Why these changes
# - How to test/verify
# - Security considerations
# - Cost impact

# 6. After merge
git checkout main
git pull origin main
```

### Workflow 3: Documentation Updates

```bash
# 1. Create docs branch
git checkout -b docs/update-name

# 2. Edit documentation files
# - README.md
# - guides in docs/
# - CLAUDE.md

# 3. Commit with docs type
git commit -m "docs(deployment): update vercel setup guide

- Clarified environment variable requirements
- Added new troubleshooting section
- Updated cost projections"

# 4. Merge when ready
# - Docs changes can be merged without code review
# - But include good description in PR
```

### Workflow 4: Bug Fix

```bash
# 1. Create fix branch (reference issue number if exists)
git checkout -b fix/redis-reconnection-#45

# 2. Fix and test
# - Make changes
# - Test locally
# - Add tests if applicable

# 3. Commit fix
git commit -m "fix(redis): handle reconnection gracefully

Previous behavior: Redis connection failures crashed worker
New behavior: Automatic reconnection with exponential backoff

- Added retry logic with max attempts
- Improved error logging for debugging
- Added test coverage for edge cases

Fixes #45"

# 4. Push and create PR
git push -u origin fix/redis-reconnection-#45

# 5. PR description
# - What was broken
# - Root cause
# - Solution
# - How to verify fix works
# - Any breaking changes
```

---

## 📂 Modifying Files: What to Commit

### Infrastructure Setup (Current)

**When working on infra/separate-workers branch:**

```
DO commit:
✅ docs/railway_workers_setup.md
✅ docs/SECURITY_README.md
✅ deploy/railway_*.toml
✅ CHANGES_INFRA.md
✅ src/lib/redis.ts
✅ src/lib/services/juditService.ts
✅ src/lib/queue/juditQueue.ts
✅ src/workers/juditOnboardingWorker.ts
✅ Dockerfile.workers
✅ .env.workers.example
✅ scripts/test-judit-connection.ts
✅ package.json (when adding scripts)
✅ .gitignore (when adding ignores)

DON'T commit:
❌ .env.local
❌ .env
❌ .env.production
❌ Secrets files
❌ Generated files (.next, dist, build)
```

### Feature Development

**When working on feature/* or fix/* branches:**

```
DO commit:
✅ Source code (src/*)
✅ Tests
✅ Component files
✅ Configuration changes
✅ Documentation updates

DON'T commit:
❌ Node modules (use .gitignore)
❌ Build artifacts (use .gitignore)
❌ IDE settings (.vscode, .idea)
❌ OS files (.DS_Store, Thumbs.db)
❌ Environment files
❌ Temporary files
```

### Documentation

**When working on docs/* branches:**

```
DO commit:
✅ .md files
✅ .mdx files
✅ README updates
✅ Architecture diagrams
✅ Setup guides

DON'T commit:
❌ Generated docs
❌ API-generated files
```

---

## 🧪 Testing Before Commit

### Pre-Commit Checklist

```bash
# 1. Type checking
npm run type-check

# 2. Linting
npm run lint
npm run lint:fix  # Auto-fix issues

# 3. Tests (if applicable)
npm test

# 4. Build
npm run build

# 5. Security check
# - Verify no .env files staged
git status | grep -i "\.env"  # Should be empty

# 6. Commit
git add .
git commit -m "your message"
```

### Testing Infrastructure Changes

```bash
# For worker scripts
npm run worker:judit              # Run directly
npm run worker:judit:pm2          # PM2 version
npm run stress-test-judit         # Stress testing
npx tsx scripts/test-judit-connection.ts  # Connection test

# For Redis
npm run db:studio  # Check database

# For API
npm run dev        # Start dev server
curl http://localhost:3000/api/health
```

---

## 🗄️ Database & Prisma Commands

### ⚠️ CRITICAL: Environment Setup

Prisma requires **both** `DATABASE_URL` (with pgBouncer) and `DIRECT_URL` (without pgBouncer) in `.env.local`:

```env
# Connection pooling URL (pgBouncer) - for application queries
DATABASE_URL=postgresql://username:password@aws-1-xxx.pooler.supabase.com:6543/postgres?pgbouncer=true

# Direct PostgreSQL connection - for migrations (NO pgBouncer!)
DIRECT_URL=postgresql://username:password@db.xxx.supabase.co:5432/postgres
```

**⚠️ DO NOT swap these URLs - pgBouncer breaks migrations!**

### Running Prisma Commands with Dotenv

Since Prisma CLI doesn't auto-load `.env.local`, always use this pattern:

```bash
# CORRECT WAY - Load .env.local before running Prisma
node -e "require('dotenv').config({path: '.env.local'}); const { execSync } = require('child_process'); execSync('npx prisma <command>', { stdio: 'inherit' })"

# Examples:
node -e "require('dotenv').config({path: '.env.local'}); const { execSync } = require('child_process'); execSync('npx prisma migrate deploy', { stdio: 'inherit' })"
node -e "require('dotenv').config({path: '.env.local'}); const { execSync } = require('child_process'); execSync('npx prisma generate', { stdio: 'inherit' })"
node -e "require('dotenv').config({path: '.env.local'}); const { execSync } = require('child_process'); execSync('npx prisma db push --skip-generate', { stdio: 'inherit' })"
```

### Common Prisma Operations

```bash
# Generate Prisma Client after schema changes
node -e "require('dotenv').config({path: '.env.local'}); const { execSync } = require('child_process'); execSync('npx prisma generate', { stdio: 'inherit' })"

# Deploy pending migrations (production-safe)
node -e "require('dotenv').config({path: '.env.local'}); const { execSync } = require('child_process'); execSync('npx prisma migrate deploy', { stdio: 'inherit' })"

# Push schema changes directly (development only)
node -e "require('dotenv').config({path: '.env.local'}); const { execSync } = require('child_process'); execSync('npx prisma db push --skip-generate', { stdio: 'inherit' })"

# Check migration status
node -e "require('dotenv').config({path: '.env.local'}); const { execSync } = require('child_process'); execSync('npx prisma migrate status', { stdio: 'inherit' })"
```

### Database Operations via Prisma Client (Node.js)

For operations that need actual code (like checking columns), use Prisma Client directly:

```javascript
// In a Node.js script or browser console
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkColumn() {
  try {
    // Check if column exists
    const result = await prisma.$queryRaw`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'case_documents'
      AND column_name = 'isDuplicate'
    `;

    if (result.length > 0) {
      console.log('✅ Column exists');
    } else {
      console.log('❌ Column missing, adding...');
      await prisma.$executeRaw`
        ALTER TABLE "case_documents"
        ADD COLUMN "isDuplicate" BOOLEAN NOT NULL DEFAULT false
      `;
    }
  } finally {
    await prisma.$disconnect();
  }
}

checkColumn();
```

### Troubleshooting Prisma Issues

| Issue | Solution |
|-------|----------|
| `Environment variable not found: DIRECT_URL` | Use the `node -e dotenv` pattern above |
| `P3005: The database schema is not empty` | Use `npx prisma migrate reset` (dev only) or `npx prisma db push` |
| `P2022: The column X does not exist` | Check if migration was applied. Use Prisma Client query above to verify |
| `prepared statement does not exist` | Using pgBouncer URL in DIRECT_URL. Swap URLs - pgBouncer goes in DATABASE_URL |
| Prisma Client out of date | Run `npx prisma generate` after schema changes |

---

## 🔀 Syncing Branches

### Keep Branch Up-to-Date with Main

```bash
# Option 1: Rebase (cleaner history)
git fetch origin
git rebase origin/main

# If conflicts:
# 1. Fix files
# 2. git add .
# 3. git rebase --continue

# Option 2: Merge (preserves history)
git fetch origin
git merge origin/main
```

### Handling Merge Conflicts

```bash
# When conflicts occur
git status  # Shows conflicted files

# Edit files to resolve conflicts
# Look for markers:
# <<<<<<< HEAD
# your changes
# =======
# incoming changes
# >>>>>>> origin/main

# After resolving:
git add .
git commit -m "resolve: merge conflicts from main"
git push origin branch-name
```

---

## 🧙 AI Assistant Guidelines

### When to Use Claude Code

**Good Use Cases:**
- ✅ Infrastructure configuration (Docker, Railway, deployment)
- ✅ Test script generation
- ✅ Documentation creation
- ✅ Code refactoring with clear scope
- ✅ Bug fixes with reproduction steps
- ✅ Performance optimization
- ✅ Security reviews

**Caution Areas:**
- ⚠️ Database schema changes (verify migrations)
- ⚠️ API contract changes (check dependents)
- ⚠️ Security-sensitive code (manual review required)
- ⚠️ Performance-critical paths (benchmark before/after)

### Providing Context

When asking for help, include:

1. **What you want to do**
   ```
   "Add JUDIT connection test script"
   ```

2. **Current situation**
   ```
   "We have src/lib/services/juditService.ts with testConnection() method"
   ```

3. **Expected behavior**
   ```
   "Script should check if JUDIT_API_KEY is set, only run if configured"
   ```

4. **Constraints**
   ```
   "No API calls if key is missing (safe mode)"
   ```

5. **Relevant files** (if not obvious)
   ```
   "Similar to scripts/stress-test-judit.ts"
   ```

### Review Generated Code

Always review AI-generated code before committing:

```bash
# Check what changed
git diff

# Verify:
# - No secrets in code
# - Proper error handling
# - Consistent with codebase style
# - Has comments for complex logic
# - Follows project conventions

# Test locally
npm run lint
npm run type-check
npm test
```

### Commit Attribution

When committing AI-assisted code:

```bash
git commit -m "feat(workers): add connection test script

- Validates JUDIT API connectivity
- Safe mode: only runs if JUDIT_API_KEY configured
- Includes troubleshooting output

🧠 Generated with Claude Code"
```

---

## 📚 Key Files & Their Purpose

### Configuration

| File | Purpose |
|------|---------|
| `.env.example` | Template for environment variables |
| `.env.railway.example` | Railway-specific env template |
| `.env.workers.example` | Workers-specific env template |
| `.gitignore` | Files to exclude from git |
| `package.json` | Dependencies and scripts |
| `tsconfig.json` | TypeScript configuration |
| `prisma/schema.prisma` | Database schema |

### Infrastructure

| File | Purpose |
|------|---------|
| `Dockerfile.railway` | Web service container |
| `Dockerfile.workers` | Workers service container |
| `deploy/railway_web.toml` | Web service configuration reference |
| `deploy/railway_workers.toml` | Workers configuration reference |
| `vercel.json` | Vercel deployment config |

### Documentation

| File | Purpose |
|------|---------|
| `README.md` | Project overview and quick start |
| `CLAUDE.md` | This file - AI development guidelines |
| `CHANGES_INFRA.md` | Infrastructure changes summary |
| `docs/railway_workers_setup.md` | Complete workers deployment guide |
| `docs/SECURITY_README.md` | Security best practices |

### Source Code Structure

```
src/
├── app/                    # Next.js app router
├── components/             # React components
├── lib/                    # Business logic
│   ├── redis.ts           # Redis client
│   ├── services/          # External service integrations
│   ├── queue/             # Job queue setup
│   └── observability/     # Logging, metrics, alerts
├── config/                # Configuration
└── workers/               # Background workers
```

---

## ⏱️ Typical Workflow Timeline

### 30 minutes

```bash
# Quick fix or small docs update
git checkout -b fix/small-issue
# Make 1-2 changes
git add .
git commit -m "fix(scope): description"
git push -u origin fix/small-issue
# Create PR and merge
```

### 2-3 hours

```bash
# Feature or infrastructure change
git checkout -b feature/name
# Make changes across multiple files
# Multiple commits with different concerns
git push -u origin feature/name
# PR review, address feedback
# Merge when approved
```

### 1+ day

```bash
# Major refactor or new subsystem
git checkout -b refactor/subsystem
# Work on branch for multiple days
# Regular pushes to keep backup
git push origin refactor/subsystem
# PR with comprehensive description
# Code review and adjustments
# Final merge to main
```

---

## 🔍 Common Commands Cheat Sheet

```bash
# Branching
git checkout -b feature/name        # Create new branch
git checkout main                   # Switch branch
git branch -d feature/name          # Delete local branch
git push origin --delete feature/name  # Delete remote branch

# Committing
git status                          # See changes
git add .                          # Stage all changes
git add file.ts                    # Stage specific file
git commit -m "message"            # Commit
git push origin feature/name       # Push to remote

# Pulling & Syncing
git pull origin main               # Pull latest main
git fetch origin                   # Fetch updates
git rebase origin/main             # Rebase on main
git merge origin/main              # Merge main into current

# History & Viewing
git log --oneline -10              # Recent commits
git diff                           # Changes not staged
git diff --staged                  # Staged changes
git show commit-hash               # View specific commit

# Undoing Changes
git restore file.ts                # Discard changes
git reset HEAD file.ts             # Unstage file
git revert commit-hash             # Create undo commit
```

---

## 🤝 Collaboration

### Code Review Process

1. **Before Requesting Review**
   - ✅ Ensure all tests pass
   - ✅ Self-review your code
   - ✅ Verify no secrets in commits
   - ✅ Write clear PR description

2. **During Review**
   - ✅ Respond to all comments
   - ✅ Make requested changes
   - ✅ Add comments explaining decisions
   - ✅ Don't force push after review started

3. **After Approval**
   - ✅ Address any final comments
   - ✅ Merge when ready
   - ✅ Clean up branch

### Communication

- **PRs**: Detailed technical information
- **Commits**: What changed and why
- **Comments**: Explain complex logic
- **Issues**: Reproducible steps and context

---

## 🎯 Best Practices Summary

✅ **DO:**
- Small, focused commits
- Descriptive branch names
- Clear commit messages
- Security-first thinking
- Regular git status checks
- Test before committing
- Document decisions
- Use conventional commits

❌ **DON'T:**
- Commit secrets
- Large blob commits
- Vague messages ("fix stuff")
- Push directly to main
- Leave work uncommitted
- Force push without reason
- Ignore linting errors
- Break main branch

---

**Last Updated**: 2025-10-16
**Version**: 1.0
**Status**: Active - Follow these guidelines for all contributions
- Este projeto está live. Não usamos mais mocks ou workarounds. Temos que resolver os problemas que aparecem.