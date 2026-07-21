# PRD: Studioforma Lead Tracker

**Author:** Arav (Management Trainee, Realply Industries / Studioforma)
**Date:** 22 July 2026
**Status:** Final for MVP build (submission due 24 July 2026)

---

## Executive Summary

Studioforma Lead Tracker is a single-page web application that tracks every Studioforma project through one continuous pipeline, from first sales inquiry to dispatch. It replaces two disconnected views (a free-text Lead Tracker sheet and a separate production process tracked informally over WhatsApp and paper) with one dashboard, one managed stage list, and one searchable source of truth. The MVP is a client-side app (HTML/CSS/JS, localStorage persistence) deployed to a live URL, with JSON export/import as a manual backup and transfer mechanism. Shared multi-device sync via Supabase is explicitly a future enhancement.

## Problem Statement

Studioforma's Director, Abhiroop Agarwal, currently has no single place to answer "where is this project right now?" Leads live in a sheet where "Current Stage" is free text, so the same stage is written a dozen different ways ("quote sent, following up" vs "Quote shared"). Production status after an order is won lives in a separate process, partly tracked over WhatsApp and paper notes. The result: status lookups require interpretation, chasing, or asking someone, and there is no reliable history of when a project moved between stages or who moved it.

## Objectives

1. Give Abhiroop one default screen that answers, within five seconds, "which orders are where in the pipeline" (operations visibility) and "what is the status of the project this client just called about" (fast lookup).
2. Enforce a consistent, managed stage vocabulary that matches the team's real language, editable without code changes.
3. Record a clean audit trail on every stage change: what happened, when, who did it, and (for backward moves and losses) why.
4. Make status communication to clients a one-tap action that fits Studioforma's WhatsApp-first workflow.

## Success Metrics

- **Course bar:** deployed URL loads, core feature works end to end, every part of the code is explainable in Q&A.
- **Real-world bar (check ~1 month post-handoff):** Abhiroop stops using the Excel/Sheets trackers for project status and uses this dashboard instead. Proxy signals: the free-text Lead Tracker sheet stops receiving updates; status questions on WhatsApp are answered with the copy-summary output from this tool.

## Target Users

- **Primary:** Abhiroop Agarwal, Director, Studioforma. Views the dashboard, looks up projects, advances stages, shares status with clients.
- **Secondary:** Studioforma team members (sales and production) who move projects through stages. No login system; identity is a name picked from a managed team list on each stage change.

## User Personas

**Abhiroop (Director).** Time-poor, phone-first, WhatsApp-native. Wants at-a-glance pipeline counts and instant lookup by client name. Frustrated by free-text stage chaos and having to ask people for status.

**Team member (sales or production).** Updates a project after a real-world event (meeting held, quote shared, carpentry done). Needs the update to take under ten seconds or it will not happen and WhatsApp wins again.

## Default Stage List

Sales stages are taken directly from the team's existing CRM vocabulary (screenshot provided by Arav). Production stages come from the existing production tracker, with Finishing renamed to Polishing per current usage.

| # | Stage | Phase |
|---|-------|-------|
| 1 | New Inquiry | Sales |
| 2 | Need 1st F2F Meeting | Sales |
| 3 | Factory Visit Done | Sales |
| 4 | Details Awaited for Quote | Sales |
| 5 | Quote Shared | Sales |
| 6 | Negotiation Done | Sales |
| 7 | Awaiting Confirmation | Sales |
| 8 | Advance Recd | Won boundary |
| 9 | Order Received | Production |
| 10 | Material Sourced | Production |
| 11 | Carpentry | Production |
| 12 | Painting | Production |
| 13 | Polishing | Production |
| 14 | Quality Check | Production |
| 15 | Packaging | Production |
| 16 | Dispatched | Terminal (success) |

**Lost** is a separate terminal state reachable from any stage before Advance Recd (stages 1 to 7). It is not part of the linear sequence.

This list is the shipped default only. Stage management lets Abhiroop rename, reorder, add, or remove stages without code changes.

## User Stories

