# Financial Model — JustoAI V2

**Purpose:** Project revenue, expenses, profitability for 24 months
**Model:** Conservative (assume slower growth than possible)
**Format:** This document provides structure; use Google Sheets/Excel for calculations

---

## Revenue Projections

### Assumptions

```
Pricing (stable Year 1):
├─ Starter: R$199/month
├─ Professional: R$699/month
├─ Enterprise: R$5.000/month (custom)
└─ Mix: 30% Starter, 60% Prof, 10% Enterprise (by MRR)

Customer Growth:
├─ Month 1–3: 0 (founders building)
├─ Month 4–6: 3–5 customers
├─ Month 7–9: 10–15 customers
├─ Month 10–12: 20–25 customers
├─ Total Year 1: 50–100 customers
└─ Target: 50–75 average (conservative)

Churn Rate:
├─ Month 1–6: 0% (early adopters sticky)
├─ Month 7–12: 2–3% monthly
├─ Year 2: 4–5% monthly (mature cohorts)

Expansion Revenue:
├─ Upsell (Starter → Pro): 5% of base
├─ Add-on credits: 2% of base
├─ Total expansion: 7% monthly growth from same customers
```

### Monthly Revenue Model

```
Formula: MRR = (# Customers × Avg Price) - (Previous MRR × Churn)

Example Calculation:
Month 1:  MRR = 0
Month 2:  MRR = 0
Month 3:  MRR = 0
Month 4:  MRR = (3 customers × R$600 avg price) = R$1.800
Month 5:  MRR = (5 customers × R$600) = R$3.000
Month 6:  MRR = (10 customers × R$600) = R$6.000
Month 9:  MRR = (25 customers × R$600) = R$15.000
Month 12: MRR = (50+ customers × R$600) = R$30.000+

Churn adjustment (Month 12):
MRR = (R$30K × 97%) + (new customers R$3K) = R$33K
```

### Year 1 Revenue Summary

```
Month  | Customers | New | MRR      | ARR      | Notes
──────────────────────────────────────────────────────
1–3    | 0         | 0   | R$0      | R$0      | Building
4      | 3–5       | 3–5 | R$2–3K   | R$24–36K | First customers
5      | 5–8       | 2–3 | R$3–5K   | R$36–60K | Accelerating
6      | 10–12     | 5–4 | R$6–7K   | R$72–84K | Momentum
7      | 15–18     | 5–6 | R$9–11K  | R$108–132K | Ramp up
8      | 18–22     | 3–4 | R$11–13K | R$132–156K | Growth
9      | 22–28     | 4–6 | R$13–17K | R$156–204K | Acceleration
10     | 28–35     | 6–7 | R$17–21K | R$204–252K | Strong
11     | 35–45     | 7–10| R$21–27K | R$252–324K | Robust
12     | 50–75     | 15–30 | R$30–45K | R$360–540K | Full year

Year 1 Total ARR: R$300–500K (average R$400K)
Year 1 Total Revenue: R$300–500K
MRR End of Year: R$25–45K (target: R$40K)
```

---

## Expense Projections

### Fixed Costs (Monthly)

```
Salaries:
├─ Founder (salary): R$5K/month × 12 = R$60K (opportunity cost)
├─ VP Sales (Month 2+): R$7K × 11 months = R$77K
├─ CS Manager (Month 4+): R$4K × 9 months = R$36K
├─ Junior Dev (Month 6+): R$5K × 7 months = R$35K
└─ Total Salaries: ~R$208K

Infrastructure & Hosting:
├─ Vercel (frontend): R$500–2K/month = R$8K/year
├─ Railway (backend): R$1K–3K/month = R$20K/year
├─ Supabase (database): R$2K–5K/month = R$40K/year
├─ Upstash (Redis): R$500–1K/month = R$8K/year
├─ Sentry (monitoring): R$500–1K/month = R$6K/year
└─ Total Infrastructure: ~R$82K/year

Tools & Services:
├─ CRM (Pipedrive): R$2K/year
├─ Email platform: R$1.2K/year
├─ Analytics: R$1.2K/year
├─ Compliance & Legal: R$10K/year
├─ Accounting: R$3K/year
└─ Total Tools: ~R$17.4K/year

Fixed Costs Total: ~R$307.4K/year
```

