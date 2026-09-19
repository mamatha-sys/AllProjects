# Inventory Checklist — ATS, Accounts, Job Portal Integration

Source: `C:\Users\USER\Downloads\teamlink-enterprise_56.html` (single-file prototype, ~8233 lines)
Scope: ATS module, Accounts module, and the Job Portal integration surface within this file (this file is *not* the public Job Portal itself — it only talks to it through a simulated integration layer). HRMS is explicitly out of scope and untouched.

STATUS: **STEP 1 — INVENTORY ONLY. No code has been written. Awaiting "go" before STEP 2 (build).**

---

# SECTION A — ATS MODULE

## A.0 Shared constants

**A.0.1 `CLIENTS_SEED` (line 259, 5 entries):**
`{name:'Orbit Software Solutions', industry:'IT', location:'Hyderabad'}`, `{name:'Medivant Healthcare', industry:'Medical', location:'Bengaluru'}`, `{name:'Vertex Manufacturing', industry:'Manufacturing', location:'Pune'}`, `{name:'Skyline EduTech', industry:'Education', location:'Hyderabad'}`, `{name:'Alpine Financial Services', industry:'BDE', location:'Bengaluru'}`

**A.0.2 `RECRUITERS`** (line 266): `['Kiran Kumar','Meera Iyer']`
**A.0.3 `TLS`** (line 267): `['Divya Rao']`
**A.0.4 `DEPTS`** (line 268): `['IT','Medical','Manufacturing','Education','BDE','HR','Accounts','R&D']`
**A.0.5 `LOCS`** (line 274): `['Hyderabad','Bengaluru','Pune']`
**A.0.6 `SKILL_POOL`** (lines 275–278): `["Java","Spring Boot","React","Node.js","Python","Django","AWS","Azure","SQL","PostgreSQL","MongoDB","Kubernetes","Docker","REST APIs","Microservices","JavaScript","TypeScript","Angular","CI/CD","Machine Learning","Data Analysis","Excel","SAP","Salesforce","Tally","GST Compliance","Recruitment","Client Servicing","Content Writing","SEO","Digital Marketing","Figma","UI Design","QA Testing","Selenium"]`

**A.0.7 `ATS_STAGES`** (line 280): `['New','Recruiter Review','Recruiter Approved','With BDE','BDE Approved','Shared with Client','Client Review','Client Shortlisted','Interview Scheduled','Interview Completed','Selected','Offer','Offer Accepted','Joined','Hired']`

**A.0.8 `STAGE_OWNER_ACTION`** (lines 284–290+, per-stage `{ownerRole, action, days}` map used to derive Owner/Next Action/Due Date columns everywhere — e.g. `'New': {ownerRole:'Recruiter', action:'Screen the resume', days:1}`, `'With BDE': {ownerRole:'BDE', action:'BDE review', days:2}`, `'Shared with Client': {ownerRole:'Client', action:'Await client review', days:3}`).

**A.0.9 `POSTING_SOURCES`** (line 6779): `['TeamLink Job Portal','Naukri','Indeed','Shine','TeamLink Website','Social Media']`
**A.0.10 `POSTING_STATUSES`** (line 6780): `['Draft','Ready to Post','Posted','Partially Posted','Failed','Paused','Closed']`
**A.0.11 `REJECT_REASON_CATEGORIES`** (lines 6680–6681): `['Skill gap','Experience mismatch','Salary expectation mismatch','Location constraint','Notice period too long','Candidate not interested','Client hired another candidate','Communication / soft skills','Other']`
**A.0.12 `HOLD_REASON_CATEGORIES`** (lines 6682–6683): `['Requirement on hold by client','Budget approval pending','Awaiting candidate confirmation','Better-fit candidate in pipeline','Document / background check pending','Other']`
**A.0.13 `AI_INTERVIEW_STATUSES`** (line 7245): `['Required','Scheduled','Started','In Progress','Completed','Expired','Not Started']`
**A.0.14 `OFFER_FLOW`** (line 7059): `{'Draft':'Generated','Generated':'Sent','Sent':'Viewed','Viewed':'Accepted'}`

## A.1 Screens / router (`renderATS`, lines 5514–5525)

Routed by `mod`: A.1.1 dashboard → `atsDashboard()`; A.1.2 requirements (list or `requirementDetail(id)`); A.1.3 clients (list or `clientDetail(id)`); A.1.4 candidates (list or `candidateDetail(id)`); A.1.5 team → `teamView()`; A.1.6 calendar → `calendarView()`; A.1.7 search → `searchResults(q)`; default → dashboard.

## A.2 ATS Dashboard (`atsDashboard`, lines 5532–5574)

**A.2.1 KPI statbar**, exact formulas:
- "Open requirements": `state.requirements.filter(r=>r.status==='Open').length`
- "Recruiter review": `apps.filter(a=>a.status==='Recruiter Review').length`
- "With BDE": `apps.filter(a=>a.status==='With BDE').length`
- "Client review": `apps.filter(a=>['Shared with Client','Client Review'].includes(a.status)).length`
- "Interviews upcoming": `apps.filter(a=>a.interview&&a.interview.status==='Scheduled').length`
- "Hiring outcomes this cycle": `apps.filter(a=>['Joined','Hired'].includes(a.status)).length`

