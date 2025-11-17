# JustoAI — Security & Compliance Whitepaper

**Status:** November 17, 2025
**Confidentiality:** Shared with enterprise customers, investors, compliance teams
**Audience:** CISO, legal, compliance, IT procurement

---

## Executive Summary

JustoAI foi **construído desde o início com segurança em primeiro lugar**. Nós:

- ✅ Conformidade total com **LGPD** (Lei Geral de Proteção de Dados) brasileira
- ✅ Segurança **enterprise-grade** com criptografia end-to-end
- ✅ Retenção de dados **sob controle do cliente** (zero compartilhamento)
- ✅ Auditoria completa de todas operações
- ✅ Disaster recovery e redundância multi-região
- ✅ Certificações de caminho (SOC 2, ISO 27001 em progresso)

**Nossa abordagem:** Zero-trust architecture com encriptação em trânsito e repouso.

---

## 1. Conformidade LGPD (Lei Geral de Proteção de Dados)

### 1.1 Obrigações LGPD

JustoAI atende **todos os requisitos** da LGPD para plataformas SaaS legais:

| Requisito | Como Implementamos |
|-----------|---|
| **Bases legítimas** | Contrato explícito + consentimento expresso do usuário |
| **Transparência** | Política privacidade detalhada + notificações claras |
| **Direito acesso** | API para exportar dados pessoais em 48h |
| **Direito exclusão** | Função "delete all" do usuário (excluir conta + dados) |
| **Direito retificação** | Edição completa de todos dados em app |
| **Portabilidade dados** | Export em formato padrão (JSON/CSV) |
| **Notificação breach** | Protocolo < 72 horas se incidente |
| **DPA obrigatório** | Contrato processamento dados com clientes |
| **DPIA** | Data Impact Assessment para processamento alto-risco |

### 1.2 Residência de Dados

```
Dados Armazenados:
- Primary: Supabase AWS sa-east-1 (São Paulo, Brasil) ✅
- Backup: Supabase AWS us-east-1 (Virgínia, USA) — criptografado
- Replicação: <24 horas para recuperação

Garantia: Zero dados deixam infraestrutura Brasil sem consentimento
```

### 1.3 Direitos dos Titulares

Todos os direitos LGPD implementados em dashboard:

- **Acesso:** Download completo em 48h
- **Exclusão:** Purga total em 30 dias
- **Retificação:** Edição em tempo real
- **Oposição:** Parar processamento
- **Portabilidade:** Export estruturado
- **Consentimento:** Gerenciar preferências

---

## 2. Criptografia & Encriptação

### 2.1 Encriptação em Trânsito (Transit)

```
Protocolo: TLS 1.3 (mais recente)
Cipher Suites:
  ✅ TLS_AES_256_GCM_SHA384 (256-bit)
  ✅ TLS_CHACHA20_POLY1305_SHA256 (256-bit)

Certificados:
  - Domain: *.justoai.com
  - Issuer: Let's Encrypt (renovação automática)
  - HSTS: Habilitado (força HTTPS)

Força: 256-bit AES-GCM (aceitável para aplicações legais/governamentais)
```

### 2.2 Encriptação em Repouso (Rest)

```
Banco de Dados:
  - Encryption: AWS KMS customer-managed keys
  - Key rotation: Automático (annual)
  - Algorithm: AES-256

Arquivos (Supabase Storage):
  - Encryption: S3 server-side (AES-256)
  - Access: Signed URLs com expiração 1h
  - Backup: Versioning habilitado

Backups:
  - Frequency: Diário
  - Retention: 30 dias
  - Encryption: Mesmo nível produção
```

### 2.3 Key Management

```
AWS KMS:
├─ Master Key (AWS managed) — nunca tocamos
├─ Data Key (rotação automática) — nosso acesso apenas
└─ Audit Log — CloudTrail para compliance

Segredo do App:
├─ API Keys: Armazenados em .env (produção)
├─ Clerk Secret: Supabase secrets (nunca em Git)
├─ JUDIT Token: Vault criptografado
└─ Stripe Key: Supabase secrets com audit

Rotation Policy: 90 dias para API keys, 180 para master keys
```

---

