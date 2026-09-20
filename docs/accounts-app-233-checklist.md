# Inventory — Teamlink_Accounts_App_233.html

Source: `C:\Users\USER\Downloads\Teamlink_Accounts_App_233.html` (16,221 lines, a standalone "Teamlink Accounts" app)
Scope requested: Accounts module only. HRMS and ATS are explicitly out of scope and will not be touched.

This file has 4 pages under two nav groups:
- **Accounts**: Dashboard, Work (Invoices)
- **Office**: Office & Accounts (6 sub-tabs), Bank & Reconciliation

## Section A — Dashboard
(full detail: see agent transcript in this session)
- Client/period/department/section/role/employee/status filter bar with a searchable client combobox and a financial-year picker (FY current/previous, quarter, half-year, custom range with calendar)
- Recruiter drill-down panel (per-team cards, per-person KPIs, client breakdown, month-by-month, candidate list)
- Approvals card (pending items awaiting sign-off)
- Notice/reminder cards: unread notices, missing-payment-proof nag (with WhatsApp/email/in-app reminder + auto-reminder scheduler + CallMeBot/HTTP gateway integration), missing-expense-proof nag, GST-tax-invoice-needed nag
- 11-tile KPI row (candidates, income before/after GST, GST, TDS, net profit, received, pending, overdue, office expenses, profit after expenses)
- Office spend card, GST position card, client-by-client pending/received table, collection-position progress card

## Section B — Work (Invoices) page
- Same filter bar family plus GST-charged filter, status filter, money-total toggle chips
- Saved views (name + save a filter combination, reusable)
- "No invoice number yet" queue with bulk invoice-numbering
- 6-tile KPI row, ageing-bucket chip bar (0-30/31-60/61-90/90+/settled), TDS-certificate summary tags
- Invoice table with 5 group-by modes (Invoice/Client/Department/Recruiter/Month), 17 toggleable columns, Excel-style per-column filter/sort popovers, expandable invoice→candidate→candidate-detail drill-down
- TDS certificate (Form 16A) tracking per invoice, with its own modal
- Record Payment modal (with proof file upload, ≤3MB), instalment table, proof viewer overlay
- Invoice Account modal (full commercial breakdown + payment history)
- Printable invoice preview (client copy / internal copy)
- Send Invoice modal (email/WhatsApp with templated message, "mark sent" tracking)
- New/Edit Join modal — ~25 fields plus a collapsible personal/document details section, live billing calculator panel, live client-info panel

## Section C — Office & Accounts page (6 sub-tabs)
1. **Bills & expenses** — filter bar, 10-tile KPI row, grouped table (5 modes) with GST/vendor/business-details cards
2. **Calendar** — month grid with statutory due-date markers (TDS, GSTR-1, PF/ESI, GSTR-3B, PMT-06), day drill-down
3. **Proofs & bill files** — proof-kind filter chips, duplicate-payment detector, "fixable gaps" card, proof table
4. **GST position** — filing-position card, vendor/month GST tables, bar chart
5. **Profit & Loss** — accrual vs cash basis toggle, month-by-month table + bar chart, top-clients/top-categories cards
6. **Category & month summary** — category and month breakdown tables + bar charts

Plus: New/Edit Expense modal (~25 fields, expense vs "hand loan" kind switch, full GST/TDS/HSN treatment), Chart of Accounts picker.

## Section D — Bank & Reconciliation page
- 3 internal views: Banking Overview (all accounts), single Account view, full Reconciliation ledger
- Statement import (CSV/paste/native in-browser .xlsx parsing, dedup, auto-post option)
- Match/Categorize modal — auto-suggested matches (exact/possible), manual categorize form (client payment / other income / hand loan / transfer / refund for credits; expense / hand loan / transfer for debits), "remember this narration" rule learning
- Full matching algorithm (narration name-matching, oldest-invoice-first allocation, tolerance ₹20) with a self-documenting explainer card
- Hand loans tracking (money moved outside normal business, per-person ledger, watch-list auto-matching)
- Bank charges detection, balance notes (manual reconciliation entries), duplicate-statement-line detector, matching-rules manager, import history

## What we currently have (this repo's Accounts module)

`backend/src/routes/{invoices,bank,office,dashboard,reports}.js` + `frontend/src/pages/{Invoices,InvoiceDetail,Bank,Office,AccountsDashboard}.jsx`:
- One flat invoice list + detail page (status/client filter, receipts, no grouping/column-filters/TDS-certificate/send-invoice/print-preview/saved-views)
- One flat bank reconciliation table (Match/Manual Match/Unmatch/Ignore/Reconcile — no statement import parsing, no auto-categorize, no hand loans, no matching-rules, no duplicate detection)
- Office expense CRUD (no calendar, no proofs tab, no duplicate detection, no GST-position tab, no chart-of-accounts)
- One Accounts Dashboard (4 KPIs + Recent Invoices + By Client — no recruiter drill-down, no approvals, no reminder system, no financial-year picker)
- No Profit & Loss page, no Category & Month Summary page, no GST position page as a standalone screen, no "Work" invoice-centric layout

## Scale assessment

This reference is **roughly 4-6x larger and deeper than everything else built into this app's Accounts module combined** — it includes several genuinely large subsystems that don't exist here at all yet: bank statement import/parsing, an auto-categorization/matching-rules engine, hand-loan tracking, a financial-year-aware date-range picker used everywhere, a proof-of-payment workflow with reminders (WhatsApp/email/in-app), TDS certificate tracking, a calendar view, and a full Profit & Loss module. Building this to genuine parity is realistically **many separate work sessions**, not one pass.
