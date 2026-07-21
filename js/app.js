/* ============================================================
   app.js - rendering and event handling.
   Step 3: project detail view + multi-item projects.
   Views: dashboard | add | detail (detail needs a project id).
   ============================================================ */

const appEl = document.getElementById("app");
let db = loadData();
let currentView = "dashboard";
let currentProjectId = null;

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

function formatDateTime(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
    hour: "numeric", minute: "2-digit"
  });
}

function formatMoney(n) {
  if (!n) return "Rs 0";
  return "Rs " + Number(n).toLocaleString("en-IN");
}

/* ---------- veneer strip (signature element) ---------- */
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
function itemsSummary(p) {
  const items = p.items || [];
  if (items.length === 0) return "";
  const names = items.slice(0, 2).map(it => escapeHtml(it.name)).join(", ");
  const more = items.length > 2 ? ` +${items.length - 2} more` : "";
  return `${names}${more}`;
}

function projectCard(p) {
  const stage = getStageById(db, p.stageId);
  const total = projectTotal(p);
  return `
    <article class="project-card" data-id="${p.id}">
      <div class="card-top">
        <span class="client">${escapeHtml(p.clientName)}</span>
        <span class="chip">${escapeHtml(stage ? stage.name : "?")}</span>
      </div>
      <div class="card-mid">
        <p class="product muted">${itemsSummary(p)}</p>
        ${total ? `<span class="total">${formatMoney(total)}</span>` : ""}
      </div>
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
    if (inStage.length === 0) return "";
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

/* One editable item row. Rows are plain DOM; on save we read
   whatever rows exist. */
function itemRowHtml() {
  return `
    <div class="item-row">
      <input type="text" class="it-name" placeholder="Item (Wardrobe, Door with frame...)">
      <input type="text" class="it-specs" placeholder="Specifications (size, material, finish...)">
      <input type="number" class="it-value" placeholder="Value (Rs)" min="0">
      <button type="button" class="btn ghost it-remove" title="Remove item">&times;</button>
    </div>
  `;
}

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
      </div>

      <h2 class="section-head">Items</h2>
      <div id="item-rows">${itemRowHtml()}</div>
      <div class="items-footer">
        <button type="button" class="btn ghost" id="add-item-row">+ Add another item</button>
        <span class="items-total">Total: <strong id="items-total-val">Rs 0</strong></span>
      </div>

      <label class="note-label">First note (optional)
        <textarea id="f-note" rows="2"></textarea>
      </label>

      <p id="form-error" class="form-error" hidden></p>
      <div class="form-actions">
        <button class="btn ghost" id="f-cancel">Cancel</button>
        <button class="btn primary" id="f-save">Save project</button>
      </div>
    </section>
  `;

  const rowsEl = document.getElementById("item-rows");

  document.getElementById("add-item-row").addEventListener("click", () => {
    rowsEl.insertAdjacentHTML("beforeend", itemRowHtml());
  });

  // One listener on the container handles every row, present or future.
  rowsEl.addEventListener("click", e => {
    if (e.target.classList.contains("it-remove")) {
      e.target.closest(".item-row").remove();
      updateItemsTotal();
    }
  });
  rowsEl.addEventListener("input", e => {
    if (e.target.classList.contains("it-value")) updateItemsTotal();
  });

  document.getElementById("f-cancel").addEventListener("click", () => go("dashboard"));
  document.getElementById("f-save").addEventListener("click", saveNewProject);
}

function updateItemsTotal() {
  const values = [...document.querySelectorAll(".it-value")]
    .map(inp => Number(inp.value) || 0);
  const total = values.reduce((a, b) => a + b, 0);
  document.getElementById("items-total-val").textContent = formatMoney(total);
}

function readItemRows() {
  return [...document.querySelectorAll(".item-row")]
    .map(row => ({
      id: crypto.randomUUID(),
      name: row.querySelector(".it-name").value.trim(),
      specs: row.querySelector(".it-specs").value.trim(),
      value: Number(row.querySelector(".it-value").value) || 0
    }))
    .filter(it => it.name); // ignore blank rows
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
    items: readItemRows(),
    expectedDelivery: document.getElementById("f-delivery").value || null,
    stageId: document.getElementById("f-stage").value,
    person: person,
    initialNote: document.getElementById("f-note").value
  });
  setLastUsedPerson(db, person);
  go("dashboard");
}

/* ---------- detail view ----------
   Order mandated by PRD FR3: basic details, delivery date
   (internal), stage history, notes. */
