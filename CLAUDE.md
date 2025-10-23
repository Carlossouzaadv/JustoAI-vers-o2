# Claude Code Development Guide for JustoAI V2

This document provides guidance for AI-assisted development on this project using Claude Code and similar tools.

---

### Key Principles
- **Security First**: Never commit secrets, always use `.env.example` templates
- **Modular Architecture**: Workers separate from web service
- **Observability**: Structured logging, metrics, dashboards
- **Resilience**: Retries, error handling, graceful degradation
- **Este projeto está live.** Não usamos mais mocks ou workarounds. Temos que resolver os problemas que aparecem.
- **CRITICAL: Never Commit Secrets**

---

### The Core Architecture
* This project is a full-stack **Legal Tech SaaS (JustoAI v2)** built in a **Turborepo monorepo** using TypeScript.
* **Frontend (`apps/web`):** **Next.js 14 (App Router)** single-page app with React 18 and **Tailwind CSS**.
* **Backend (`apps/server`):** **Fastify** (Node.js) REST/RPC API.
* **Database:** **PostgreSQL** (hosted on **Supabase**) using **Drizzle ORM**. Tables include `users`, `projects`, `documents`, `rpeas`, `chatHistories`, `financial`, and `tasks`. (SQLite is NOT used).
* **Authentication:** Handled by **Clerk** (integrated directly with the Next.js frontend).
* **AI Integrations:** The backend (`apps/server`) integrates with **Google Gemini** APIs.
* **Communication:** Frontend calls the backend Fastify API. Shared logic/types are managed via Turborepo workspaces.
* **Design Pattern:** Backend utilizes a service-oriented/controller pattern (typical of Fastify); Frontend uses React functional components and hooks.

---

### Git Workflow & Branching Strategy
**Commit Message Convention:** Use conventional commits (e.g., `feat: `, `fix: `, `docs: ` prefixes). Keep message concise (one line summary, optional details after).

---

### Error Handling & Debugging
* **Diagnose, Don’t Guess:** When encountering a bug or failing test, first explain possible causes step-by-step: Check assumptions, inputs, and relevant code paths.
* **Graceful Handling:** Code should handle errors gracefully. For example, use try/catch around async calls, and return user-friendly error messages or fallback values when appropriate.
* **Logging:** Include helpful console logs or error logs for critical failures (but avoid log spam in production code).
* **No Silent Failures:** Do not swallow exceptions silently. Always surface errors either by throwing or logging them.

---

### Clean Code Guidelines
* **Function Size:** Aim for functions ≤ 50 lines. If a function is doing too much, break it into smaller helper functions.
* **Single Responsibility:** Each function/module should have one clear purpose. Don’t lump unrelated logic together.
* **Naming:** Use descriptive names. Avoid generic names like `tmp`, `data`, `handleStuff`. For example, prefer `calculateInvoiceTotal` over `doCalc`.
* **DRY Principle:** Do not duplicate code. If similar logic exists in two places, refactor into a shared function (or clarify why both need their own implementation).
* **Comments:** Explain non-obvious logic, but don’t over-comment self-explanatory code. Remove any leftover debug or commented-out code.

---

### Security Guidelines
* **Input Validation:** Validate all inputs (especially from users or external APIs). Never trust user input – e.g., check for valid email format, string length limits, etc.
* **Authentication:** Handled by **Clerk**. Avoid implementing manual password/session logic.
* **Database Safety:** Use the **Drizzle ORM** to prevent SQL injection. Do not concatenate user input in raw SQL queries.
* **XSS & CSRF:** React/Next.js provide default protection against XSS. Sanitize any HTML or user-generated content before rendering if necessary (e.g., DOMPurify).
* **Dependencies:** Be cautious of eval or executing dynamic code. Avoid introducing packages with known vulnerabilities (Claude should prefer built-in solutions if external libs are risky).

---

### Edge Case Considerations
* **Always consider edge and corner cases for any logic:**
Empty or null inputs (e.g., an empty list, missing fields, zero values).
Max/min values and overflow (e.g., extremely large numbers, very long text).
Invalid states (e.g., end date before start date, negative quantities).
Concurrency issues (e.g., two users editing the same data simultaneously).
**If an edge case is identified, handle it in code or at least flag it with a comment/TODO.**
**Prefer to fail fast on bad input (throw an error or return a safe default) rather than proceeding with wrong assumptions.**

---

### Workflow & Planning Guidelines
* **For any complex or multi-step task,** Claude should first output a clear plan or outline of the approach (E.g., list the steps or modules needed).
* **Incremental Development:** Implement in logical chunks. After each chunk, verify it aligns with the plan and passes tests before moving on.
* **Think Aloud:** Use extended reasoning (“think harder or ultrathink”) for complex decisions. It’s okay to spend more tokens to ensure a solid approach rather than rushing coding.
* **User Approval:** Pause for confirmation after providing a plan or major design decision. Only proceed once the user/developer confirms.
* **Error Recovery:** If a solution isn’t working, Claude should backtrack and rethink rather than stubbornly persisting. Consider alternative approaches if tests fail or constraints are hit.
* **If I say ‘pense’, enter Plan Mode.**
* **Don't write 500-line components (break them up!)**