1. As Abhiroop, I want a dashboard grouping all projects by stage with counts, so I can see the whole pipeline at a glance.
2. As Abhiroop, I want to search by client name and filter by project type, so I can answer a client call in seconds.
3. As a team member, I want to add a new project with client details and product needed, so every inquiry enters the pipeline immediately.
4. As a team member, I want an Advance button that moves a project to the next stage and records the time and my name, so history stays consistent without typing.
5. As a team member, I want a secondary Move Back action requiring a short reason, so revised quotes and rework are captured honestly.
6. As Abhiroop, I want to mark a pre-Won project as Lost with a reason, so dead leads leave the active pipeline but keep their history.
7. As Abhiroop, I want to open a project and see its details, internal delivery date, full stage history, and notes, in that order.
8. As Abhiroop, I want a Copy Status Summary button producing a clean WhatsApp-ready message, so I can update a client in one paste.
9. As Abhiroop, I want a print-friendly project status view, so I can hand a client a clean printed status sheet.
10. As Abhiroop, I want to manage the stage list and the team-member name list, so the tool matches how the team actually talks.
11. As Abhiroop, I want to export all data to a JSON file and import it on another device, so I have a backup and a manual transfer path.

## Functional Requirements

### FR1: Project creation
- Form fields: client name (required), contact number, project type, expected/committed delivery date (internal), initial stage (defaults to New Inquiry), initial note (optional), and an **items list**: each item has a name (e.g. Wardrobe, Door with frame), free-text specifications (size, material, finish), and its own value in rupees. Rows can be added and removed; blank rows are ignored on save. The form shows a live running total of all item values.
- Project value is always the computed sum of its item values, never a separately entered number.
- On save, project appears on the dashboard under its stage with a creation event in its history. Cards show an item summary and the total value.

### FR2: Dashboard (default screen)
- Projects grouped by stage in pipeline order, with a count per stage.
- Search box at the top filters by client name as you type.
- Filter control for project type.
- Lost and Dispatched projects live in collapsed/secondary sections so the active pipeline stays clean.

### FR3: Project detail view
Displayed in this exact order:
1. Basic details: client name, project type, product needed, estimated value, contact number.
2. Expected/committed delivery date, visually marked as **internal**.
3. Stage history: every event with stage, action type (advanced / moved back / lost / created), timestamp, and person.
4. Notes: an append-only note trail with timestamps.

### FR4: Stage movement
- **Advance:** primary button, moves the project exactly one stage forward in the managed sequence. Records timestamp and person (picked from team list, defaults to last-used name).
- **Move Back:** secondary, less prominent action. Moves exactly one stage backward. Requires a short reason. Logged identically plus reason.
- **Mark as Lost:** available only on projects in stages before Advance Recd. Requires a reason. Terminal.
- No arbitrary stage jumps in MVP.

### FR5: Stage management
- Screen to rename, reorder, add, and remove stages.
- Removing a stage that has projects in it requires choosing a destination stage for those projects.
- Existing history entries keep the stage name as it was at the time of the event (history is immutable).

### FR6: Team member management
- Simple managed list of names used by the "who moved it" picker. Add/remove names in settings.

### FR7: Client status sharing
- **Copy Status Summary:** one button on the project detail view generates a clean text block (client name, product, current stage in plain language, last update date) and copies it to clipboard, ready to paste into WhatsApp.
- **Send on WhatsApp (wa.me):** a button next to Copy Status Summary opens a WhatsApp click-to-chat link with the client's number and the status summary pre-filled: `https://wa.me/{number}?text={encoded summary}`. This is a plain URL, not an API; no key, no cost, no auto-send. A human always reviews the message in WhatsApp before sending, which matches the safe-send protocol. Requires the contact number stored in international format (91XXXXXXXXXX, no + or spaces); the form normalizes input to this format. If no contact number is saved, the button is hidden and only Copy is offered.
- **Print view:** a print-friendly rendering of the project status via a print stylesheet and `window.print()`.
- **Business rule:** neither output includes the committed delivery date by default. It appears only if deliberately toggled on for that share. Written date commitments to frustrated clients are high-risk and must be a conscious choice, never a default.

### FR8: Persistence and backup
- All data persists in `localStorage` under a single versioned key.
- **Export:** download all data as a JSON file.
- **Import:** load a JSON file, replacing current data after an explicit confirmation warning.
- Import is replace-only in MVP. No merging of concurrent edits from two devices.