### Variable Costs

```
Per Customer:
├─ Cloud costs (storage, compute): ~R$20–50
├─ Third-party APIs (Gemini, JUDIT): ~R$10–30
├─ Customer support time: ~R$20–40
├─ Payment processing (2.9%): R$5–20
└─ Total variable per customer: ~R$55–140/month

Gross Margin Calculation:
├─ Avg customer MRR: R$600
├─ Variable cost: R$100 (average)
├─ Contribution margin: R$500/customer
├─ Gross margin: 83%

50 customers:
├─ Gross margin: R$500 × 50 = R$25K/month = R$300K/year
├─ Fixed costs: R$307.4K/year
├─ Operating margin: -7.4K/year (slight loss)

75 customers:
├─ Gross margin: R$500 × 75 = R$37.5K/month = R$450K/year
├─ Fixed costs: R$307.4K/year
├─ Operating margin: +142.6K/year (profitable) ✅
```

### Marketing & Sales Expenses

```
Year 1 Marketing Budget:
├─ Content creation (blog): R$8K
├─ LinkedIn ads: R$6K
├─ Google Ads: R$3.6K
├─ Webinars & events: R$30K
├─ Website & tools: R$10K
└─ Total Marketing: ~R$57.6K

Sales Costs (VP Sales commissions):
├─ VP Sales commission: 10% of new ARR
├─ Example: 50 customers × R$7.2K ARR = R$360K
├─ Commission: 10% = R$36K
└─ Total Sales: ~R$36K (variable)

Marketing + Sales: ~R$93.6K/year
```

---

## Profitability Analysis

### Break-even Analysis

```
Fixed Costs: R$307.4K/year
Contribution per Customer: R$500/month = R$6K/year

Break-even = Fixed Costs / Contribution per customer
Break-even = R$307.4K / R$6K = 51 customers

Target: 50–75 customers
Status: At break-even OR PROFITABLE ✅
```

### Operating Profit (Year 1)

```
Revenue Scenarios:

SCENARIO A (Conservative): 50 customers
├─ Revenue: R$300K
├─ Gross Profit (83%): R$250K
├─ Fixed Costs: R$307K
├─ Marketing & Sales: R$60K
├─ Operating Profit: -R$117K

SCENARIO B (Base Case): 65 customers
├─ Revenue: R$390K
├─ Gross Profit (83%): R$324K
├─ Fixed Costs: R$307K
├─ Marketing & Sales: R$75K
├─ Operating Profit: -R$58K

SCENARIO C (Optimistic): 100 customers
├─ Revenue: R$600K
├─ Gross Profit (83%): R$498K
├─ Fixed Costs: R$307K
├─ Marketing & Sales: R$100K
├─ Operating Profit: +R$91K ✅ PROFITABLE
```

### Path to Profitability

```
Current Trajectory:
├─ Month 6: R$6K MRR = R$72K ARR (loss R$20K/month)
├─ Month 9: R$15K MRR = R$180K ARR (loss R$10K/month)
├─ Month 12: R$35K MRR = R$420K ARR (breakeven or +R$5K)
└─ Month 15: R$45K+ MRR = R$540K+ ARR (profitable +R$15K)

Timeline to Profitability: 15–18 months
```

---

## Cash Flow Projections

### Monthly Cash Flow (Year 1)

