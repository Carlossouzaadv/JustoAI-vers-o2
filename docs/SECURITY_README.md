# 🔐 Security Guidelines

Critical security practices for JustoAI V2 when deploying backend and workers on Railway.

---

## 🚨 NEVER Commit Secrets

### ❌ WRONG - Never Do This

```bash
# DO NOT commit .env files
git add .env
git add .env.local
git add .env.production

# DO NOT commit secrets files
git add config/secrets.json
git add src/secrets.ts

# DO NOT commit API keys in code
const API_KEY = "sk-1234567890"  // ❌ NEVER!
```

### ✅ CORRECT - Do This

```bash
# Use .env.example with placeholders
git add .env.example          # ✅ Template only

# Use .gitignore to prevent accidental commits
git add .gitignore

# Store actual secrets in Railway Dashboard only
# Or in local .env.local (never committed)
```

---

## 📝 .gitignore Configuration

Ensure your `.gitignore` contains these entries:

```gitignore
# Environment files - NEVER commit with real values
.env
.env.local
.env.development.local
.env.test.local
.env.production
.env.production.local
.env*.local
.env.*.local

# Secrets
.secrets
.secret
secrets/
config/secrets.json

# API Keys and sensitive files
*.key
*.pem
```

**Check if secrets are already committed:**

```bash
# Search for common patterns
git log --all -S "JUDIT_API_KEY=" --source --remotes
git log --all -S "rediss://" --source --remotes
git log --all -S "sk-" --source --remotes

# If found, see "Handling Accidental Commits" section below
```

---

## 🔑 Storing Secrets on Railway

### Never Use Config Files

```typescript
// ❌ WRONG
import secrets from '../secrets.json'
const apiKey = secrets.judit_api_key

// OR storing in code
const JUDIT_API_KEY = "sk-1234567890"
```

### ✅ Always Use Environment Variables

```typescript
// ✅ CORRECT
const apiKey = process.env.JUDIT_API_KEY

// With validation
if (!process.env.JUDIT_API_KEY) {
  throw new Error('JUDIT_API_KEY environment variable not set')
}
```

### Setting Secrets in Railway Dashboard

1. **Go to Railway Dashboard**:
   - https://railway.app/project/[your-project-id]

2. **Select your service** (web or workers)

3. **Click "Variables" tab**

4. **Add each secret**:
   ```
   JUDIT_API_KEY = your_actual_key_value
   GOOGLE_API_KEY = your_actual_key_value
   SMTP_PASSWORD = your_actual_password
   DATABASE_URL = postgresql://...
   ```

5. **Never expose these values** - Railway hides them in UI

6. **Deploy** - Railways injects variables at runtime

### Environment Variables Checklist

**For Web Service:**
- [ ] `DATABASE_URL` - PostgreSQL
- [ ] `DIRECT_URL` - Direct DB connection
- [ ] `NEXT_PUBLIC_SUPABASE_URL` - Public (OK to expose)
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Public (OK to expose)
- [ ] `REDIS_URL` - Private (keep secret!)
- [ ] `GOOGLE_API_KEY` - Private
- [ ] `SMTP_PASSWORD` - Private

**For Workers Service:**
- [ ] All of above PLUS:
- [ ] `JUDIT_API_KEY` - Private (⚠️ ONLY in workers!)

---

## 🛡️ API Key Segregation

### Separation by Service

**Web Service SHOULD NOT have:**
```bash
❌ JUDIT_API_KEY
❌ JUDIT_API_SECRET
```

**Workers Service SHOULD have:**
```bash
✅ JUDIT_API_KEY
✅ JUDIT_API_SECRET
```

**Both services CAN share:**
```bash
✅ DATABASE_URL
✅ REDIS_URL
✅ GOOGLE_API_KEY
```

### Why Separate?

- **Security**: If web service is compromised, JUDIT key is safe in workers
- **Cost Control**: Workers can be disabled without affecting API
- **Audit Trail**: Track JUDIT costs separately
- **Least Privilege**: Each service only gets keys it needs

---

## 🚨 Handling Accidental Commits

If you accidentally commit a secret:

### Step 1: Identify

```bash
# Find what was committed
git log --all -p | grep -i "api_key\|password\|secret"

# Find by commit
git show [commit-hash]
```

### Step 2: Immediate Action - Rotate Keys

```bash
# 1. Revoke the exposed key immediately!
# For JUDIT: https://api.judit.ai/dashboard
# For Google: https://console.cloud.google.com
# For Supabase: https://app.supabase.com
# For Resend: https://resend.com/api-keys

# 2. Generate new keys

# 3. Update in Railway Dashboard

# 4. Commit removal below
```

### Step 3: Remove from Git History