## Non-Functional Requirements

- **Performance:** instant interactions at the expected scale (low hundreds of projects). No pagination needed in MVP.
- **Reliability:** app must never lose data on refresh; every write goes to localStorage immediately.
- **Usability:** phone-usable layout (Abhiroop is phone-first); search reachable without scrolling; stage update in under 10 seconds.
- **Accessibility:** semantic HTML, labeled form controls, sufficient contrast. No screen-reader audit in MVP.
- **Security/privacy:** all data stays on-device. No credentials, no API keys, no external data calls. Client contact data leaves the browser only via deliberate user actions: export, copy, or opening a wa.me link (which passes the number and message to WhatsApp on the user's own device).
- **Deployment:** static site on GitHub Pages at a public URL. No build step required.

## User Flows

**Flow 1, client calls (lookup):** Open app → type client name in search → tap project → read stage + history → tap Send on WhatsApp (opens WhatsApp with the summary pre-filled, review, send) or Copy Status Summary to paste manually. Target: under 30 seconds.

**Flow 2, stage update:** Open app → find project (search or dashboard group) → tap Advance → confirm name in picker → done. Timestamp recorded automatically.

**Flow 3, revised quote (backward move):** Project in Quote Shared → client asks for revision → tap Move Back → enters "client requested revised quote" as reason → project returns to Details Awaited for Quote, event logged.

**Flow 4, new inquiry:** Tap Add Project → fill client name and product needed at minimum → save → project appears under New Inquiry.

**Flow 5, device transfer:** Settings → Export JSON → send file to other device → open app there → Import JSON → confirm replace.

## Edge Cases

- Advancing from the last stage (Dispatched): Advance button hidden/disabled on terminal stages.
- Moving back from the first stage: Move Back hidden/disabled.
- Mark as Lost attempted on a post-Won project: control not shown from Advance Recd onward.
- Deleting a stage containing projects: forced reassignment dialog (FR5).
- Renamed stage vs old history: history keeps original names (FR5).
- Empty states: dashboard with zero projects shows a clear "Add your first project" prompt; empty search shows "no matches."
- localStorage unavailable (private browsing edge case): app shows a visible warning that data will not persist.
- Duplicate client names: allowed; projects are keyed by generated ID, never by name.
- Import of a malformed JSON file: validation fails safely with an error message, existing data untouched.

## Acceptance Criteria (MVP)

1. Adding a project with only a client name and product needed succeeds and shows on the dashboard.
2. Advancing a project records a history entry with correct stage, timestamp, and selected person.
3. Move Back requires a non-empty reason and logs it.
4. Mark as Lost is only offered pre-Advance-Recd and requires a reason.
5. Refreshing the browser loses nothing.
6. Search narrows the dashboard live as you type a client name.
7. Copy Status Summary places a correctly formatted message on the clipboard, excluding the delivery date unless toggled.
7a. Send on WhatsApp opens a wa.me link with the correct number and URL-encoded summary; the button is hidden when no contact number is stored.
8. Renaming a stage updates the dashboard immediately; prior history entries are unchanged.
9. Export then import on a clean browser reproduces the full dataset.
10. The live GitHub Pages URL loads and all of the above works there, not just locally.

## Technical Considerations

- **Stack:** vanilla HTML, CSS, JavaScript. No framework, no build step. This keeps every line explainable for the code-understanding grade and deploys directly to GitHub Pages.
- **Structure:** single `index.html`, one `styles.css` (plus print styles), one or a few small JS files (data layer, render layer, event handlers). Keep the data layer (all localStorage reads/writes) in one place so it can be swapped for Supabase later without touching UI code.
- **IDs:** `crypto.randomUUID()` for project IDs.
- **Dates:** store ISO strings, render in local format.
- **Print view:** `@media print` stylesheet plus `window.print()`. No PDF library.

## Data Requirements

```json
{
  "version": 1,
  "stages": [
    { "id": "stg_1", "name": "New Inquiry", "order": 1, "phase": "sales" }
  ],
  "team": ["Abhiroop", "Sanjay"],
  "projects": [
    {
      "id": "uuid",
      "clientName": "string (required)",
      "contact": "string",
      "projectType": "string",
      "items": [
        { "id": "uuid", "name": "Wardrobe", "specs": "7ft x 4ft, walnut veneer, matte PU", "value": 180000 }
      ],
      "expectedDelivery": "ISO date (internal)",
      "stageId": "stg_x",
      "status": "active | lost | dispatched",
      "createdAt": "ISO datetime",
      "history": [
        {
          "action": "created | advanced | moved_back | lost",
          "fromStage": "string (name at time of event)",
          "toStage": "string",
          "timestamp": "ISO datetime",
          "person": "string",
          "reason": "string (required for moved_back and lost)"
        }
      ],
      "notes": [
        { "text": "string", "timestamp": "ISO datetime" }
      ]
    }
  ]
}
```

## Risks & Assumptions

- **Assumption:** the screenshot stage names are current and complete for sales; production names match the tracker with Polishing replacing Finishing. Stage management exists precisely so mismatches are a settings change, not a rebuild.
- **Assumption:** the team will honestly select their name on stage changes; there is no authentication to enforce it.
- **Risk:** localStorage is per-browser. If Abhiroop opens the URL in a different browser or clears data, it is gone. Mitigation: export/import JSON, and a visible "last backup" nudge is a candidate post-MVP addition.
- **Risk:** two people using two devices will create two divergent datasets; import is replace-only. This is a known, stated MVP limitation, not a bug.
- **Risk (timeline):** submission is Friday 24 July. Build order below is sequenced so the app is demoable at every step.
- **Business risk carried from operating context:** written delivery date commitments to frustrated clients are high-risk, hence the default exclusion of dates from shared outputs.

## Out of Scope (MVP)

- Multi-device live sync, shared backend, Supabase.
- Login, authentication, permissions.
- Read-only shareable client links.
- WhatsApp API integration (copy-paste only).
- Editing or deleting history entries.
- Arbitrary stage jumps.
- Analytics (time-in-stage, conversion rates).
- Import merging.

## MVP Scope (build order for Friday)

1. Data layer + seed default stages/team → localStorage read/write proven.
2. Add-project form + dashboard grouped by stage. **App is demoable here.**
3. Project detail view with history and notes.
4. Advance / Move Back / Mark as Lost with person picker and reasons.
5. Search and project-type filter.
6. Copy Status Summary.
7. Stage management + team management.
8. Export/import JSON.
9. Print view.
10. Deploy check on GitHub Pages, mobile pass, README, weekly log.

If time runs out, items 7 to 9 degrade gracefully: the app still fulfills the core promise without them.

## Future Enhancements

- **Supabase backend** for shared, multi-device, multi-user data. This is the direct answer to "can it take in data from other users' devices," which localStorage cannot do. Key facts informing this choice:
  - The free tier fits this project indefinitely: 500 MB database (this dataset stays under 1 MB), 50,000 monthly active users, no credit card required.
  - Supabase's anon key is designed to be public in browser code (protected by Row Level Security rules), so it works from a static GitHub Pages site with no secret-key problem and no separate backend server.
  - Known caveat: free-tier projects pause after 7 days of inactivity and need a one-click restore in the Supabase dashboard (no data loss). Daily use by the team means this rarely triggers.
  - Migration path is already prepared: the data layer is isolated in one module (see Technical Considerations), so swapping localStorage reads/writes for Supabase queries does not touch UI code. Build only after MVP steps 1 to 6 are complete and deployed.
- Read-only client status links.
- Time-in-stage aging indicators ("stuck in Painting for 12 days") on the dashboard.
- Optional In Production sub-detail if the pipeline is ever re-collapsed.
- CSV export for accounting.
- Photo attachments per project (site photos, QC photos).

## Open Questions

1. Should "Advance Recd" remain the Won boundary, or does Abhiroop consider "Order Received" the true commitment point? Affects only where Mark as Lost stops being offered.
2. Does the team list need roles (sales vs production) to filter the person picker, or is a flat list fine?
3. Exact wording template for the WhatsApp status summary: confirm with Abhiroop after first demo.
