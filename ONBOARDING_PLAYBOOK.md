# Customer Onboarding Playbook — JustoAI

**Goal:** New customer → productive user in 7 days
**Success Metric:** 70%+ adoption of core features, NPS >50

---

## Day 1: Welcome & First Impression

### Email: Welcome (T=0, upon signup)

```
Subject: Bem-vindo ao JustoAI! 👋 Sua conta está pronta

Oi [Nome],

Parabéns! Sua assinatura do JustoAI foi ativada.

✅ Plano: [Professional]
✅ Usuários: [5]
✅ Créditos: [40/mês]
✅ Trial: 30 dias (sem cobro)

Próximos passos:
1. Assista vídeo (3 min): https://...
2. Faça login: https://app.justoai.com
3. Clique "Novo Caso"
4. Siga as instruções (2 minutos)

Precisa de ajuda? Clique abaixo para agendar call.

Abraço,
Time JustoAI
```

### First Login Experience

```
Landing screen após login:
├─ Hero: "Bem-vindo! Vamos começar em 2 minutos"
├─ Step 1: Upload a case (drag-drop ou select)
├─ Step 2: Watch as AI analyzes (animated)
├─ Step 3: See results (FASE 1 + 2)
└─ CTA: "Criar meu primeiro caso"

Onboarding UI:
├─ Progress bar (shows "Step 1 of 5")
├─ Helpful hints ("Clique aqui para...")
├─ Skip option ("Já conheço o sistema")
└─ Help button ("Preciso de ajuda")
```

---

## Day 2: First Success (T=24h)

### 1:1 Onboarding Call (15 min, scheduled)

**Participant:** New customer + Customer success manager

**Agenda:**
```
(0–2 min): Welcome
├─ "Oi [Name], como foi sua primeira experiência?"
└─ "Você conseguiu fazer login?"

(2–5 min): Case walkthrough
├─ "Você já enviou um caso?"
├─ If not: "Deixa eu ajudar"
├─ If yes: "Qual foi o resultado?"
└─ Show JUDIT enrichment, timeline

(5–10 min): Feature demo
├─ Show FASE 3 analysis
├─ Explain créditos
├─ Quick look at reporting
└─ Q&A

(10–15 min): Action items
├─ "Upload seu próximo caso essa semana"
├─ "Experimente a análise FULL"
├─ "Temos um webinar na quarta (link)"
└─ Confirm: "Tudo claro?"
```

**Call Prep (before):**
- Check: Customer uploaded a case? (if not, debug)
- Prepare: 1–2 specific examples for their case type
- Send: Link to Zoom + agenda

**Follow-up (after call):**
```
Email: "Ótimo conhecer você!"

Hi [Name],

Obrigado pela conversa hoje! Adorei entender mais sobre
seus casos.

Aqui estão os links que mencionei:
├─ Setup doc: https://...
├─ Video: FASE 3 explained
├─ Webinar essa semana: [link]
└─ Agende outro chat: [calendly]

Sucesso com os próximos casos!

[CS Manager]
```

---

## Day 3–5: Exploration (T=48–120h)

### Email: "Dica do dia" (sequence)

**Day 3:** "Como usar Timeline merge"
**Day 4:** "Generating seu primeiro relatório"
**Day 5:** "Convidando seu team"

```
Each email:
├─ Subject: Creative ("Você sabe que pode...?")
├─ Body: 1 feature + 1 screenshot
├─ CTA: Try it in app
├─ Duration: 2 min read
└─ Personalized: Mention their use case
```

### In-app Guidance

```
Smart prompts (contextual):
├─ After uploading doc: "Agora clique em 'Análise FULL'"
├─ After FULL analysis: "Quer gerar um relatório?"
├─ After 3 casos: "Convide seu colega"
└─ After 7 dias: "Como está sendo?"

Progress tracking:
├─ Dashboard badge: "75% setup complete"
├─ Checklist: ✓ Upload case, ✓ Run FULL, ✓ View timeline, etc
└─ Unlock feature: Reporting only after 2 successful cases
```

### Slack Notification (opt-in)

```
"[Name] enviou seu 1º caso! 🎉"
"[Name] rodou FULL analysis"
"[Name] gerou seu 1º relatório"

Helps: Customer sees activity, feels progress
```

---

## Week 1 Check-in: Day 7 (T=7 days)

### Email: "How is it going?"

```
Subject: Como está sendo?

Hi [Name],

Já se passou uma semana! Gostaria de saber:

✓ Você conseguiu usar a plataforma?
✓ Quais features você mais gostou?
✓ Encontrou alguma dificuldade?

Seu feedback é super importante para a gente.

Responda esse email ou clique aqui: [survey link]

Também temos um grupo de usuários no Slack
onde você pode compartilhar dúvidas.

Abraço,
[CS Manager]
```

### Success Metrics to Check