## 3. Autenticação & Autorização

### 3.1 Autenticação do Usuário

```
Método Primário: Clerk
├─ Email + Password (bcrypt SHA256)
├─ OAuth (Google, GitHub) — federated identity
├─ Multi-factor optional (TOTP, SMS)
└─ Session timeout: 7 dias

Backup: Supabase Auth
├─ JWT tokens (RS256 signed)
├─ Refresh tokens (httpOnly cookies)
├─ Token expiration: 1 hora
└─ Automatic renewal via refresh

Força: NIST 800-63B compliant
```

### 3.2 Autorização (RBAC)

```
Modelo: Role-Based Access Control (RBAC)

Roles Globais:
├─ SUPER_ADMIN — sistema inteiro
├─ ADMIN — gestão geral
└─ USER — padrão

Roles Workspace:
├─ OWNER — controle total workspace
├─ ADMIN — gerenciar usuários
├─ MEMBER — criar/editar casos
└─ VIEWER — read-only

Implementação:
├─ JWT claims: roles inclusos
├─ Middleware validation: Toda request
├─ Database RLS: Row-level security PostgreSQL
└─ Audit log: Todas mudanças de permissão
```

### 3.3 API Security

```
Autenticação API:
├─ Bearer token (JWT)
├─ Expiration: 24 horas
├─ Refresh automático
└─ Rate limit: 1,000 req/hora por key

CORS:
├─ Whitelist: domains conhecidos
├─ Methods: GET, POST, PATCH, DELETE
├─ Credentials: httpOnly, SameSite
└─ Preflight: Automático

CSRF Protection:
├─ SameSite cookies: Strict
├─ CSRF tokens: Formulários críticos
└─ Validation: Toda request state-change
```

---

## 4. Proteção contra Ataques Comuns

### 4.1 SQL Injection

```
Proteção: Prisma ORM
├─ Prepared statements: Tudo via Prisma
├─ Parameterized queries: Não há query string
└─ Input validation: Zod schemas

Exemplo Seguro:
const result = await db.case.findMany({
  where: { caseNumber: userInput } // Parameterized
})

Teste: Injection testing in QA, zero vulnerabilities
```

### 4.2 XSS (Cross-Site Scripting)

```
Proteção: React Auto-escaping
├─ JSX default escape: < > & " '
├─ No dangerouslySetInnerHTML: Policy block
└─ Content Security Policy (CSP): Habilitado

CSP Headers:
script-src 'self' https://trusted-cdn.com
object-src 'none'
base-uri 'self'
form-action 'self'
```

### 4.3 CSRF (Cross-Site Request Forgery)

```
Proteção: SameSite Cookies + CSRF Tokens
├─ SameSite: Strict (padrão)
├─ CSRF token: Toda form POST/PATCH
└─ Origin validation: Verifica headers

Exemplo:
<form method="POST">
  <input type="hidden" name="csrf" value={token} />
</form>
```

### 4.4 Brute Force

```
Proteção: Rate Limiting
├─ Login: 5 tentativas / 15 min
├─ API: 100 req / 1 min por IP
├─ Password reset: 1 tentativa / 1 hora
└─ Blocking: Suspensão automática 24h

Implementação: Middleware Redis-backed
```

### 4.5 DDoS

```
Proteção: Cloudflare + WAF
├─ Rate limiting global
├─ IP reputation filtering
├─ Bot detection (Challenge)
└─ Automatic scaling (Vercel)

SLA: 99.9% uptime durante normal operation
```

---

## 5. Gestão de Dados & Privacidade

### 5.1 Data Classification

```
Dados Armazenados:

Nível 1 (Altamente Sensível):
├─ Dados processos judiciais
├─ Decisões judiciais
├─ Partes (pessoas físicas)
└─ Tratamento: Criptografia, RLS, audit log completo

Nível 2 (Sensível):
├─ Metadados casos
├─ Email usuários
├─ Histórico login
└─ Tratamento: Criptografia, RLS, audit log

Nível 3 (Padrão):
├─ Nomes workflows
├─ Templates
├─ Configurações públicas
└─ Tratamento: Sem criptografia, acesso normal
```

### 5.2 Data Retention