function renderDetail() {
  const p = getProjectById(db, currentProjectId);
  if (!p) { go("dashboard"); return; }

  const stage = getStageById(db, p.stageId);
  const total = projectTotal(p);

  const itemRows = (p.items || []).map(it => `
    <tr>
      <td>${escapeHtml(it.name)}</td>
      <td class="muted">${escapeHtml(it.specs)}</td>
      <td class="num">${formatMoney(it.value)}</td>
    </tr>
  `).join("");

  const historyRows = [...p.history].reverse().map(h => `
    <li class="hist-item" data-action="${h.action}">
      <span class="hist-action">${historyLabel(h)}</span>
      <span class="hist-meta muted">
        ${formatDateTime(h.timestamp)}${h.person ? " · " + escapeHtml(h.person) : ""}
      </span>
      ${h.reason ? `<span class="hist-reason">"${escapeHtml(h.reason)}"</span>` : ""}
    </li>
  `).join("");

  const noteItems = [...p.notes].reverse().map(n => `
    <li class="note-item">
      <span>${escapeHtml(n.text)}</span>
      <span class="muted small">${formatDateTime(n.timestamp)}</span>
    </li>
  `).join("");

  appEl.innerHTML = `
    <button class="btn ghost back-btn" id="back-btn">&larr; Dashboard</button>

    <section class="card detail-card">
      <div class="detail-head">
        <h1>${escapeHtml(p.clientName)}</h1>
        <span class="chip">${escapeHtml(stage ? stage.name : "?")}</span>
      </div>
      ${veneerStrip(p)}

      <dl class="detail-facts">
        ${p.projectType ? `<div><dt>Project type</dt><dd>${escapeHtml(p.projectType)}</dd></div>` : ""}
        ${p.contact ? `<div><dt>Contact</dt><dd>${escapeHtml(p.contact)}</dd></div>` : ""}
        <div><dt>Created</dt><dd>${formatDate(p.createdAt)}</dd></div>
      </dl>

      ${(p.items || []).length ? `
        <h2 class="section-head">Items</h2>
        <table class="items-table">
          <thead><tr><th>Item</th><th>Specifications</th><th class="num">Value</th></tr></thead>
          <tbody>${itemRows}</tbody>
          <tfoot><tr><td colspan="2">Total</td><td class="num"><strong>${formatMoney(total)}</strong></td></tr></tfoot>
        </table>
      ` : ""}

      ${p.expectedDelivery ? `
        <p class="delivery">
          <span class="tag-internal">internal</span>
          Expected delivery: <strong>${formatDate(p.expectedDelivery)}</strong>
        </p>
      ` : ""}

      <h2 class="section-head">Stage history</h2>
      <ul class="history">${historyRows}</ul>

      <h2 class="section-head">Notes</h2>
      <div class="note-add">
        <input id="note-input" type="text" placeholder="Add a note...">
        <button class="btn ghost" id="note-save">Add</button>
      </div>
      <ul class="notes">${noteItems || `<li class="muted">No notes yet.</li>`}</ul>
    </section>
  `;

  document.getElementById("back-btn").addEventListener("click", () => go("dashboard"));
  document.getElementById("note-save").addEventListener("click", () => {
    const input = document.getElementById("note-input");
    if (!input.value.trim()) return;
    addNote(db, p.id, input.value);
    renderDetail(); // re-draw with the new note
  });
}

function historyLabel(h) {
  if (h.action === "created") return `Created in ${escapeHtml(h.toStage)}`;
  if (h.action === "advanced") return `Advanced: ${escapeHtml(h.fromStage)} &rarr; ${escapeHtml(h.toStage)}`;
  if (h.action === "moved_back") return `Moved back: ${escapeHtml(h.fromStage)} &rarr; ${escapeHtml(h.toStage)}`;
  if (h.action === "lost") return `Marked as Lost (was ${escapeHtml(h.fromStage)})`;
  return escapeHtml(h.action);
}

/* ---------- routing ---------- */
function go(view, projectId) {
  currentView = view;
  if (projectId !== undefined) currentProjectId = projectId;
  render();
}

function render() {
  if (!storageAvailable()) showPersistWarning();
  if (currentView === "add") renderAddForm();
  else if (currentView === "detail") renderDetail();
  else renderDashboard();
}

function showPersistWarning() {
  if (document.querySelector(".banner.warn")) return;
  const b = document.createElement("div");
  b.className = "banner warn";
  b.textContent = "This browser is blocking storage. Data will not survive a refresh.";
  document.body.insertBefore(b, appEl);
}

/* Card clicks: one delegated listener survives every re-render. */
appEl.addEventListener("click", e => {
  const card = e.target.closest(".project-card");
  if (card) go("detail", card.dataset.id);
});

/* topbar navigation */
document.getElementById("nav-dashboard").addEventListener("click", () => go("dashboard"));
document.getElementById("nav-add").addEventListener("click", () => go("add"));

render();