```
At Day 7, customer should have:
├─ ✓ Created 1+ cases
├─ ✓ Run 1+ FULL analysis (or FAST)
├─ ✓ Seen JUDIT integration work
├─ ✓ Generated 1 report (optional)
├─ ✓ Invited ≥1 team member (if Professional+)
└─ ✓ Attended kickoff call

If missing any: Personal outreach to unblock
```

### Churn Risk Assessment

```
🟢 Low risk (Green):
├─ Used >3x in week 1
├─ Invited team members
├─ Positive NPS signal
└─ Action: Nurture

🟡 Medium risk (Yellow):
├─ Used 1-2x
├─ No team invites yet
├─ Neutral feedback
└─ Action: Personal outreach call

🔴 High risk (Red):
├─ Zero usage after day 1
├─ Negative feedback ("too complex")
├─ Didn't attend onboarding call
└─ Action: Immediate intervention
```

**Intervention Playbook (if Red):**
```
Call within 24h:
├─ "Hi [Name], want to do a quick call?"
├─ Diagnose: "What's getting in the way?"
├─ Solve: "Let me show you how..."
├─ Offer: "I'll upload your case for you"
└─ Follow up: Email with custom setup help

If customer still not engaged:
├─ Offer: Refund option (no shame)
├─ Request: "Could you share feedback?"
└─ Keep: Door open for future ("Come back anytime")
```

---

## Week 2: Early Adoption (T=8–14 days)

### Email: Advanced Features

```
Subject: 3 recursos que você provavelmente não sabe

Hi [Name],

Além de análise rápida, JustoAI tem alguns
super-poderes escondidos:

1️⃣ Timeline inteligente (mescla dados automático)
2️⃣ Relatórios agendados (toda semana, automático)
3️⃣ Monitoramento JUDIT (alertas quando caso muda)

Quer ver em ação? Video aqui: [link]

[CS Manager]
```

### Group Webinar (if ≥5 new customers)

```
"Getting Most Out of JustoAI" (30 min)
├─ Format: Live + Q&A
├─ Topics:
  ├─ Deep dive: Timeline merge algorithm
  ├─ Case study: Real firm (anonymized) saved R$100K
  ├─ Advanced: API + automations
  └─ Q&A: Your questions
├─ Attendance: 60% of onboarding cohort (goal)
├─ Recording: Sent after for those who miss
└─ Next: Monthly recurring webinar
```

---

## Month 1: Engagement & Retention

### Week 3: Upgrade Opportunity (if heavy usage)

```
Identify: Customer using >70% of monthly credits

Email: Upsell
"Hey [Name], você está amando JustoAI!

Notei que você já usou [85%] de seus créditos
com Professional. Você poderia aproveitar mais
com mais usuários ou análises.

Quer conversar sobre upgrade para Enterprise?
(Preço custom, unlimited créditos)

Let me know,
[Sales]"

Goals:
├─ If yes → upsell to higher tier
├─ If no → ensure they understand overage costs
└─ If maybe → schedule call
```

### Week 4: First Month Wrap-up

**Email: "Sua primeira semana — Parabéns!"**

```
Hi [Name],

Completou 1 mês de JustoAI! 🎉

Veja o que você fez:
├─ 12 casos criados
├─ 8 análises FULL
├─ 3 relatórios gerados
├─ R$50K economizados vs JUDIT

PARABÉNS! Você já está tirando valor real.

Próximos passos:
├─ Convidar mais 2–3 advogados do time
├─ Automatizar relatórios (savings boost)
├─ Explorar monitoramento JUDIT
└─ Dar feedback via survey

Obrigado por confiar na gente!

[CS Manager]"
```

### Net Promoter Score (NPS) Survey

```
"How likely are you to recommend JustoAI?"
└─ Scale: 0–10
├─ Promoters (9–10): "What did you like most?"
├─ Passives (7–8): "What could we improve?"
└─ Detractors (0–6): "What's missing?"

Timing: Week 4 (after usage)
Goal: NPS >50
Track: Per cohort + overall
```

---

## Ongoing: Monthly Cadence

### Monthly Touch-base Call (15 min)

```
Scheduled: 1st Thursday of month, 10am
Participant: Customer + CS manager
Agenda:
├─ Quick win: "What went well this month?"
├─ Blocker: "Anything that frustrated you?"
├─ Roadmap: "Excited about X feature coming"
├─ Upsell: "Seen our new Y feature?"
└─ Feedback: "Thoughts on Z?"

Output:
├─ Action items logged
├─ Escalation to product team (if bug)
└─ Next call scheduled
```

### Monthly Email: Feature Update

```
"What's new in JustoAI — [Month]"
├─ 1 new feature (highlight)
├─ 1 bug fix
├─ 1 performance improvement
├─ 1 customer win (anonymized)
└─ 1 upcoming feature (tease)

Tone: Conversational, short
Goal: Keep product top-of-mind
```

