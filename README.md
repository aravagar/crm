# Studioforma CRM

A web app that tracks a Studioforma modular furniture project through one continuous pipeline, from the first sales inquiry all the way to dispatch, using a fixed, editable stage list instead of free-text status notes.

**Live site:** https://aravagar.github.io/crm/

---

## What this project does

Studioforma is a modular furniture manufacturer. Before this tool, project status lived in two disconnected places: a Lead Tracker sheet where the current stage was free text (so the same stage got written a dozen different ways), and a separate production process tracked informally over WhatsApp and paper notes. There was no single place to answer "where is this project right now?" and no reliable record of when a project moved or who moved it.

This app puts the whole journey in one place:

- A dashboard that groups every project by stage, so you can see the entire pipeline at a glance.
- Search by client name and filter by project type for instant lookup when a client calls.
- Each project holds a list of items (wardrobe, doors, wall panels...) with specifications, quantity, and price per unit, and shows a computed total.
- Stage movement is a one-click Advance, a Move Back (with a required reason), or Mark as Lost (with a reason), and every move is logged with who did it, when, and why.
- A one-tap status summary the team can send to a client over WhatsApp, copy, or print. The internal delivery date and full timeline are opt-in, never shared by default.
- Editable stage and team lists, so the tool matches the language the team actually uses.
- JSON export and import for backup and moving data between devices.

Data is stored in the browser (localStorage), so it persists across refreshes on the same machine.

---

## How to use it

1. Open the live site: https://aravagar.github.io/crm/
2. **Add a project:** click **+ Add Project**, fill in the client name (the only required field), add one or more items with quantity and price, and save. The project appears on the dashboard under its starting stage.
3. **Move a project:** click any project card to open it, then use **Advance** to move it forward one stage, **Back** to return it one stage (with a reason), or **Mark as Lost** (available before an order is won). Every move is timestamped and attributed.
4. **Look up a project:** type a client name in the search box on the dashboard, or filter by project type.
5. **Share status with a client:** open a project and use **Send on WhatsApp**, **Copy status summary**, or **Print status**. Tick "include delivery date" or "include full timeline" only if you want those in the message.
6. **Edit a project:** open it and click **Edit** to change details or items.
7. **Manage stages and team:** click **Settings** to rename, reorder, add, or remove stages, and to manage the list of team members shown in the "who moved it" picker.
8. **Back up your data:** in Settings, use **Export backup** to download a JSON file, and **Import backup** to load it (on this or another device).

---

## Tech

Plain HTML, CSS, and JavaScript, no framework and no build step. Data persists in the browser via localStorage. Deployed as a static site on GitHub Pages.

```
crm/
├── index.html
├── css/
│   └── styles.css
├── js/
│   ├── store.js   (data layer: all localStorage reads/writes, stages, projects)
│   └── app.js     (rendering and event handling for every view)
├── PROPOSAL.md
├── PRD.md
└── README.md
```

The data layer is deliberately isolated in `store.js`, so the storage backend could later be swapped for a shared database (Supabase) without changing the interface code.

---

## Known limitations

- Data lives in one browser on one machine. Use Export/Import to move or back it up. A shared multi-device backend is a planned future enhancement.
- Import replaces all current data; it does not merge two devices.