```bash
# Option A: Remove the file from all commits (recommended)
git filter-branch --tree-filter 'rm -f secrets.json' HEAD

# OR Option B: Use git-filter-repo (faster)
pip install git-filter-repo
git filter-repo --path secrets.json --invert-paths

# After filtering, force push (only if repo is private!)
git push origin --force-with-lease main
```

### Step 4: Verify Removal

```bash
# Confirm secrets no longer in history
git log --all --source -S "JUDIT_API_KEY" -- "*"
# Should return: nothing

# List all branches to check
git for-each-ref --format='%(refname:short)' refs/heads/
```

### Step 5: Notify Team

```
🚨 SECURITY INCIDENT - Accidental Commit

Exposed: [list what was exposed]
When: [date/time]
Action Taken:
  - Rotated all keys
  - Removed from git history
  - Updated Railway environment variables

All team members: Update your local copies:
  git fetch origin
  git reset --hard origin/main
```

---

## 🔍 Security Audit Checklist

Before deploying to production:

### Code Review
- [ ] No hardcoded API keys in code
- [ ] No `.env` files committed to git
- [ ] No `secrets.json` or similar in repository
- [ ] All config uses `process.env` variables
- [ ] Validation for required env vars

### Railway Configuration
- [ ] Both services have `NODE_ENV=production`
- [ ] `JUDIT_API_KEY` only in workers service
- [ ] All sensitive env vars set (not blank)
- [ ] `.gitignore` covers all secret files
- [ ] Dockerfile doesn't copy `.env*` files

### Access Control
- [ ] Only team members have Railway access
- [ ] 2FA enabled on Railway account
- [ ] Limited access to secrets
- [ ] Audit logs configured (if available)
- [ ] No sharing of API keys via Slack/email

### Monitoring
- [ ] Logs don't print secrets
- [ ] Error messages don't expose keys
- [ ] No secrets in database
- [ ] No secrets in Redis cache
- [ ] CloudFlare/CDN not caching sensitive responses

---

## 📚 Sensitive Files in Repository

These files should NEVER be committed:

```
.env
.env.local
.env.production
.env.*.local
.secrets
secrets.json
config/secrets.json
src/secrets.ts
src/config/keys.json
firebase-key.json
credentials.json
.credentials/
private_keys/
ssh_keys/
```

**Check if any exist uncommitted:**

```bash
git status | grep -E "(\.env|secrets|credentials|\.key|\.pem)"
```

---

## 🔐 Best Practices

### Local Development

```bash
# Create local .env.local
cp .env.example .env.local

# Edit with your local credentials
nano .env.local

# Make sure it's in .gitignore
echo ".env.local" >> .gitignore

# Never commit
git status  # Should NOT show .env.local
```

### Testing Secrets

```bash
# Check if .env.local exists in git
git ls-files | grep -E "\.env|secrets"
# Should return: nothing

# Check .gitignore coverage
git check-ignore -v .env.local
# Should return: .gitignore matches
```

### CI/CD Pipelines

```typescript
// ✅ CORRECT - Use environment variables
const apiKey = process.env.JUDIT_API_KEY
if (!apiKey) throw new Error('JUDIT_API_KEY not set')

// GitHub Actions - use secrets
// In .github/workflows/deploy.yml
env:
  JUDIT_API_KEY: ${{ secrets.JUDIT_API_KEY }}
  DATABASE_URL: ${{ secrets.DATABASE_URL }}
```

---

## 🚨 Security Incident Response

If you suspect a security breach:

### Immediate Actions (0-5 minutes)

1. **Rotate ALL exposed keys immediately**
2. **Update in Railway Dashboard**
3. **Commit `.gitignore` changes** to prevent future leaks
4. **Alert team members**

### Investigation (5-30 minutes)

5. **Search git history** for leaked credentials
6. **Check git logs** for who accessed them
7. **Review Railway logs** for suspicious activity
8. **Check Supabase logs** for unexpected queries

### Long-term (After 24 hours)

9. **Audit what was exposed**
10. **Review what damage could occur**
11. **Monitor for misuse** (unauthorized API calls, data access)
12. **Document incident** for compliance
13. **Update security procedures** to prevent recurrence

---

## 📞 Security Contacts

If you find a security vulnerability:

- **Email**: [Your security contact email]
- **PGP Key**: [If you have one]
- **Responsible Disclosure**: Please don't publish exploits publicly

---

## Links & Resources

- [OWASP: Secrets Management](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)
- [GitHub: Removing Sensitive Data](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository)
- [Railway: Environment Variables](https://docs.railway.app/guides/environment-variables)
- [Supabase: Security Best Practices](https://supabase.com/docs/guides/self-hosting/security/postgres-ssl)

---

**Last Updated**: 2025-10-16
**Status**: ✅ Production Ready