```
Month  | Revenue | COGS | Gross P | Fixed | S&M | Net CF | Cum Cash
────────────────────────────────────────────────────────────────────
1      | 0       | 0    | 0       | 26K   | 5K  | -31K   | -31K
2      | 0       | 0    | 0       | 26K   | 5K  | -31K   | -62K
3      | 0       | 0    | 0       | 26K   | 5K  | -31K   | -93K
4      | 2.4K    | 0.4K | 2K      | 26K   | 5K  | -29K   | -122K
5      | 3.6K    | 0.6K | 3K      | 26K   | 5K  | -28K   | -150K
6      | 6K      | 1K   | 5K      | 26K   | 5K  | -26K   | -176K
7      | 9K      | 1.5K | 7.5K    | 26K   | 6K  | -24.5K | -200.5K
8      | 12K     | 2K   | 10K     | 26K   | 6K  | -22K   | -222.5K
9      | 15K     | 2.5K | 12.5K   | 26K   | 7K  | -20.5K | -243K
10     | 18K     | 3K   | 15K     | 26K   | 7K  | -18K   | -261K
11     | 27K     | 4.5K | 22.5K   | 26K   | 8K  | -11.5K | -272.5K
12     | 35K     | 6K   | 29K     | 26K   | 8K  | -5K    | -277.5K

Year 1 Cumulative Cash Burn: -R$277.5K
```

### Runway Calculation

```
Cash on hand (assumed): R$150K (seed investment needed)

Burn rate:
├─ Months 1–3: R$31K/month = R$93K
├─ Months 4–6: R$27K/month = R$81K
├─ Months 7–12: R$14K/month = R$84K
└─ Average burn: R$23K/month

Runway: R$150K / R$23K = 6.5 months

Recommendation: Raise seed round before Month 7
→ Seed: R$500K–1M gives 18–24 months runway
```

---

## Sensitivity Analysis

### What if Customer Growth is Slower?

```
Scenario: Only 30 customers by Year 1 (vs 65 target)

Revenue: R$180K
Gross Profit: R$150K
Operating Loss: -R$232K (vs -R$58K base case)

Impact: Need to cut costs OR extend timeline
Action: Reduce sales hire (Month 4 vs Month 2)
Result: Can reach 65 customers by Month 18
```

### What if Churn is Higher?

```
Scenario: 8% monthly churn (vs 3% base case)

Customer Retention:
├─ Base case (97% retention): 65 customers by month 12
├─ High churn (92% retention): 35 customers by month 12

Revenue Impact: R$210K vs R$390K (-46%)

Action: Focus on product quality + onboarding
```

### What if Pricing is Lower?

```
Scenario: Average R$400 vs R$600 per customer

Per-customer MRR: R$400 vs R$600
Contribution: R$300 vs R$500
Break-even: 1,025 customers vs 51 customers (worse)

Action: Don't cut price. Compete on value, not cost.
```

---

## Year 2 Projections

### Revenue Growth (Conservative)

```
Year 1 Exit MRR: R$35–45K
Year 2 Growth Rate: 150–200% (typical SaaS)

Year 2 MRR Target: R$90–120K
Year 2 ARR: R$1.1M–1.5M
Year 2 Customers: 150–250

Drivers:
├─ Product improvement
├─ Market expansion (other regions)
├─ Partnerships (law schools, associations)
├─ Word-of-mouth (network effects)
└─ Sales team scaled (2–3 reps)
```

### Year 2 Costs

```
Team Expansion:
├─ +1 Senior Engineer: R$8K/month = R$96K
├─ +1 Sales Rep: R$4K + 10% commission = R$90K
├─ +1 Marketing Person: R$5K/month = R$60K
└─ Total new: R$246K

Infrastructure Scaling:
├─ Database replication: +R$50K
├─ Global CDN: +R$20K
├─ Additional compute: +R$30K
└─ Total: +R$100K

Total Year 2 Operating Costs: ~R$650K
```

### Year 2 Profitability

```
Revenue: R$1.2M
Gross Profit (83%): R$996K
Operating Costs: R$650K
Operating Profit: +R$346K ✅ HIGHLY PROFITABLE

Margin: 29% (healthy SaaS margin)
```