(where `apps = state.applications`, filtered to only the client's own pipeline when `perms().isClient`)

**A.2.2 Table "Pipeline by stage"** — columns: `Stage`, `Candidates`. Rows = `ATS_STAGES.concat(['Hold','Rejected'])` filtered to non-zero counts; row click → `#/ats/candidates?stage=<stage>`.

**A.2.3 Card "Recruiter workload"** — one row per RECRUITERS entry: name — count of open requirements assigned.

**A.2.4 Card "Job Portal Integration"** (hidden for client role):
- Connection status dot, Last Sync, Candidates Synced count
- "Needs Mapping" badge (shown only if >0)
- Buttons: **Sync** → `syncNow()`; **Open Job Portal ↗** → `openJobPortal()`
- Link "Full integration details →" → `#/admin/integrations`

## A.3 Needs-Mapping panel (`mappingQueuePanel`, lines 1246–1268) — shown atop Requirements list

- A.3.1 Header "Needs Mapping" with count badge.
- A.3.2 Table columns: `Job Portal Job ID`, `Job Title`, `Source`, `Applications`, `Date Received`, `Mapping Status`, `Suggested Requirement`, `Actions`.
- A.3.3 Buttons per row: **Map to Existing** → `openQueueMapModal(rowId)`; **Create New (Draft)** → `createDraftFromQueue(rowId)`; **Ignore / Archive** → `archiveQueueRow(rowId)`.
- A.3.4 Mapping Status badge text = `r.status`.

### A.3.5 Modal: "Map — {jobTitle}" (`openQueueMapModal`, lines 1269–1283)
- KV rows: Job Portal Job ID, Applications waiting
- Field: **Map to existing requirement** select, options = every non-mapping requirement as `"{title} — {client}"`, pre-selected to suggestion
- Notice if suggested: "A suggestion is pre-selected based on title and skill overlap — confirm or change it."
- Buttons: Cancel; **Map & Import Applications** → `confirmQueueMap(rowId)` (validation: "Pick a requirement first." if none picked)

### A.3.6 Modal: "Map to Existing Requirement" (`openMappingModal`, lines 5622–5631) — from a requirement's own detail page
- Field: **Target requirement** select, options = every requirement except placeholder/needs-mapping ones
- Note: "All applications currently under this placeholder will be moved to the selected requirement, and future syncs for this Job Portal job will map there directly."
- Buttons: Cancel; **Confirm Mapping** → `confirmMapping(placeholderReqId)`

## A.4 Match Details Modal (`showMatchModal`, lines 1200–1206)

- Header "`{candidate.name} × {requirement.title}`"
- Sections: "What increased the score" (green ✓ rows or "No positive signals — the score comes from defaults only."); "What reduced the score" (red − rows or "Nothing reduced the score on the data available.")
- Footer note: "Deterministic score — the same candidate and requirement always produce the same result. Mandatory skills carry the heaviest weight."
- Button: Close

## A.5 Requirements

### A.5.1 Requirements List (lines 5652–5684)
- Header "Jobs / Requirements", sub = count
- Button **Add Requirement** (perm `requirements.create`) → `openAddRequirementModal()`
- Mapping-queue panel shown (unless client role)
- A.5.1.1 Search box `#reqSearch` placeholder "Search title or skill…" — matches title or skills
- A.5.1.2 Filter `#reqClient`: "All clients" + every client name + "TeamLink Internal"
- A.5.1.3 Filter `#reqStatus`: "All statuses", "Open", "On Hold", "Closed"
- A.5.1.4 Table columns: `Requirement`, `Client`, `Location`, `Experience`, `Priority`, `Openings`, `Status`
  - Priority badge: High→rejected(red), Medium→review(amber), else→applied
  - Row click → detail. Empty state: "No requirements match."

### A.5.2 Add Requirement modal (lines 5685–5769, size `xwide`)
Sections and every field:
- **A. Basic Information:** Requirement ID (auto, disabled); Requirement Type* (Client/Internal); Job Title*; Department* (DEPTS); Number of Openings* (default 1); Priority* (Low/Medium[default]/High/Urgent); Requirement Status (disabled, "Draft (until activated)"); Closing Date.
- **B. Client Information** (hidden for internal): Client* select; Agreement (disabled); Agreement Status (disabled); Client Contact (disabled); live agreement-status note.
- **C. Job Description:** Full Job Description*; Responsibilities ("One per line"); Qualifications; Education select (Any Degree/B.Tech/B.E/MCA/MBA/M.Tech/MBBS/B.Pharm/B.Sc/M.Sc/Diploma/Other); Mandatory Skills* (comma sep); Good-to-have Skills (comma sep).
- **D. Job Conditions:** Employment Type* (Full Time/Part Time/Contract/Temporary/Internship); Work Mode* (Work From Office/Hybrid/Remote); Work Location* (LOCS); Preferred Location (Any+LOCS); Minimum Experience (yrs)* (default 2); Maximum Experience (yrs) (default 6); Relevant Experience (yrs) (default 2); Joining Timeline* (Immediate/Within 7 Days/Within 15 Days[default]/Within 30 Days/30–60 Days/60+ Days); Maximum Notice Period (Immediate/7/15/30[default]/60/90 Days); Job Preference (Permanent/Contract/Full Time/Part Time/Remote/Hybrid/Office).
- **E. Compensation:** Salary Type (Annual CTC/Monthly/Hourly); Currency (INR/USD); Minimum Salary (₹L); Maximum Salary (₹L).
- **F. Assignment:** Recruiter* (RECRUITERS); TL (TLS); STL (— None — / Rekha Nair); BDE (hidden for internal) (Sanjay Mehta/Pooja Bhatt).
- **G. Job Posting:** one checkbox per POSTING_SOURCES entry; footer note on posting lifecycle.
- **Footer buttons:** Cancel; Preview → `previewRequirement()`; Save Draft → `saveNewRequirement('draft')`; Save & Activate → `saveNewRequirement('activate')`; Save & Post (primary) → `saveNewRequirement('post')`.
- **Validation (non-draft):** "Enter a job title." / "Enter a job description." / "Enter at least one mandatory skill." / "Cannot activate or post — the client agreement is not Active yet. Save as Draft instead."
- Preview modal has one button "← Back to form".

### A.5.3 Requirement Detail (lines 5899–5973)
- Breadcrumb, back link, header, status badge
- Draft notice (if Draft & not internal): either "activate now" prompt with **Activate Requirement** button, or "cannot go live" note with "Go to Agreement →" link
- **Job Posting card**: status badge, sources summary, unsigned-agreement note; button **Manage Posting** → `openPostingModal(id)`
- Needs-mapping notice with **Map to Existing Requirement** button (if applicable)
- **Details card**: Location·WorkMode, Experience, Salary, Openings, Priority, Recruiter/BDE, skill pills, description
- A.5.3.1 Table "Matching Candidates for …" — columns: `Candidate`, `Location`, `Experience`, `Matching Skills`, `Missing Mandatory`, `Score`, `Action`. Score → `showMatchModal`. Action: **Add to Pipeline** → `addCandidateToRequirement`.
- A.5.3.2 Table "Candidates in pipeline ({count})" — columns: `Candidate`, `Stage`, `Score`.
- Requirement info card: Created, Closing, Type; button **Close Requirement / Reopen Requirement** (toggle).

### A.5.4 Functions
- `activateRequirement(id)` — blocks if agreement not Active: "Cannot activate — the client agreement is not yet Active."
- `toggleRequirementStatus(id)` — toggles Open↔Closed.
- `addCandidateToRequirement(candId, reqId)` — duplicate check: "This candidate is already in the pipeline for this requirement."

## A.6 Clients

### A.6.1 Clients List (lines 5997–6011)
- Header "Clients", sub = count
- Button **Add Client** (perm `clients.create`) → `openAddClientModal()`
- Table columns: `Client`, `Industry`, `Location`, `Account Manager`, `Agreement`, `Open Requirements`
  - Agreement badge: Active→active(teal), Cancelled/Expired→rejected(red), else→pending(amber)
  - Row click → detail. Empty state: "No clients in your scope."
- No search box; client-role users pre-filtered to own record.

### A.6.2 Add Client modal (lines 6012–6110, wide) — 3 tabs

**Basic Info tab** (default active):
- Company Name*; Legal Company Name*; Company Website; Industry select (— Select —/IT/Healthcare/Manufacturing/Education/Finance/Retail/Logistics/Other); Owner Department (DEPTS, IT default); Year of Establishment; Landline Number; Status (Active[default]/Inactive/Suspended); Active date* (defaults today).
- Primary Contact: Primary Name*, Primary Designation, Primary Contact Phone*, Primary Mail*, Primary WhatsApp.
- Additional Contacts: dynamic **+ Add Contact** rows (Name, Designation, Email, Phone, Purpose/Type select: Billing Contact/Interview Contact/Escalation Contact/Other, Remove button).
- Secondary Contact: Name/Designation/Phone/Mail.
- Client Address: House Number, Street, Landmark, Area, Pin code, Country (default India).
- Location (State/District/City)*: State select (Telangana/Karnataka/Maharashtra/Tamil Nadu/Delhi); District (empty placeholder); City (LOCS).
- Classification & Communication: Client Type (— Select —/Direct/Vendor/Partner); Client Priority (High[default]/Medium/Low); Primary/Secondary Comm Mode (— Select —/Email/WhatsApp/Phone).

**Legal & Finance tab** (hidden by default): GSTIN; PAN; TAN; Business Type (Private Limited/Public Limited/LLP/Partnership/Startup/Other); Recruitment Fee %* (default 8.33); TDS % (default 10); Payment Terms select (Invoice 6 days after joining.../15/30/45/60 Days); Guarantee Period (default "30 Days"); GST % (default 18); Invoice Trigger (Candidate Joining/Custom); Payment Due (default "6 days after invoice"); Commercial Terms/Notes; Account Manager select (RECRUITERS+TLS); BDE (Sanjay Mehta/Pooja Bhatt).

**Risk Monitoring tab** (hidden by default): Payment Risk Flag (None[default]/Watch/High Risk); Risk Notes.

Live preview panel: "Agreement Template Preview", updates on input.

**Footer buttons:** Cancel; Save Draft → `saveNewClient(true)`; **Save Client & Generate Agreement** (primary) → `saveNewClient(false)`.

**Validation (non-draft):** "Enter the company name." / "Select the client location (State/District/City)." / "Enter the primary contact name, phone and email."

### A.6.3 Client Detail (lines 6167–6216)
- Breadcrumb, back link, header, agreement status badge
- Client details card: Contact, Account Manager, GST, TDS, Payment Terms, Agreement Date; button **Open Agreement/View Agreement** → `openAgreementModal(id)`
- A.6.3.1 Table "Requirements ({count})" — columns: `Requirement`, `Openings`, `Status`
- A.6.3.2 Table "Candidates shared with this client" — columns: `Candidate`, `Requirement`, `Stage`, `Action`. Actions (only for Shared with Client/Client Review status): **Shortlist** → `clientDecision(appId,'shortlist')`; **Reject** → `clientDecision(appId,'reject')`; else **View**.
- Billing history card: invoice list with status badges.

### A.6.4 Agreement Modal (lines 6217–6245)
- Header "Recruitment / Staffing Services Agreement — {client}"
- Amber demo notice: "Prototype / Demo — generated from TeamLink's standard agreement template using this client's own commercial terms. Send/confirm/sign steps below are simulated; no real e-signature or DSC provider is connected."
- Status KV with badge; full agreement document; "Agreement history" list
- Footer buttons (state-dependent): Close; **Edit Agreement**; if Draft: **Send to Client**(primary); if Sent: **Mark Viewed**(if not yet), **Client Confirms/Signs (Demo)**(primary), **Resend**; if Confirmed: **Activate Agreement**(primary)

### A.6.5 Edit Agreement modal (lines 6273–6320, xwide)
- Note: "Edit any clause below. Regenerate re-populates every clause from the client's saved commercial terms, discarding manual edits."
- One textarea per agreement clause
- Buttons: Cancel; **Regenerate from client data**; **Preview**; **Save Agreement** (primary)

### A.6.6 `generateAgreementDocument` sections (verbatim headings): `Parties`, `1. Definitions`, `2. Term and Termination`, `3. Scope of Services`, `4. Client Obligations`, `5. Fees and Payment Terms`, `6. Replacement Guarantee`, `7. Non-Circumvention`, `8. Confidentiality & Data Protection`, (conditionally) `8A. Additional Commercial Terms`, `9. Governing Law`. Fee defaults 8.33%.

### A.6.7 Agreement lifecycle functions (all `logAudit` + `saveState`)
- `sendAgreementToClient` — Draft→Sent; toast "Agreement sent to client (simulated)."
- `markAgreementViewed` — sets viewed; toast "Marked as viewed by the client (simulated)."
- `confirmAgreementByClient` — Sent→Confirmed; toast "Agreement confirmed — simulated e-signature (demo only)."
- `resendAgreement` — history entry "Resent"; toast "Agreement resent (simulated)."
- `activateAgreement` — Confirmed→Active; toast "Agreement is now Active — requirements for this client can be activated."
- `regenerateAgreement` — toast "Agreement regenerated from the client's saved commercial terms."
- `saveAgreementEdits` — toast "Agreement saved."

### A.6.8 `clientDecision(appId, decision)`
- `shortlist` → status→Client Shortlisted, notification pushed
- `reject` → status→Rejected, rejection record `{reason:'Not a fit for client requirement', by:'Client', ...}`
- Calls `pushStatusToJobPortal(a)`

## A.7 Candidates & Pipeline

### A.7.1 Candidates List (lines 6386–6541)
- Header "Candidates & Pipeline", sub = count
- Button **Add Candidate** (hidden for client role) → `openAddCandidateModal()`
- A.7.1.1 Search box `#candSearch` "Search name or skill…"
- A.7.1.2 Filter `#candLoc`: "All locations" + LOCS
- A.7.1.3 Filter `#candStage`: "All stages" + ATS_STAGES + Rejected + Hold (supports `?stage=` deep link)
- A.7.1.4 Filter `#candSource`: "All sources", Job Portal, Naukri, Indeed, LinkedIn, TeamLink Website
- Table columns: `Candidate`, `ID`, `Current Stage`, `Owner`, `Next Action`, `Due Date`, `Match Score`, `Status`
  - "Overdue" badge if past due; Status = Active/On Hold/Rejected/review badges
  - Empty state: "No candidates match."

### A.7.2 Add Candidate modal (lines 6400–6431)
- Basic Information: First Name*, Last Name*
- Contact Information: Mobile Number* (10-digit); Email*; Current Location* (LOCS); Preferred Location (LOCS)
- Professional Information: Total Experience (yrs)*; Education; Expected Salary; Notice Period (Immediate/7/15/30[default]/60/90 Days)
- Mandatory Skills* (comma sep)
- Source: First Source* (Recruiter/Referral/Naukri/Indeed/LinkedIn/Walk-in/Other); Link to Requirement (optional, "— None, just create the profile —" + open requirements)
- Buttons: Cancel; **Check & Save** → `checkCandidateDuplicate()`
- **Validation:** "Please complete all required (*) fields."; duplicate match on email/mobile → "Candidate already exists — {name} ({id})." with **Open Existing Profile** / **Add New Application to This Candidate** buttons.
- `saveNewCandidate`: existing-application-for-requirement check: "This candidate already has an application for that requirement."

### A.7.3 Candidate Detail (lines 6542–6674)
- Breadcrumb, back link, header (+ "Synced from Job Portal" badge if linked)
- Tabs: `Overview`, `Applications ({n})`, `Matching Requirements`, `Interviews`, `Activity Timeline`, plus (hidden for client) `Rejection History`, `Hold History`, `Notes`
- A.7.3.1 Overview tab: Profile card (Email, Mobile, Preferred Location, Education, skill pills); Sync status card (Origin, Status badge)
- A.7.3.2 Applications tab — columns: `Application`, `Requirement`, `Client`, `Current Stage`, `Owner`, `Next Action`, `Due Date`, `Match Score`, `Status`, `Resume`, `AI Interview`, `Action`. Notice if any Rejected: "This candidate has a rejection on record but remains active and searchable for other requirements — profiles are never deleted on rejection."
- A.7.3.3 Matching Requirements tab — columns: `Requirement`, `Client`, `Location`, `Match`, `Action`
- A.7.3.4 Interviews tab: card per interview (Date/Time, Mode, Interviewer, Status, Score/Feedback); button **Log Interview Result** → `completeInterview(appId)`. Empty: "No interviews yet".
- A.7.3.5 Rejection History tab — columns: `Requirement`, `Client`, `Previous Stage`, `Rejected By`, `Side`, `Reason Category`, `Detailed Reason`, `Date / Time`, `Comments`. Empty: "No rejections on record".
- A.7.3.6 Hold History tab — columns: `Requirement`, `Previous Stage`, `Hold Reason`, `Hold By`, `Hold Date`, `Review Date`, `Comment`, `Status`, action **Resume to Previous Stage**. Empty: "No holds on record".
- A.7.3.7 Activity Timeline tab: flat stage-history list.
- A.7.3.8 Notes tab (hidden for client): textarea + **Add Note** button.

### A.7.4 Functions
- `candidateStageOf(candId)` — latest application status, or "No application".
- `addNote(candId)` — appends note, silently no-ops if empty.

## A.8 Application workflow action buttons (`workflowActionButtons`, lines 6901–6933)

By status:
- New → **Recruiter Review**
- Recruiter Review → **Approve** / **Reject** / **Hold**
- With BDE → **Share with Client** / **Reject**
- Shared with Client / Client Review → **Shortlist** / **Reject**
- Client Shortlisted → **Schedule Interview**
- Interview Scheduled → text only "See Interviews tab to log result"
- Interview Completed → **Mark Selected** / **Reject**
- Selected → internal: **Extend Offer**; client: **Record Client Joining**
- Offer → **Create Offer** / progressive next-step button (Generate Offer/Send to Candidate/Mark Viewed/Mark Accepted) / **Declined** / **Expired** / **Re-issue**
- Offer Accepted → **Move to Hired**
- Hired → text "Hired — {joinRecordId}"
- Joined → text "Client joining confirmed — {joinRecordId}"
- Rejected → text "Reason: {rejection.reason}"
- Hold → **Resume to Previous Stage**

## A.9 Reject / Hold Modals

### A.9.1 Reject Modal (lines 6684–6706)
- Header "Reject — {candidate name}"
- KV: Requirement, Client, Previous Stage, Rejected By
- Fields: Rejected Side* (Recruiter/BDE/Client/Internal); Reason Category* (REJECT_REASON_CATEGORIES); Detailed Reason* (required, kept on history); Comments
- Notice: "Rejecting closes this application only. The candidate stays Active in the Candidate Master and remains searchable for other requirements."
- Buttons: Cancel; **Confirm Rejection** (danger)
- Validation: "A detailed reason is required."

### A.9.2 Hold Modal (lines 6727–6743)
- Header "Put on Hold — {candidate name}"
- KV: Previous Stage, Hold By
- Fields: Hold Reason* (HOLD_REASON_CATEGORIES); Review Date (default today+7); Comment
- Notice: "A hold is reversible — \"Resume to Previous Stage\" puts the candidate back exactly where they were."
- Buttons: Cancel; **Put on Hold** (primary)
- `resumeFromHold` — "No hold record to resume from." if none.

## A.10 Job Posting lifecycle

### A.10.1 Posting Modal (lines 6803–6834)
- Header "Job Posting — {requirement title}"
- KV Posting Status badge
- Amber notice if agreement not signed
- Section "Posting Sources" — one row per POSTING_SOURCES: checkbox, source name, External Job ID+URL if posted, error text if failed, status badge, per-source **Post** button, last-sync timestamp
- Footer buttons: Close; **Pause/Resume** toggle; **Close Posting**; **Post to all selected** (primary)

### A.10.2 Functions
- `togglePostingSource`, `postToSource` (blocked if agreement unsigned: "Cannot post — the client agreement is not Active yet."; TeamLink Job Portal always succeeds, others ~75% deterministic success; failure: "Provider rejected the posting (simulated) — retry or check credentials."), `postToAllSources` ("Select at least one posting source first." if none), `recomputePostingStatus`, `setPostingState`

## A.11 Offer, Joining/Hire, Interview functions

- **Schedule Interview modal**: Date*, Time (placeholder "3:00 PM"), Mode (Online/In-Person/Telephonic), Interviewer (RECRUITERS+TLS). Buttons Cancel; **Schedule**(primary). Validation: "Please pick a date."
- `recruiterDecision`, `bdeDecision`
- `completeInterview` — deterministic score 55-94; feedback text varies by score threshold; result Recommended/Not Recommended; toast "Interview result logged — score {score}%."
- `selectCandidate`, `extendOffer` (creates Draft offer; toast "Offer {id} created as Draft. Generate → Send from the Applications tab."), `advanceOffer` (strict sequencing, error "Offer must go {prev} → {expected} — no skipping."), `declineOffer` (native `prompt`, "A decline reason is required." if empty), `expireOffer`
- **Record Client Joining modal**: guards ("This is an internal TeamLink requirement — use Extend Offer / Move to Hired instead."; "Client joining already recorded for this application."); fields Joining Date*, Joining Location (default req location), Offered CTC (placeholder "₹14,00,000"), Employment Type (Full-time/Contract/Contract-to-Hire), Remarks; Buttons Cancel; **Confirm Client Joining**(primary); validation "Please enter a joining date."; generates invoice on confirm.
- `moveToHired` — guard "This is a client requirement — use Record Client Joining instead."; idempotency guard "Employee already created for this candidate ({id})."

## A.12 Recruiter & BDE / Team view (lines 7230–7239)

- Not available for client role: "Not available for your role" / "Recruiter & BDE workload is internal TeamLink information and isn't part of your client scope."
- Header "Recruiter & BDE", sub "Workload and assignment"
- Table columns: `Name`, `Role`, `Open Requirements`, `Active Pipeline`

## A.13 Interview Calendar (lines 7230–7340)

- Header "Interview Calendar", sub: "AI Interviews and Recruitment / Client Interviews are tracked separately — an AI score is never mixed with client interview feedback."
- Button **Schedule Interview** → toast-only no-op (directs user to open a candidate profile)
- Tabs: "Recruitment / Client Interviews ({n})", "AI Interviews ({n})"

### A.13.1 Recruitment/Client Interviews tab
- Note: "Lifecycle: Client Shortlisted → Schedule Interview → Interview Scheduled → Interview Completed → Selected / Rejected / Hold"
- Table columns: `Interview ID`, `Candidate`, `Requirement`, `Client`, `Type`, `Interviewer`, `Date`, `Time`, `Mode`, `Meeting / Location`, `Status`, `Result`, `Created By`

### A.13.2 AI Interviews tab
- Note: "Lifecycle: Required → Scheduled → Started → Completed → AI Score + Feedback. An expired AI interview never rejects the candidate."
- Table columns: `AI Interview ID`, `Candidate`, `Requirement`, `Status`, `Deadline`, `AI Score`, `AI Feedback`, `Actions`
- Actions (if Expired): **Extend Deadline**, **Resend**, **Manual Review**; else just **Resend**
- Footer notice: "An expired AI interview does not reject the candidate — the application stays in its current stage and can be extended, resent, or sent for manual review."

## A.14 Global Search results (lines 7341–7373)

- Header: `Search results for "{q}"`
- Searches: Candidates (name/id), Clients (name), Requirements (title/id), Invoices (id), Employees (name/id), Applications (id/offer id)
- Result cards, each with product tag chip (ATS/HRMS/Accounts); client & scoped roles get Invoices/Employees suppressed and other results filtered.

## A.15 Status badges (`statusBadge`) — full stage → CSS class map

`New`→new, `Recruiter Review`→review, `Recruiter Approved`→approved, `With BDE`→review, `BDE Approved`→approved, `Shared with Client`→review, `Client Review`→review, `Client Shortlisted`→shortlist, `Interview Scheduled`→interview, `Interview Completed`→interview, `Selected`→selected, `Offer`→offer, `Offer Accepted`→offer, `Joined`→joined, `Hired`→joined, `Rejected`→rejected, `Hold`→hold; unknown→new.

Other badge classes: agreement (active/rejected/pending), priority (High→rejected, Medium→review, Low→applied), sync status (connected, active/new).

## A.16 Sample/mock data (seed)

- **Clients:** 5 — Orbit Software Solutions (IT, Hyderabad, Active), Medivant Healthcare (Medical, Bengaluru, Active), Vertex Manufacturing (Manufacturing, Pune, Active), Skyline EduTech (Education, Hyderabad, Active), Alpine Financial Services (BDE, Bengaluru, Draft). IDs CLI-001…005. Fee % cycle [8.33,10,12.5,8.33,10].
- **Requirements:** 8 (REQ-2026-000001…000008) — Java Developer (Orbit), Backend Engineer Node.js (Vertex), React Frontend Developer (Skyline EduTech), DevOps Engineer (Medivant), Data Analyst (Alpine), SAP FICO Consultant (Medivant), Talent Acquisition Executive (internal/HR), Clinical Research Associate (Medivant). All status Open.
- **Candidates:** 12 (TL-CAND-000001…000012) with names, skills, locations, experience, resume scores, sources listed in full in the raw agent output (Ravi Kumar, Sneha Reddy, Arjun Nair, Priya Sharma, Karthik Iyer, Ananya Das, Vikram Rao, Divya Menon, Rahul Verma, Meena Pillai, Suresh Babu, Neha Kapoor).
- **Applications:** 12 (APP-2026-000001…000012), one per candidate, cycling through 12 different stages; AI-interview status cycles every 4 candidates; deterministic rejection reasons.

## A.17 Other interactive behaviors

- Hash-based routing throughout, no page reload.
- No pagination anywhere in ATS.
- No sortable column headers (fixed sorts only).
- No CSV/export or print anywhere in ATS module itself.
- No drag-and-drop (button-driven stage changes, not kanban).
- Dynamic add/remove rows: "+ Add Contact" in Add Client modal.
- Live-updating previews: Agreement Template Preview, Add Requirement's agreement info.
- Deterministic "randomness" via seeded `detBool`/`detInt` helpers (not `Math.random()`).
- Native browser `prompt()` used only in `declineOffer`.
- Audit logging (`logAudit`) on virtually every state-changing action.

---

# SECTION B — ACCOUNTS MODULE

## B.0 Router / module dispatch

- B.0.1 `renderAccounts(mod, id)` dispatches: `dashboard`→`accountsDashboard()`; `office`→`officeView()`; `invoices`→list or `invoiceDetail(id)`; `bank`→`bankView()`; default→dashboard.
- B.0.2 Sidebar nav group `accounts`: Dashboard, Office / Business, Invoices, Bank & Reconciliation. Shown only if `p.seeAccounts`.
- B.0.3 Admin "About/Modules" catalog entry: features listed as `['Accounts Dashboard','Office & Expenses','Invoices','Bank & Reconciliation']` (note: "Office & Expenses" differs verbatim from the nav label "Office / Business" — a naming inconsistency present in the reference itself).
- B.0.4 Access control: `seeAccounts = all || (userRec ? userRec.accountsRole!=='No Access' : role==='Accountant')`.

## B.1 Accounts Dashboard (`#/accounts/dashboard`)

- B.1.1 Header "Accounts Dashboard", sub "Receivables overview"
- B.1.2 KPI stat bar (4 cards):
  - "Collected": `₹{(paid/100000).toFixed(1)}L` where paid = sum of Paid invoices
  - "Pending": `₹{(pending/100000).toFixed(1)}L` where pending = sum of Pending invoices
  - "Overdue invoices": count of Overdue invoices
  - "Unmatched transactions": count of unmatched bank transactions
- B.1.3 Card "Recent invoices" — table columns: `Invoice`, `Client`, `Amount`, `Status`; rows = first 6 invoices, row-click to detail
- B.1.4 Card "By client" — KV list, one row per client with nonzero total invoiced (all statuses)

## B.2 Office / Business (`#/accounts/office`)

- B.2.1 Header "Office / Business", sub "Operating expenses & office overheads"
- B.2.2 Button **Add Expense** → `toast('Expense entry simulated.')` — no modal, no state change
- B.2.3 Table columns: `Category`, `Location`, `Monthly`
- B.2.4 Hard-coded static rows (no add/edit/delete): Office Rent/Hyderabad/₹85,000; Office Rent/Bengaluru/₹1,10,000; Utilities/Hyderabad/₹18,000; Software Subscriptions/All/₹22,000

## B.3 Invoices (`#/accounts/invoices`)

- B.3.1 Header "Invoices", sub = live count
- B.3.2 Filter `#invStatus`: "All statuses", Paid, Pending, Overdue
- B.3.3 Filter `#invClient`: "All clients" + every client name
- B.3.4 Filter logic: exact match on status AND client name — no free-text search box
- B.3.5 Table columns: `Invoice`, `Client`, `Candidate`, `Amount`, `GST`, `Status`
- B.3.6 Empty state: "No invoices match."
- B.3.7 No pagination, sorting, CSV export, or print on this screen.

## B.4 Invoice Detail (`#/accounts/invoices/{id}`)

- B.4.1 Not-found state: "Invoice not found"
- B.4.2 Breadcrumb "Accounts / Invoices / {id}" + separate "← Back to invoices" link
- B.4.3 Page head: invoice id, sub = client name (+id), status badge
- B.4.4 Card "Commercial trail — Client → Requirement → Candidate → Joining" — KV rows in order: Client, Requirement, Candidate, Application, Recruiter/BDE/TL, Joining Date, Invoice Date, Due Date, Offered CTC, Agreement Fee %, Fee Amount, GST, TDS, **Total Invoice Amount** (bold — note: this does NOT subtract TDS, unlike the bank-reconciliation `invoiceTotal()` formula which does), Payment Terms
- B.4.5 Conditional action (only if not Paid): **Mark as Paid** button (perm-gated) or muted permission text
- B.4.6 Card "Linked candidate journey" — 3 links: "View candidate in ATS →", "View requirement in ATS →", "View client in ATS →"
- B.4.7 `markInvoicePaid(id)`: guard "Already marked paid." if already Paid; effect: status→Paid, `logAudit('Invoice paid', id, 'Pending', 'Paid')` (hardcodes 'Pending' as prior value regardless of actual prior status — a bug/quirk present in the reference, worth flagging but must be reproduced as-is per "same behaviour" instruction unless told otherwise)

## B.5 Bank & Reconciliation (`#/accounts/bank`)

- B.5.1 Header comment: "Imported → Unmatched → Suggested Match → Matched → Reconciled. Actions: Match · Manual Match · Unmatch · Ignore · Reconcile"
- B.5.2 `BANK_STATES`: `['Imported','Unmatched','Suggested Match','Matched','Reconciled','Ignored']`
- B.5.3 Header "Bank & Reconciliation", sub = live counts per state: "{n} unmatched · {n} suggested · {n} matched · {n} reconciled"
- B.5.4 Button **Import Transactions** → `importBankTransactions()` (simulated, toast "Bank import simulated — no new transactions in the demo statement.", no data added)
- B.5.5 Table — 15 columns: `Transaction ID`, `Bank`, `Transaction Date`, `Value Date`, `Description`, `Amount`, `Dr/Cr`, `Client`, `Invoice`, `Match Status`, `Difference`, `Matched By`, `Matched Date`, `Reconciliation Status`, `Actions`
- B.5.6 Auto-suggestion logic: `suggestInvoiceFor(t)` — only for Credit transactions, matches to the open invoice whose net-of-TDS total (`invoiceTotal = amount+gst-tds`) is within 2% of the transaction amount
- B.5.7 Actions per row (permission-gated, `hasPerm('invoices','approve')`):
  - Ignored → **Restore**
  - Reconciled → no actions
  - Matched → **Reconcile** (primary), **Unmatch**
  - Unmatched/Imported → **Match** (primary, only if a suggestion exists), **Manual Match** (always), **Ignore** (always)
- B.5.8 Empty state: "No bank transactions imported."
- B.5.9 Footer notice: "Imported → Unmatched → Suggested Match → Matched → Reconciled. A suggestion appears only when a credit is within 2% of an open invoice total; matching is never applied automatically."
- B.5.10 Action handler messages (verbatim toasts/errors):
  - `bankApplyMatch`: "Pick an invoice to match against." (err, no invoice); "That invoice is already reconciled against another transaction." (err); success toast "Matched to {invId} — now reconcile to close it off."
  - `bankMatch`: "No confident suggestion — use Manual Match." (warn, if none)
  - `bankManualMatch`: "No invoices available to match." (err, if none open) — else opens Manual Match modal
  - `bankUnmatch`: toast "Unmatched — the invoice is open again."
  - `bankReconcile`: "Match the transaction to an invoice before reconciling." (err); "Already reconciled." (warn); success toast "Reconciled — {invId} marked Paid." (or "Reconciled." if no linked invoice) — sets invoice status→Paid
  - `bankIgnore`: toast "Ignored — it stays on file and can be restored."
  - `bankUnignore`: **no permission gate** (only action in this module without one); toast "Restored."

## B.6 Modals

### B.6.1 Manual Match modal
- Header "Manual Match — {transaction id}"
- Read-only: Amount, Description
- Field: **Match to invoice** select — options = every open invoice as `"{id} — {client} — ₹{netTotal} ({status})"`
- Buttons: Cancel; **Match** (primary) → `confirmManualMatch`

(No other modals in Accounts — Add Expense and Import Transactions are both single-click, no-form simulated actions.)

## B.7 Status badges

- Invoice: Paid→active(teal), Overdue→rejected(red), Pending→pending(amber) — displayed text is the literal status word
- Bank Match Status: Reconciled→active(teal), Matched→matched(teal), Ignored→rejected(red), Unmatched/Suggested Match→pending(amber)

## B.8 Search

- No free-text search box anywhere in Accounts. Only the two exact-match dropdowns on the Invoices list (status, client).
- (A separate global cross-module search elsewhere in the app does include invoices by id/client, with an "Accounts" product tag — noted for cross-reference, not part of the in-module UI.)

## B.9 Sample/mock data

- B.9.1 Base seed invoices generated per seeded application at stage "Joined": `amount = 120000 + i*15000`, `gst = round(amount*0.18)`, `tds = round(amount*0.1)`, first one Paid, rest Pending; id format `INV-2026-######`.
- B.9.2 One explicit hard-coded extra invoice: Skyline EduTech / Ramesh Chandra, joining 20 Aug 2026, invoice 26 Aug 2026, due 01 Sep 2026, amount ₹165,000, GST ₹29,700, TDS ₹16,500, status **Overdue**.
- B.9.3 Invoices also created live at runtime on ATS "Client Joining" confirmation (fee % defaults to client's rate or 8.33%).
- B.9.4 Bank transactions — 5 seeded rows, bank "HDFC Bank" throughout: (1) 05 Sep 2026, NEFT-Orbit, ₹141,600 credit, pre-reconciled; (2) 08 Sep 2026, NEFT credit deliberately ₹200 under an open invoice total (to trigger the 2%-suggestion); (3) 10 Sep 2026, Office Rent debit ₹85,000; (4) 12 Sep 2026, Payroll Disbursement debit ₹980,000; (5) 15 Sep 2026, "Unidentified Credit" ₹45,000 (deliberately unmatched to anything).

## B.10 Accounts KPI shown on the shared Dashboard (outside `renderAccounts`)

- B.10.1 Admin/Super Admin dashboard: conditional 6th stat tile "Overdue invoices" (only if `seeAccounts`).
- B.10.2 Accountant-role home dashboard (distinct screen, `dashboardAccountant()`):
  - Header "Dashboard", sub "Welcome back, {name} · Accountant"
  - Stat bar: "Client joinings recorded", "Invoices", "Pending payments", "Overdue", "Unreconciled transactions"
  - Card "Invoices needing attention" — table columns `Invoice`, `Client`, `Amount`, `Status`; rows = Pending+Overdue, first 8; empty state "Nothing pending."
  - Card "Unreconciled bank transactions" — KV list; empty state "All caught up."

## B.11 Permissions model

- `PERM_ACTIONS`: view/create/edit/delete/approve/export/share/configure/scope
- All Accounts actions gated on the single `invoices` permission module's `approve` action (no separate `bank` module) — except CSV export, gated on `export`.
- Default grants: Super Admin/Admin full; Manager view+export+scope only (no approve → cannot mark paid/do bank actions); Assistant Manager/STL/TL/Recruiter/BDE/Client/Employee = none; Accountant = view/create/edit/approve/export/scope (full working access, no delete/share/configure).
- `denyToast()` message: "Access restricted — you don't have permission to perform this action."

## B.12 Export / print / pagination / sorting

- None inside the core Accounts screens (Dashboard, Office, Invoices, Bank).
- A CSV export exists on the separate "Accounts Reports" screen (`#/reports/accounts`, part of the shared Reports module) — client filter dropdown + Apply/Clear + **Export CSV** button (perm-gated) with columns `Client`, `Invoiced`, `Paid`, `Pending`. Noted here as a cross-reference since it's receivables data, but it lives in the Reports module.

---

# SECTION C — JOB PORTAL INTEGRATION

## C.0 Relationship to the actual Job Portal

- C.0.1 Verbatim header comment: "TEAMLINK.ENTERPRISE — internal prototype (HRMS + ATS + Accounts). Application 2 of 2. Separate app from the TeamLink Job Portal. Talks to the Job Portal only through a simulated integration layer (Administration > Integrations). If this page and the Job Portal are opened from the same browser storage origin, 'Sync Now' will pull real data from the Job Portal's local storage; otherwise it uses a realistic seeded snapshot so every screen still demonstrates the full flow. All data is mock/local. No production backend."
- C.0.2 There is a genuinely separate public Job Portal HTML prototype file (`teamlink-job-portal.html` / `teamlink-job-portal-updated.html`) in the Downloads folder that was **not** read for this inventory since the user's message referenced only `teamlink-enterprise_56.html`. **Flagging this explicitly: if the public-facing candidate/job-board site itself also needs to be rebuilt (not just its integration surface within Enterprise), that is a separate, additional inventory pass against that other file — please confirm whether that's in scope before "go."**
- C.0.3 Constants: `JOB_PORTAL_KEY = 'tl_job_portal_state_v1'`; `ENT_KEY = 'tl_enterprise_state_v1'`; `JOB_PORTAL_URL = 'teamlink-job-portal.html'` (same-folder relative path placeholder).

## C.1 State shape

- `state.syncLog: []` — `{date, entity, status, reason?}`
- `state.integration: {status:'Connected', lastSync:'17 Sep 2026 · 09:12', mode:'seeded'}` (gains `lastSyncResult`, `mode:'live'` at runtime)
- `state.mappingQueue` (lazy-init) — row shape `{id, jobPortalJobId, jobTitle, source, applicationCount, dateReceived, status, applications:[], sampleSkills, sampleLocation, suggestedRequirementId?, mappedTo?}`
- `state.integrations` (plural — the separate generic Integration Catalog state, distinct object)
- Seeded Job-Portal-sourced candidates: Ravi Kumar (score 88), Sneha Reddy (82), Rahul Verma (66), Neha Kapoor (75). Other sources: Naukri, LinkedIn, Indeed, TeamLink Website.

## C.2 Needs Mapping queue engine

- C.2.1 `mappingQueue()` — get/create.
- C.2.2 `queueNeedsMapping(a, cand)` — finds/creates row keyed by `jobPortalJobId`; dedups applications; recalculates suggestion each time.
- C.2.3 `suggestRequirementFor(row)` — scoring: +2 per matching title word (len>3), +1 per matching skill; returns null if score stays 0. Comment: "Suggest the closest existing requirement by title/skill overlap — suggestion only, never applied automatically."
- C.2.4 `mappingQueuePanel()` — renders nothing if no rows are "Needs Mapping".
- C.2.5 `openQueueMapModal(rowId)` — opens modal (see C.5).
- C.2.6 `confirmQueueMap(rowId)` — validation "Pick a requirement first." if missing; on success: maps, logs audit, toast `Mapped to "{title}". Run Sync to import its {n} application(s).`
- C.2.7 `createDraftFromQueue(rowId)` — builds new Draft requirement (never auto-activated) with defaults: client 'TeamLink Website', department 'IT', location from row or 'Hyderabad', workMode 'Hybrid', priority 'Medium', openings 1, recruiter/tl/bde from first seeded entries, employmentType 'Full Time', joiningTimeline 'Within 30 Days', education 'Any Degree'; toast "Draft requirement created — it is NOT active or posted. Complete and activate it first."; navigates to new requirement.
- C.2.8 `archiveQueueRow(rowId)` — sets Archived; toast "Archived — it will not be offered for mapping again."

## C.3 Sync mechanics

- C.3.1 `tryReadJobPortal()` — reads `localStorage[JOB_PORTAL_KEY]`, safely parsed.
- C.3.2 `syncNow()` — disables button, text→"Syncing…", status cell→"Syncing…" badge, then 350ms delayed `doSync()` (comment: "brief, honest delay so 'Syncing…' is visibly real, not instantaneous").
- C.3.3 `mergeJobPortalSnapshot(jp)` — shared merge used by both the Sync button and the postMessage real-time channel:
  - Candidates: dedup by jobPortalId or email; new → creates `TL-CAND-######` with `source:'Job Portal'`, `syncStatus:'Synced'`, `jobPortalLinked:true`, logs a `syncLog` Success entry; existing → updates skills/experience.
  - Applications: dedup by `jobPortalAppId`; finds/creates matching requirement by `jobPortalJobId` (never creates a duplicate requirement for the same job — stable dedup key); if no requirement and no matching job data either → routes into Needs Mapping queue instead of creating anything (comment: "an unmapped Job Portal job must never appear as a normal active requirement in the pipeline"), logs syncLog "Needs Mapping" entry with reason; otherwise creates application with status 'New', full stage history seed; existing applications get AI-interview/resume score fields refreshed on repeat syncs.
- C.3.4 Real-time channel — `window.addEventListener('message', ...)` guarded on `data.source==='teamlink-job-portal' && data.type==='SNAPSHOT'`; sets `jobPortalRealtimeActive=true`; calls `mergeJobPortalSnapshot`; updates integration state to `mode:'live'`; logs audit "Real-time update received from Job Portal"; toast `Live update from Job Portal — {n} new candidate(s), {n} new application(s).`; auto-refreshes the screen if currently viewing Integrations.
- C.3.5 `doSync()` — orchestrates read+merge+state update; toast `Sync complete — {n} new candidate(s), {n} new application(s), {n} updated.`
- C.3.6 `retrySync(idx)` — flips a Failed syncLog row back to Success; toast "Retry succeeded."
- C.3.7 `pushStatusToJobPortal(app)` — writes the Enterprise application's status back into the Job Portal's own localStorage via a stage→status lookup table (New→Applied, Recruiter Review→Recruiter Review, With BDE→Shared with Client, Selected→Selected, Hired→Joined, etc.) — **flagging an internal inconsistency in the reference itself**: the Integration Configuration modal (C.6.5) claims "Sync direction: Job Portal → Enterprise (one-way, by design)" while this function demonstrably writes status back into the Job Portal's storage. Recommend preserving this exact (inconsistent) behavior unless told to fix it, since the instructions say "same behaviour... no item may be improved."

## C.4 Needs Mapping panel UI (shown atop ATS Requirements list — cross-referenced from Section A.3, included again here for completeness since it's core integration UI)

- Renders only when ≥1 row is "Needs Mapping"
- Heading: "Needs Mapping {count badge}"
- Explanatory text: "These Job Portal jobs have no matching Enterprise requirement. They are not live requirements and their applications stay parked until you map or create one."
- Table columns: `Job Portal Job ID`, `Job Title`, `Source`, `Applications`, `Date Received`, `Mapping Status`, `Suggested Requirement`, `Actions`
- Row buttons: **Map to Existing**, **Create New (Draft)**, **Ignore / Archive**

## C.5 Map-to-existing modal

- Title "Map — {jobTitle}"; KV: Job Portal Job ID, Applications waiting
- Field: **Map to existing requirement** select (every non-needs-mapping requirement as "{title} — {client}"), pre-selects suggestion
- Conditional notice: "A suggestion is pre-selected based on title and skill overlap — confirm or change it."
- Buttons: Cancel; **Map & Import Applications** (primary)

## C.6 Administration → Integrations tab

- C.6.1 Page head "Integrations", sub "Every outside channel the platform talks to — messaging, email, calling, scheduling, job boards, storage, finance and developer access."
- C.6.2 **Generic Integration Catalog** (precedes the Job Portal card on the same page) — grouped by: Messaging, Email, Calling, Scheduling, Job Boards, Storage, Finance, Workforce, Developer. Full catalog of 17 channels, each with id/name/description/fields — verbatim list:
  1. WhatsApp Business — phone number, WhatsApp Business ID, Permanent access token, Template namespace
  2. SMS Gateway — Provider, Sender ID (6 chars), API key, DLT template ID
  3. Email (SMTP) — SMTP host, Port(587), From address, Username, Password/app key
  4. Shared Inbox (IMAP) — IMAP host, Port(993), Mailbox address, Password/app key
  5. Cloud Telephony/IVR — Provider, Account SID, Auth token, Caller ID number, Recording storage URL
  6. Click-to-Call Widget — Agent extension prefix, Default country code(+91)
  7. Video Interviews — Provider(Meet/Zoom/Teams), Client ID, Client secret
  8. Calendar Sync — Provider(Google/Outlook), Client ID, Client secret, Default calendar
  9. Naukri — Recruiter account email, API key
  10. LinkedIn Recruiter — Organization ID, Client ID, Client secret
  11. Document Storage — Provider(S3/Drive), Bucket/folder, Access key, Secret key
  12. e-Signature — Provider, API key
  13. Tally/Accounting — Company name in Tally, Connector URL, Sync frequency(Daily)
  14. Payment Gateway — Provider, Key ID, Key secret, Webhook secret
  15. Biometric/Attendance Device — Device vendor, Device/site ID, Sync endpoint
  16. Webhooks — Endpoint URL, Signing secret, Events(default "candidate.joined, invoice.paid")
  17. REST API Access — Key label, Allowed IP range, Scope(default "read")
  - Per-channel buttons: **Enable/Disable**, **Configure →**(primary); status pill Connected/Not connected
  - `intgConfigure` modal: per-field text inputs, notice "Configuration only — this prototype never contacts the provider."; footer Cancel, **Save & Connect**
  - Validation: "Enter at least one credential to connect this channel." if all fields empty
  - Note: this catalog's own "Job Boards" group (Naukri, LinkedIn) is a *separate*, generic simulated channel, not linked in code to the actual Job Portal integration below.
- C.6.3 **Job Portal section** (the actual integration core):
  - KV rows: Connection (dot+status), Last Sync, Sync Status (badge), Candidates Synced (formula), Applications Synced (formula), Requirements Synced (formula), Requirements Needing Mapping (formula), Failed Records (formula), Mode (computed live/seeded text), Real-time channel (active/not-active text)
  - Buttons: **Sync**(primary), **Open Job Portal ↗**, **Test Connection**, **Configure**
  - Fallback link block (hidden by default, shown on popup-block): "Pop-ups appear to be blocked. Use this link instead: Open TeamLink Job Portal ↗"
  - Bottom notice (long, verbatim — see raw agent output C.6.3 for full text) explaining Sync vs Open Job Portal vs real-time channel behavior
- C.6.4 **Sync Logs table**: columns `Date`, `Entity`, `Status`, `Reason`, (blank action column); Retry button on Failed rows
- C.6.5 Integration Configuration modal (`openIntegrationConfigModal`): informational only, no fields — KV: Connection type, Sync direction, Duplicate protection, Sync frequency; single **Close** button
- C.6.6 Supporting functions: `openJobPortal()` (popup with fallback handling), `testConnection()` (toast pass/fail), `showJobPortalFallbackLink()`

## C.7 Job Portal Connection dashboard cards

- C.7.1 Shared/general dashboard card: title "Job Portal Connection", KV Status/Last sync, link "Manage integration →"
- C.7.2 ATS dashboard card: title "Job Portal Integration", KV Connection/Last Sync/Candidates Synced, conditional Needs Mapping badge, buttons Sync/Open Job Portal, link "Full integration details →"

## C.8 Job Portal Reports (`#/reports/portal`)

- Page head "Job Portal Reports", sub "From the connected Job Portal (via integration)"
- KPI stat bar (4 cards): "Registrations synced", "Applications synced", "From Naukri", "From LinkedIn" — each with exact formula
- Table columns: `Source`, `Candidates` — fixed source list: Job Portal, Naukri, Indeed, LinkedIn, TeamLink Website
- No filter, no CSV export, no pagination on this specific report (unlike ATS/Accounts Reports which do have these)

## C.9 Status badges

- Sync Status "Syncing…" → review(amber); "Connected"/"Synced" → active(teal); Sync Log Success → active(teal), Failed → rejected(red)
- Needs Mapping count badge → rejected(red)
- Integration Catalog Connected → active(teal), Not connected → pending(amber)
- Connection dots: `.conn-dot.ok` teal, `.conn-dot.fail` red

## C.10 Interactive mechanics

- No CSV export, pagination, or sorting anywhere in the Job Portal integration screens.
- Cross-tab sync: (1) pull/manual via `syncNow()`→`doSync()` reading `localStorage` synchronously; (2) push/real-time via `postMessage` listener, active only after `openJobPortal()` was used to open the portal tab. No BroadcastChannel used.
- `pushStatusToJobPortal` writes status back into the portal's localStorage (see the one-way/two-way inconsistency flagged in C.3.7).
- No `window.print()` calls anywhere in this surface.

---

# OPEN QUESTIONS BEFORE "GO"

1. **Separate public Job Portal file** (C.0.2) — `teamlink-job-portal.html` / `teamlink-job-portal-updated.html` exist in Downloads but were not inventoried here since only `teamlink-enterprise_56.html` was referenced. Confirm whether the actual candidate-facing Job Portal site is also in scope, or whether "Job Portal" here means only the integration surface documented in Section C.
2. **Destination folder** — STEP 2 says "Rebuild it inside [destination] using the suite shell from COMMON/." This repo's structure (`backend/`, `frontend/` with HRMS+ATS+Accounts already merged into one app under `main`) doesn't currently have a `COMMON/` shell or separate per-product folders in that shape. Please confirm the intended destination path/structure before build starts, since it doesn't match the existing repo layout 1:1.
3. **Known inconsistencies in the reference itself** (B.4.7, B.0.3, C.3.7) — flagged above. Since the instructions say "same behaviour... no item may be improved," should these be reproduced exactly as-is (bugs included), or corrected?

---

**STATUS: Awaiting "go" to proceed to STEP 2 (build). No code has been written yet.**
