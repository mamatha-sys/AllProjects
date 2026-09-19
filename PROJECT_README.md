# TeamLink.Enterprise

A full-stack scaffold generated from the `teamlink-enterprise_3.html` prototype: React frontend, Node/Express backend, PostgreSQL database (via Prisma). Auth/roles plus the full ATS pipeline (Clients → Requirements → Candidates → Applications, through the 18-stage pipeline, including the AI Interview stages) are wired end-to-end as the template module — HRMS, Accounts, Admin and Reports follow the same pattern.

## Structure

```
backend/    Node.js + Express API, Prisma schema, seed data
frontend/   React (Vite) app
```

## Prerequisites

- Node.js 18+
- A running PostgreSQL instance

## Backend setup

```bash
cd backend
npm install
cp .env.example .env   # edit DATABASE_URL / JWT_SECRET
npx prisma migrate dev --name init
npm run seed
npm run dev
```

API runs on `http://localhost:4000`. Seeded demo logins (password `password123`):

- `admin@teamlink.test` — Super Admin
- `recruiter@teamlink.test` — Recruiter
- `bde@teamlink.test` — BDE
- `tl@teamlink.test` — TL (department-scoped)
- `client@teamlink.test` — Client (sees only their own requirements)

## Frontend setup

```bash
cd frontend
npm install
npm run dev
```

App runs on `http://localhost:5173` and proxies `/api` to the backend.

## Data model

`User` (role enum, optional ATS department, optional client link) · `Client` · `Requirement` (client, recruiter, BDE, priority, status) · `Candidate` · `Application` (candidate + requirement + pipeline stage) · `AuditLog`. See [backend/prisma/schema.prisma](backend/prisma/schema.prisma).

## Extending to the rest of the prototype

The full module/feature breakdown from the prototype (HRMS, Accounts, Administration, Reports) is documented separately in the "TeamLink.Enterprise — Modules & Features" doc. Each additional module follows the same shape already established here: a Prisma model, an Express router under `backend/src/routes/`, and a React page under `frontend/src/pages/`.

*(Written here instead of README.md because README.md was locked open in Microsoft Word — feel free to merge this in and delete this file once it's closed.)*