### Community Slack Channel

```
#justoai-users (customers only, peer support)
├─ Tips & tricks (customer-to-customer)
├─ Questions: answered by CS within 2h
├─ Feature requests (community voting)
├─ Success stories (celebrate wins)
└─ Monthly office hours (live Q&A with team)

Benefits:
├─ Peer support reduces support burden
├─ Community builds loyalty
├─ Feedback loop to product
└─ Upsell opportunities (group conversations)
```

---

## Activation Metrics

### Activation (T=0 to T=7)

| Metric | Target | Owner |
|--------|--------|-------|
| Login rate | 90% | Product |
| Case created | 70% | CS |
| FULL analysis attempted | 40% | Product |
| Onboarding call attended | 80% | CS |
| Actively using (2+ actions) | 60% | CS |

### Engagement (T=8 to T=30)

| Metric | Target | Owner |
|--------|--------|-------|
| DAU/customer | >20% | Product |
| Features explored | >70% | CS |
| Team members invited | 60% | CS |
| NPS response | >50% | CS |
| Likely to renew | >85% | CS |

### Retention (T=30+)

| Metric | Target | Owner |
|--------|--------|-------|
| 30-day retention | >90% | CS |
| 90-day retention | >85% | CS |
| Monthly actives (MAU) | >70% | Product |
| Churn rate | <5% | CS |
| Expansion revenue | >20% | Sales |

---

## Playbooks by Customer Segment

### Segment 1: Solo Lawyer

```
Day 1: Simpler messaging
├─ Email: "You're all set"
├─ No call needed (time-poor)
├─ In-app only
└─ Self-serve focused

Week 1: Check in via email only
├─ "How's it going?"
├─ Links: Help docs + FAQs
└─ Optional office hours (record)

Goal: Self-sufficient, NPS >40
```

### Segment 2: Small Firm (5–20 lawyers)

```
Day 1: Standard playbook
├─ Call + email
├─ Team setup discussion
└─ Excitement building

Week 1: Team enablement
├─ Multi-user training session
├─ Best practices doc
├─ Regular check-ins
└─ Goal: Team adoption >70%

Goal: Expansion revenue, NPS >60
```

### Segment 3: Enterprise (20+ lawyers)

```
Day 1: Customized + executive alignment
├─ COO/CTO present
├─ Custom implementation plan
├─ Executive sponsor assigned
└─ Weekly check-ins scheduled

Weeks 1–4: Dedicated implementation
├─ Roles training
├─ Integrations
├─ Custom workflows
├─ Success metrics defined

Goal: Full adoption, NPS >70, multi-year contract
```

---

## Checklist for CS Manager

### Pre-onboarding Prep
```
☐ Customer account created
☐ Stripe subscription confirmed
☐ Access email sent
☐ CS platform updated (Zendesk/Intercom)
☐ Call scheduled (day 2)
☐ Notes on customer (industry, use case)
```

### Day 1
```
☐ Welcome email sent
☐ Track: Customer logged in
☐ Slack notification: "New customer!"
└─ Celebrate in #wins
```

### Day 2 (Call Day)
```
☐ Call happened (track if missed)
☐ Notes: Pain points, wins, blockers
☐ Follow-up email sent
☐ Churn risk assessment
└─ If high risk: Flag immediately
```

### Week 1
```
☐ Daily engagement check
├─ "New case created?" → 🟢
├─ "Still on day 1 state?" → 🟡
└─ "Zero login?" → 🔴
☐ Tip emails sent (3x)
☐ NPS survey sent (Day 7)
☐ Activation check: Did they hit target milestones?
```

### Month 1
```
☐ Final check-in call (or email for solo)
☐ NPS response received
☐ Churn risk: Green or Red?
☐ Expansion potential identified?
└─ Escalate to sales if upsell opportunity
```

---

## Success Story Template

**Share:** Monthly in newsletter + Slack

```
"[Customer Name] scaled from 10 to 25 cases/month"

"[Firm Name] reduced analysis time from 6 hours to 30 mins per case"

"[Lawyer Name] now monitors 50+ active cases automatically"

Include:
├─ 1 quote from customer
├─ 1–2 metrics (cases, time, money saved)
├─ 1 screenshot
└─ Feature they loved most
```

---

## Feedback Loop to Product

**Monthly:**
- Collect: Support issues + feature requests
- Prioritize: By customer impact + frequency
- Share: Product team standup
- Track: Public roadmap (customers see it being worked on)

**Quarterly:**
- Customer advisory board (5–10 customers)
- Deep-dive discussions
- Product showcase + feedback
- Build loyalty + identify upsell opportunities

---

**Onboarding is the most critical success moment. Do it right → 90%+ retention. Do it wrong → 70%+ churn.**
