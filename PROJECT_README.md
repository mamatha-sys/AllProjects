# TeamLink ATS

A standalone Applicant Tracking System: React frontend, Node/Express backend, SQLite
database (via Prisma). This is the `ats` branch of the TeamLink.Enterprise monorepo —
scoped to ATS only (no HRMS, Accounts or Admin), built from `main`'s ATS implementation
and cross-checked against the original `teamlink-enterprise_69.html` design prototype.

## Structure

```
backend/    Node.js + Express API, Prisma schema, seed data
frontend/   React (Vite) app
```

## Prerequisites

- Node.js 18+

## Backend setup

```bash
cd backend
npm install
cp .env.example .env   # edit JWT_SECRET if you like
npx prisma migrate dev --name init
npm run seed
npm run dev
```

API runs on `http://localhost:4010`. Seeded demo logins (password `password123`):

- `admin@teamlink.test` — Super Admin
- `manager@teamlink.test` — Manager (IT department)
- `recruiter@teamlink.test` — Recruiter
- `bde@teamlink.test` — BDE
- `tl@teamlink.test` — TL (department-scoped)
- `client@teamlink.test` — Client (sees only Orbit Software Solutions)

## Frontend setup

```bash
cd frontend
npm install
npm run dev
```

App runs on `http://localhost:5183` and proxies `/api` to the backend. The public job
board is available without logging in at `/careers` (apply) and `/my-applications`
(check status by email).

## Data model

`User` (role, optional ATS department, optional client link) · `Client` (+ e-sign
agreement fields) · `Requirement` (client, recruiter, BDE, priority, status) ·
`Candidate` (+ skills, for match suggestions) · `Application` (candidate + requirement +
pipeline stage + joining date) · `AuditLog` · `Notification`. See
[backend/prisma/schema.prisma](backend/prisma/schema.prisma).

## Feature coverage

Cross-checked against the ATS section of the design prototype
(`teamlink-enterprise_69.html`, ATS_STAGES / ATS_ROLES / the requirement, client,
candidate and matching-candidate functions around lines 6252–9895):

- **Pipeline** — the full 17-stage flow (New → AI Interview stages folded into
  Recruiter Review in this build → Recruiter Approved → With BDE → BDE Approved →
  Shared with Client → Client Review → Client Shortlisted → Interview Scheduled →
  Interview Completed → Selected → Offer → Offer Accepted → Joined → Hired, plus
  Rejected/Hold), enforced server-side per role (`backend/src/routes/applications.js`).
- **Requirements** — CRUD, activate/reopen toggle, matching-candidate suggestions, and
  a templated job-description generator (`backend/src/routes/requirements.js`).
- **Clients** — CRUD plus a generate → send → e-sign agreement flow
  (`backend/src/routes/clients.js`, `frontend/src/pages/ClientDetail.jsx`).
- **Candidates** — CRUD with a duplicate-check (by email/phone) before creating a new
  record, and a client "confirm joining" action once an offer is accepted
  (`backend/src/routes/candidates.js`, `applications.js`).
- **Candidate portal** — public job board + apply flow with no account required
  (`frontend/src/pages/Careers.jsx`, `JobDetail.jsx`), plus an email-based
  "My Applications" status lookup (`MyApplications.jsx`) standing in for the
  prototype's logged-in candidate portal.
- **Matching candidates**, **interview calendar**, **recruiter/BDE workload**, and
  **global search** live under `frontend/src/pages/ats/*` and `backend/src/routes/atsExtras.js`.
- **Role-based access** — `ATS_ROLES` equivalents (Super Admin/Admin/Manager/Assistant
  Manager/STL/TL/Recruiter/BDE/Client), with client-scoped visibility and
  department-scoped visibility for Manager/Assistant Manager/STL/TL
  (`backend/src/middleware/auth.js`).
- **Notifications** — pushed on stage changes, agreement sent, and joining confirmed
  (`backend/src/utils/notify.js`), visible in-app under Notifications.

Not carried over from the prototype (out of scope for this trimmed build): full AI
interview scheduling/automation, and a separate logged-in Candidate role — the public
apply + email status-check flow covers the same end-user need without adding a second
auth system.
