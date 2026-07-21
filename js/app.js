/* ============================================================
   app.js - rendering and event handling.
   Step 2: stage-grouped dashboard + add-project form.
   The app is a tiny state machine: currentView decides what
   render() draws inside <main id="app">.
   ============================================================ */

const appEl = document.getElementById("app");
let db = loadData();
let currentView = "dashboard"; // "dashboard" | "add"  (step 3 adds "detail")

/* ---------- tiny helpers ---------- */

/* User-typed text goes through this before touching innerHTML,
   so a client name like <b>Sharma</b> renders as text instead
   of becoming HTML. */
function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric"
  });
}

/* ---------- veneer strip (signature element) ----------
   A segmented bar, one segment per stage, filled up to the
   project's current position. Reads like plywood layers. */
function veneerStrip(project) {
  const ordered = getStagesInOrder(db);
  const idx = ordered.findIndex(s => s.id === project.stageId);
  const segments = ordered.map((s, i) => {
    let cls = "seg";
    if (i <= idx) cls += " filled";
    if (project.status === "lost") cls += " lost";
    return `<span class="${cls}" title="${escapeHtml(s.name)}"></span>`;
  }).join("");
  return `<div class="veneer" aria-hidden="true">${segments}</div>`;
}

/* ---------- project card ---------- */
function projectCard(p) {
  const stage = getStageById(db, p.stageId);
  return `
    <article class="project-card" data-id="${p.id}">
      <div class="card-top">
        <span class="client">${escapeHtml(p.clientName)}</span>
        <span class="chip">${escapeHtml(stage ? stage.name : "?")}</span>
      </div>
      ${p.productNeeded ? `<p class="product muted">${escapeHtml(p.productNeeded)}</p>` : ""}
      ${veneerStrip(p)}
    </article>
  `;
}

/* ---------- dashboard view ---------- */
function renderDashboard() {
  const ordered = getStagesInOrder(db);
  const active = db.projects.filter(p => p.status === "active");
  const lost = db.projects.filter(p => p.status === "lost");
  const dispatched = db.projects.filter(p => p.status === "dispatched");

  if (db.projects.length === 0) {
    appEl.innerHTML = `
      <section class="empty card">
        <h1>No projects yet</h1>
        <p class="muted">Add your first project to start the pipeline.</p>
        <button class="btn primary" id="empty-add">+ Add Project</button>
      </section>
    `;
    document.getElementById("empty-add").addEventListener("click", () => go("add"));
    return;
  }

  const groups = ordered.map(stage => {
    const inStage = active.filter(p => p.stageId === stage.id);
    if (inStage.length === 0) return ""; // hide empty stages to keep the scan tight
    return `
      <section class="stage-group" data-phase="${stage.phase}">
        <h2 class="stage-head">
          ${escapeHtml(stage.name)}
          <span class="count">${inStage.length}</span>
        </h2>
        <div class="cards">${inStage.map(projectCard).join("")}</div>
      </section>
    `;
  }).join("");

  appEl.innerHTML = `
    <div class="dash-summary muted">
      ${active.length} active · ${dispatched.length} dispatched · ${lost.length} lost
    </div>
    ${groups || `<p class="muted">No active projects. Check the sections below.</p>`}
    ${dispatched.length ? collapsedSection("Dispatched", dispatched) : ""}
    ${lost.length ? collapsedSection("Lost", lost) : ""}
  `;
}

function collapsedSection(title, projects) {
  return `
    <details class="terminal-section">
      <summary>${title} <span class="count">${projects.length}</span></summary>
      <div class="cards">${projects.map(projectCard).join("")}</div>
    </details>
  `;
}

/* ---------- add-project view ---------- */
function renderAddForm() {
  const ordered = getStagesInOrder(db);
  const personOptions = db.team.map(name =>
    `<option ${name === db.lastUsedPerson ? "selected" : ""}>${escapeHtml(name)}</option>`
  ).join("");

  appEl.innerHTML = `
    <section class="card form-card">
      <h1>Add project</h1>
      <div class="form-grid">
        <label>Client name *
          <input id="f-client" type="text" autocomplete="off">
        </label>
        <label>Contact number
          <input id="f-contact" type="tel" placeholder="10-digit or 91XXXXXXXXXX">
        </label>
        <label>Project type
          <input id="f-type" type="text" placeholder="Residential, Office, Retail...">
        </label>
        <label>Product needed
          <input id="f-product" type="text" placeholder="Wardrobe, modular kitchen, wall panels...">
        </label>
        <label>Estimated value (Rs)
          <input id="f-value" type="number" min="0">
        </label>
        <label>Expected delivery <span class="tag-internal">internal</span>
          <input id="f-delivery" type="date">
        </label>
        <label>Starting stage
          <select id="f-stage">
            ${ordered.map((s, i) =>
              `<option value="${s.id}" ${i === 0 ? "selected" : ""}>${escapeHtml(s.name)}</option>`
            ).join("")}
          </select>
        </label>
        <label>Added by
          <select id="f-person">${personOptions}</select>
        </label>
        <label class="span2">First note (optional)
          <textarea id="f-note" rows="2"></textarea>
        </label>
      </div>
      <p id="form-error" class="form-error" hidden></p>
      <div class="form-actions">
        <button class="btn ghost" id="f-cancel">Cancel</button>
        <button class="btn primary" id="f-save">Save project</button>
      </div>
    </section>
  `;

  document.getElementById("f-cancel").addEventListener("click", () => go("dashboard"));
  document.getElementById("f-save").addEventListener("click", saveNewProject);
}

function saveNewProject() {
  const clientName = document.getElementById("f-client").value.trim();
  const errEl = document.getElementById("form-error");

  if (!clientName) {
    errEl.textContent = "Client name is required.";
    errEl.hidden = false;
    return;
  }

  const person = document.getElementById("f-person").value;
  createProject(db, {
    clientName: clientName,
    contact: document.getElementById("f-contact").value,
    projectType: document.getElementById("f-type").value,
    productNeeded: document.getElementById("f-product").value,
    estimatedValue: document.getElementById("f-value").value,
    expectedDelivery: document.getElementById("f-delivery").value || null,
    stageId: document.getElementById("f-stage").value,
    person: person,
    initialNote: document.getElementById("f-note").value
  });
  setLastUsedPerson(db, person);
  go("dashboard");
}

/* ---------- routing ---------- */
function go(view) {
  currentView = view;
  render();
}

function render() {
  if (!storageAvailable()) showPersistWarning();
  if (currentView === "add") renderAddForm();
  else renderDashboard();
}

function showPersistWarning() {
  if (document.querySelector(".banner.warn")) return;
  const b = document.createElement("div");
  b.className = "banner warn";
  b.textContent = "This browser is blocking storage. Data will not survive a refresh.";
  document.body.insertBefore(b, appEl);
}

/* topbar navigation */
document.getElementById("nav-dashboard").addEventListener("click", () => go("dashboard"));
document.getElementById("nav-add").addEventListener("click", () => go("add"));

render();