```
Dados de Usuário:
├─ Ativo: Enquanto conta existe
├─ Após exclusão: 30 dias (conformidade LGPD)
└─ After 30d: Purga completa, zero recovery

Logs:
├─ Application logs: 90 dias (Sentry)
├─ Access logs: 180 dias (CloudTrail)
├─ Backup: 30 dias
└─ Deleted: Purga automática

Backup Schedule:
├─ Daily: Full backup S3
├─ Weekly: Encrypted archive
├─ Monthly: Offline cold storage
└─ Retention: 12 meses máximo
```

### 5.3 Third-Party Access

```
Serviços de Terceiros:

Google Gemini:
├─ Dados: Apenas texto documento (sem nomes)
├─ Retenção: 30 dias Google
├─ Encryption: AES-256
└─ DPA: Assinado

Supabase:
├─ Dados: PostgreSQL + storage
├─ Proprietário: Infraestrutura nossa
├─ RLS: Habilitado database-level
└─ DPA: Supabase ↔ JustoAI

JUDIT API:
├─ Dados: Apenas número processo
├─ Retenção: Conforme SLA
├─ Webhook: HMAC-SHA256 signed
└─ DPA: Assinado

Sentry:
├─ Dados: Stack traces apenas
├─ PII: Zero coleta automática
├─ Retenção: 30 dias
└─ DPA: Assinado

Slack Webhooks:
├─ Dados: Resumo alerta apenas
├─ PII: Zero dados pessoais
└─ Encryption: TLS 1.3

ZERO compartilhamento com outros serviços
```

---

## 6. Auditoria & Logging

### 6.1 Audit Trail

```
Tudo é Logado:
├─ Login/logout: Timestamp, IP, user agent
├─ Mudanças de dados: User, timestamp, before/after
├─ Acesso documento: User, file, timestamp
├─ Análise IA: User, inputs, modelo usado
├─ Exportações: User, data, format
├─ Permissões: User, role changes
└─ Deletions: User, data size, timestamp

Retenção: 2 anos conforme requisitos legais

Acesso: Apenas OWNER da workspace + ADMIN global
```

### 6.2 Logs Structure

```
Todos em formato estruturado:

{
  "timestamp": "2025-11-17T10:30:00Z",
  "user_id": "uuid",
  "workspace_id": "uuid",
  "action": "case.created",
  "resource": { "case_id": "xxx", "title": "..." },
  "ip_address": "xxx.xxx.xxx.xxx",
  "user_agent": "Mozilla/5.0...",
  "result": "success|error",
  "error_message": null,
  "duration_ms": 145
}
```

### 6.3 Monitoring & Alerting

```
Real-time Alerts:
├─ Erro rate > 1%: Alert eng team
├─ Response time > 1s (p95): Alert SRE
├─ Failed login > 10x: Alert security
├─ Large data export: Alert compliance
├─ Permission escalation: Immediate block
└─ Suspicious IP: Challenge + rate limit

Tools:
├─ Sentry: Error tracking
├─ CloudWatch: Logs + metrics
├─ PagerDuty: On-call escalation
└─ Slack: Notifications
```

---

## 7. Incident Response

### 7.1 Breach Response Plan

```
T=0: Detection
├─ Automated alert from Sentry/CloudWatch
├─ Manual report from user/team
└─ Investigation start

T<1h: Initial Response
├─ Quarantine affected systems
├─ Preserve logs/evidence
├─ Notify leadership + legal
└─ Begin forensics

T<24h: Analysis
├─ Determine scope (how many customers/records?)
├─ Identify root cause
├─ Assess data sensitivity
└─ Notification plan

T<72h: Customer Notification
├─ Email to affected customers
├─ Compliance@justoai.com notification
├─ Formal breach report
└─ Remediation steps

Post-Incident:
├─ Root cause analysis report
├─ Preventive measures implemented
├─ Security audit
└─ Policy updates
```

### 7.2 Communication