---

## Series A Readiness

### Metrics Investors Want (Year 1 End)

```
Traction:
├─ ✅ MRR: R$40K (target)
├─ ✅ Customers: 75 (target)
├─ ✅ Growth: 20%+ month-over-month
├─ ✅ Retention: >90%

Efficiency:
├─ ✅ CAC: <R$500
├─ ✅ LTV: R$8K+
├─ ✅ LTV/CAC: >10:1
├─ ✅ Payback: <2 months

Path to Scale:
├─ ✅ Market: R$1B+ TAM
├─ ✅ Moats: JUDIT integration (defensible)
├─ ✅ Team: Founder + VP Sales + ops
├─ ✅ Product: Production-ready, customer-validated

Series A Thesis:
"JustoAI has proven product-market fit in Brazil's
R$1B legal tech market. With R$3–5M, they can:
- Build team (5 → 20 people)
- Expand geographically (Brazil → Latam)
- Accelerate growth (75 → 500+ customers)
- Achieve R$200K+ MRR in 18 months"
```

### Series A Ask

```
Target Raise: R$3M–5M
Use of Funds:
├─ 40% Team (VP Product, more sales/eng): R$1.2–2M
├─ 30% Go-to-market (sales, marketing, events): R$900K–1.5M
├─ 20% Infrastructure (scale, global): R$600K–1M
├─ 10% Buffer (contingency): R$300K–500K

Post-money valuation: R$15–25M (typical for traction stage)
```

---

## Key Assumptions & Sensitivity

### Critical Assumptions

```
1. Customer Growth: Linear (3–5 per month Month 4, ramping to 10/mo)
   Risk: Could be slower (need better sales process)
   Risk: Could be faster (if viral + PR)

2. Churn: 2–3% monthly Year 1, 4–5% Year 2
   Risk: Could be 8%+ (product issues)
   Risk: Could be <1% (very sticky)

3. Pricing: Stays at R$199/699/5K
   Risk: Pressure to discount (avoid!)
   Risk: Could increase to R$299/999/7.5K Year 2

4. CAC: <R$500 from sales + marketing
   Risk: Could be R$2K+ (expensive channels)
   Risk: Could be R$100 (viral)

5. COGS: 15–20% of revenue
   Risk: Could be 30%+ (infrastructure scaling issues)
   Risk: Could be 10% (AI model improvements)
```

### Stress Scenarios

```
DOWNSIDE (30% prob):
├─ 30 customers vs 75 target
├─ MRR: R$18K vs R$40K
├─ Operating loss: -R$250K/year
└─ Implies: Need more capital OR pivot

BASE CASE (50% prob):
├─ 75 customers
├─ MRR: R$40K
├─ Operating loss: -R$30K/year (near breakeven)
└─ Implies: Fundable, scalable

UPSIDE (20% prob):
├─ 150 customers
├─ MRR: R$80K
├─ Operating profit: +R$200K/year
└─ Implies: No capital needed, super-fundable
```

---

## Bottom Line

**JustoAI is a:**
- ✅ **Capital-efficient startup** (R$150K seed → R$40K MRR in 12 months)
- ✅ **High-margin business** (>80% gross margin)
- ✅ **Scalable model** (95%+ are software costs, fixed)
- ✅ **Fundable company** (clear path to Series A with good metrics)
- ✅ **Profitable business** (breakeven Month 18, profitable Year 2)

**Risk level: Medium**
- Market validation needed (first 10 customers)
- Competitive risk (incumbents could copy)
- Execution risk (sales, product, team)

**Expected return (if everything goes right):**
- Year 1: -R$30K (near breakeven)
- Year 2: +R$346K (highly profitable)
- Year 3: R$1M+ (could be market leader)
- Exit value: R$100M–500M (typical legal tech SaaS)

---

**All numbers are estimates. Actual results will differ. Review monthly and adjust.**