```
Notificação Breach (LGPD compliance):
├─ To: Affected data subjects (< 72h)
├─ Method: Email + account notification
├─ Content:
  - What happened
  - What data was affected
  - What we're doing
  - What they should do
  - Contact for questions

Example:
"On Nov 17, 2025, JustoAI experienced a security incident affecting
access logs for [X] customers. No case data, documents, or personal
information was compromised. We immediately:
1. Secured the affected system
2. Notified authorities
3. Implemented additional protections

Action required: None. We recommend changing passwords as precaution.
More info: security@justoai.com"
```

---

## 8. Compliance Roadmap

### 8.1 Atual Status

| Standard | Status | Timeline |
|----------|--------|----------|
| **LGPD** | ✅ Compliant | Contínuo |
| **GDPR** | ✅ Compliant (se EU data) | Contínuo |
| **SOC 2 Type II** | 🟡 Roadmap | Q2 2026 |
| **ISO 27001** | 🟡 Roadmap | Q3 2026 |
| **PCI DSS** | ⏳ Conditional (se payment) | Q1 2026 |
| **HIPAA** | ❌ Não aplicável | N/A |

### 8.2 Upcoming Audits

```
Q4 2025:
├─ Third-party pentest (Codeium/Deloitte)
├─ LGPD compliance audit
└─ Data security assessment

Q1 2026:
├─ PCI DSS review (se temos pagamento)
├─ Disaster recovery drill
└─ Incident response simulation

Q2 2026:
├─ SOC 2 Type II audit (24 meses observação)
└─ Customer security review meetings
```

---

## 9. Políticas & Procedimentos

### 9.1 Security Policy Highlights

```
Access Control:
├─ Principle of least privilege (POLP)
├─ MFA obrigatório para admin
├─ SSH key-based auth para servidores
└─ No shared credentials

Code Security:
├─ Code review obrigatório (2+ reviewers)
├─ Static analysis (ESLint + security plugins)
├─ Dependency scanning (Snyk/OWASP)
└─ No secrets in Git (.gitignore + git-secrets)

Infrastructure:
├─ Firewall rules (allow-list only)
├─ VPC isolationfor databases
├─ Encryption TLS 1.3 minimum
└─ Regular security patching

Incident Response:
├─ On-call rotation 24/7
├─ < 1h response time
├─ Forensics preserved
└─ Stakeholder notification < 72h
```

### 9.2 Employee Training

```
Mandatory:
├─ Security onboarding (all new hires)
├─ LGPD training (annual refresh)
├─ Phishing simulation (quarterly)
├─ Incident response drill (semi-annual)
└─ Code security workshop (annual)

Verification:
├─ Training completion tracking
├─ Phishing click rates < 10%
├─ Security quiz passing required
└─ Documentation in personnel files
```

---

## 10. Vendor Management

### 10.1 Third-Party Security

```
Due Diligence:
├─ Security questionnaire (pre-agreement)
├─ SLA requirements (uptime, response time)
├─ Data handling agreement (DPA)
├─ Insurance verification
└─ Annual re-assessment

Approved Vendors:
├─ Supabase: AWS-backed, SOC 2, security-first
├─ Vercel: Managed, edge functions, auto-scaling
├─ Stripe: PCI DSS compliant, payment processor
├─ Google Cloud: Enterprise security, SLA 99.95%
├─ Sentry: Data within EU/US, encrypted
└─ All others: Pre-approved + contract signed
```

### 10.2 Contract Requirements

```
DPA (Data Processing Agreement):
├─ Assinado com todos processadores
├─ Clauses: sub-processor rights, breach notification
├─ LGPD compliance: Article 5-17
└─ Right to audit: Anual third-party assessment

SLA Terms:
├─ Uptime: 99.9% minimum
├─ Response time: <24h for critical
├─ Security patch: <7 days
└─ Penalties: Service credits if not met
```

---

## Contact & Further Info

**Security Contact:** security@justoai.com
**Compliance Officer:** legal@justoai.com
**Response Time:** <24 horas para security inquiries

**Security Policy:** https://justoai.com/security
**Privacy Policy:** https://justoai.com/privacy
**DPA Template:** Available upon request

**Report Vulnerability:** security@justoai.com (please use GPG if available)

---

**JustoAI — Enterprise-grade security, from day 1.**

*Sua confiança é nossa responsabilidade. Segurança não é feature, é fundação.*
