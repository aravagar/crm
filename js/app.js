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

/* Filter state lives outside render so it survives re-renders. */
let searchTerm = "";
let typeFilter = "";

function matchesFilters(p) {
  const nameOk = !searchTerm ||
    p.clientName.toLowerCase().includes(searchTerm.toLowerCase());
  const typeOk = !typeFilter || p.projectType === typeFilter;
  return nameOk && typeOk;
}

function renderDashboard() {
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

  // Distinct, non-empty project types feed the filter dropdown.
  const types = [...new Set(db.projects.map(p => p.projectType).filter(Boolean))];

  appEl.innerHTML = `
    <div class="dash-controls">
      <input id="dash-search" type="search" placeholder="Search client name..."
        value="${escapeHtml(searchTerm)}">
      <select id="dash-type">
        <option value="">All types</option>
        ${types.map(t =>
          `<option ${t === typeFilter ? "selected" : ""}>${escapeHtml(t)}</option>`
        ).join("")}
      </select>
    </div>
    <div id="dash-results"></div>
  `;

  // Only the results area re-renders on input, so the search
  // box keeps focus while typing.
  document.getElementById("dash-search").addEventListener("input", e => {
    searchTerm = e.target.value;
    renderDashResults();
  });
  document.getElementById("dash-type").addEventListener("change", e => {
    typeFilter = e.target.value;
    renderDashResults();
  });

  renderDashResults();
}

function renderDashResults() {
  const resultsEl = document.getElementById("dash-results");
  const ordered = getStagesInOrder(db);

  const filtered = db.projects.filter(matchesFilters);
  const active = filtered.filter(p => p.status === "active");
  const lost = filtered.filter(p => p.status === "lost");
  const dispatched = filtered.filter(p => p.status === "dispatched");

  if (filtered.length === 0) {
    resultsEl.innerHTML = `
      <p class="muted no-match">No matches. Try a different name or clear the filter.</p>
    `;
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

  resultsEl.innerHTML = `
    <div class="dash-summary muted">
      ${active.length} active · ${dispatched.length} dispatched · ${lost.length} lost
    </div>
    ${groups || `<p class="muted">No active projects match. Check the sections below.</p>`}
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

/* One editable item row. Optionally prefilled (edit mode).
   Columns: name, specs, qty, unit price, line total, remove. */
function itemRowHtml(item) {
  const it = item || { name: "", specs: "", qty: 1, unitPrice: "" };
  return `
    <div class="item-row">
      <input type="text" class="it-name" placeholder="Item (Wardrobe, Door with frame...)"
        value="${escapeHtml(it.name)}">
      <input type="text" class="it-specs" placeholder="Specifications (size, material, finish...)"
        value="${escapeHtml(it.specs)}">
      <input type="number" class="it-qty" placeholder="Qty" min="1" value="${it.qty || 1}">
      <input type="number" class="it-price" placeholder="Price/unit" min="0"
        value="${it.unitPrice === "" ? "" : it.unitPrice}">
      <span class="it-line">Rs 0</span>
      <button type="button" class="btn ghost it-remove" title="Remove item">&times;</button>
    </div>
  `;
}

/* Shared form for both add and edit. When editProject is passed,
   fields are prefilled and Save updates instead of creating. */
function renderProjectForm(editProject) {
  const ordered = getStagesInOrder(db);
  const isEdit = !!editProject;
  const personOptions = db.team.map(name =>
    `<option ${name === db.lastUsedPerson ? "selected" : ""}>${escapeHtml(name)}</option>`
  ).join("");

  const prefill = editProject || {};
  const rowsHtml = (isEdit && prefill.items && prefill.items.length)
    ? prefill.items.map(itemRowHtml).join("")
    : itemRowHtml();

  appEl.innerHTML = `
    <section class="card form-card">
      <h1>${isEdit ? "Edit project" : "Add project"}</h1>
      <div class="form-grid">
        <label>Client name *
          <input id="f-client" type="text" autocomplete="off" value="${escapeHtml(prefill.clientName || "")}">
        </label>
        <label>Contact number
          <input id="f-contact" type="tel" placeholder="10-digit or 91XXXXXXXXXX" value="${escapeHtml(prefill.contact || "")}">
        </label>
        <label>Project type
          <input id="f-type" type="text" placeholder="Residential, Office, Retail..." value="${escapeHtml(prefill.projectType || "")}">
        </label>
        <label>Expected delivery <span class="tag-internal">internal</span>
          <input id="f-delivery" type="date" value="${prefill.expectedDelivery || ""}">
        </label>
        ${isEdit ? "" : `
        <label>Starting stage
          <select id="f-stage">
            ${ordered.map((s, i) =>
              `<option value="${s.id}" ${i === 0 ? "selected" : ""}>${escapeHtml(s.name)}</option>`
            ).join("")}
          </select>
        </label>
        <label>Added by
          <select id="f-person">${personOptions}</select>
        </label>`}
      </div>

      <h2 class="section-head">Items</h2>
      <div class="item-row item-head">
        <span>Item</span><span>Specifications</span><span>Qty</span><span>Price/unit</span><span>Line total</span><span></span>
      </div>
      <div id="item-rows">${rowsHtml}</div>
      <div class="items-footer">
        <button type="button" class="btn ghost" id="add-item-row">+ Add another item</button>
        <span class="items-total">Total: <strong id="items-total-val">Rs 0</strong></span>
      </div>

      ${isEdit ? "" : `
      <label class="note-label">First note (optional)
        <textarea id="f-note" rows="2"></textarea>
      </label>`}

      <p id="form-error" class="form-error" hidden></p>
      <div class="form-actions">
        <button class="btn ghost" id="f-cancel">Cancel</button>
        <button class="btn primary" id="f-save">${isEdit ? "Save changes" : "Save project"}</button>
      </div>
    </section>
  `;

  const rowsEl = document.getElementById("item-rows");

  document.getElementById("add-item-row").addEventListener("click", () => {
    rowsEl.insertAdjacentHTML("beforeend", itemRowHtml());
    updateItemsTotal();
  });

  rowsEl.addEventListener("click", e => {
    if (e.target.classList.contains("it-remove")) {
      e.target.closest(".item-row").remove();
      updateItemsTotal();
    }
  });
  rowsEl.addEventListener("input", e => {
    if (e.target.classList.contains("it-qty") || e.target.classList.contains("it-price")) {
      updateItemsTotal();
    }
  });

  document.getElementById("f-cancel").addEventListener("click", () =>
    isEdit ? go("detail", editProject.id) : go("dashboard"));
  document.getElementById("f-save").addEventListener("click", () =>
    isEdit ? saveEditedProject(editProject.id) : saveNewProject());

  updateItemsTotal(); // fill line totals on load (matters for edit)
}

function renderAddForm() { renderProjectForm(null); }

/* Recomputes every visible line total and the grand total. */
function updateItemsTotal() {
  let grand = 0;
  document.querySelectorAll(".item-row").forEach(row => {
    const qtyEl = row.querySelector(".it-qty");
    const priceEl = row.querySelector(".it-price");
    const lineEl = row.querySelector(".it-line");
    if (!qtyEl || !lineEl) return; // skip the header row
    const line = (Number(qtyEl.value) || 0) * (Number(priceEl.value) || 0);
    lineEl.textContent = formatMoney(line);
    grand += line;
  });
  const totalEl = document.getElementById("items-total-val");
  if (totalEl) totalEl.textContent = formatMoney(grand);
}

function readItemRows() {
  return [...document.querySelectorAll(".item-row")]
    .filter(row => row.querySelector(".it-name")) // skip header row
    .map(row => ({
      id: crypto.randomUUID(),
      name: row.querySelector(".it-name").value.trim(),
      specs: row.querySelector(".it-specs").value.trim(),
      qty: Number(row.querySelector(".it-qty").value) || 1,
      unitPrice: Number(row.querySelector(".it-price").value) || 0
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

function saveEditedProject(projectId) {
  const clientName = document.getElementById("f-client").value.trim();
  const errEl = document.getElementById("form-error");
  if (!clientName) {
    errEl.textContent = "Client name is required.";
    errEl.hidden = false;
    return;
  }
  updateProject(db, projectId, {
    clientName: clientName,
    contact: document.getElementById("f-contact").value,
    projectType: document.getElementById("f-type").value,
    items: readItemRows(),
    expectedDelivery: document.getElementById("f-delivery").value || null
  });
  go("detail", projectId);
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
      <td class="num">${Number(it.qty) || 1}</td>
      <td class="num">${formatMoney(it.unitPrice)}</td>
      <td class="num">${formatMoney(lineTotal(it))}</td>
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

  const ordered = getStagesInOrder(db);
  const idx = ordered.findIndex(s => s.id === p.stageId);
  const nextStage = idx > -1 && idx < ordered.length - 1 ? ordered[idx + 1] : null;
  const prevStage = idx > 0 ? ordered[idx - 1] : null;
  const canLose = p.status === "active" && isPreWonStage(db, p.stageId);
  const personOptions = db.team.map(name =>
    `<option ${name === db.lastUsedPerson ? "selected" : ""}>${escapeHtml(name)}</option>`
  ).join("");

  const actionsHtml = p.status !== "active" ? `
    <p class="closed-note muted">
      This project is ${p.status === "lost" ? "marked as Lost" : "Dispatched"} and closed.
    </p>
  ` : `
    <div class="stage-actions">
      <label class="person-pick">By
        <select id="act-person">${personOptions}</select>
      </label>
      ${nextStage ? `
        <button class="btn advance" id="act-advance">
          Advance &rarr; ${escapeHtml(nextStage.name)}
        </button>` : ""}
      ${prevStage ? `
        <button class="btn ghost" id="act-back">
          &larr; Back to ${escapeHtml(prevStage.name)}
        </button>` : ""}
      ${canLose ? `
        <button class="btn danger" id="act-lost">Mark as Lost</button>` : ""}
    </div>
    <div class="reason-box card" id="reason-box" hidden>
      <p id="reason-title" class="reason-title"></p>
      <input id="reason-input" type="text" placeholder="Reason (required)">
      <p id="reason-error" class="form-error" hidden>A reason is required.</p>
      <div class="form-actions">
        <button class="btn ghost" id="reason-cancel">Cancel</button>
        <button class="btn primary" id="reason-confirm">Confirm</button>
      </div>
    </div>
  `;

  appEl.innerHTML = `
    <button class="btn ghost back-btn" id="back-btn">&larr; Dashboard</button>

    <section class="card detail-card">
      <div class="detail-head">
        <h1>${escapeHtml(p.clientName)}</h1>
        <div class="detail-head-right">
          <span class="chip">${escapeHtml(stage ? stage.name : "?")}</span>
          <button class="btn ghost" id="edit-btn">Edit</button>
        </div>
      </div>
      ${veneerStrip(p)}
      ${actionsHtml}

      <div class="share-box">
        <div class="share-head">
          <h2 class="section-head" style="margin:0;">Share status</h2>
          <div class="share-toggles">
            ${p.expectedDelivery ? `
              <label class="date-toggle">
                <input type="checkbox" id="share-date"> include delivery date
              </label>` : ""}
            <label class="date-toggle">
              <input type="checkbox" id="share-timeline"> include full timeline
            </label>
          </div>
        </div>
        <div class="share-actions">
          ${p.contact ? `
            <button class="btn advance" id="share-wa">Send on WhatsApp</button>` : `
            <span class="muted small">Add a contact number to enable WhatsApp send.</span>`}
          <button class="btn ghost" id="share-copy">Copy status summary</button>
        </div>
        <p id="share-feedback" class="share-feedback" hidden></p>
      </div>

      <dl class="detail-facts">
        ${p.projectType ? `<div><dt>Project type</dt><dd>${escapeHtml(p.projectType)}</dd></div>` : ""}
        ${p.contact ? `<div><dt>Contact</dt><dd>${escapeHtml(p.contact)}</dd></div>` : ""}
        <div><dt>Created</dt><dd>${formatDate(p.createdAt)}</dd></div>
      </dl>

      ${(p.items || []).length ? `
        <h2 class="section-head">Items</h2>
        <table class="items-table">
          <thead><tr><th>Item</th><th>Specifications</th><th class="num">Qty</th><th class="num">Price/unit</th><th class="num">Line total</th></tr></thead>
          <tbody>${itemRows}</tbody>
          <tfoot><tr><td colspan="4">Total</td><td class="num"><strong>${formatMoney(total)}</strong></td></tr></tfoot>
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
  document.getElementById("edit-btn").addEventListener("click", () => {
    currentView = "edit";
    renderProjectForm(p);
  });

  /* ---- status sharing (PRD: FR7) ---- */
  const copyBtn = document.getElementById("share-copy");
  const waBtn = document.getElementById("share-wa");
  const feedback = document.getElementById("share-feedback");

  function includeDate() {
    const box = document.getElementById("share-date");
    return box ? box.checked : false;
  }
  function includeTimeline() {
    const box = document.getElementById("share-timeline");
    return box ? box.checked : false;
  }
  function showFeedback(msg) {
    feedback.textContent = msg;
    feedback.hidden = false;
  }

  if (copyBtn) copyBtn.addEventListener("click", async () => {
    const text = buildStatusSummary(p, includeDate(), includeTimeline());
    try {
      await navigator.clipboard.writeText(text);
      showFeedback("Summary copied. Paste it into WhatsApp.");
    } catch (err) {
      showFeedback("Copy not allowed here. Select and copy:\n\n" + text);
    }
  });

  if (waBtn) waBtn.addEventListener("click", () => {
    const text = buildStatusSummary(p, includeDate(), includeTimeline());
    const url = "https://wa.me/" + p.contact + "?text=" + encodeURIComponent(text);
    window.open(url, "_blank");
  });

  document.getElementById("note-save").addEventListener("click", () => {
    const input = document.getElementById("note-input");
    if (!input.value.trim()) return;
    addNote(db, p.id, input.value);
    renderDetail(); // re-draw with the new note
  });

  /* ---- stage action wiring (only present on active projects) ---- */
  const advBtn = document.getElementById("act-advance");
  const backStageBtn = document.getElementById("act-back");
  const lostBtn = document.getElementById("act-lost");

  if (advBtn) advBtn.addEventListener("click", () => {
    const person = document.getElementById("act-person").value;
    advanceProject(db, p.id, person);
    renderDetail();
  });

  // Move Back and Mark Lost both need a reason, so they share
  // one small inline reason box instead of browser prompt().
  if (backStageBtn) backStageBtn.addEventListener("click", () =>
    openReasonBox("Why is this moving back?", reason => {
      const person = document.getElementById("act-person").value;
      moveProjectBack(db, p.id, person, reason);
      renderDetail();
    })
  );

  if (lostBtn) lostBtn.addEventListener("click", () =>
    openReasonBox("Why was this project lost?", reason => {
      const person = document.getElementById("act-person").value;
      markProjectLost(db, p.id, person, reason);
      renderDetail();
    })
  );
}

/* Shows the reason box, runs onConfirm(reason) only if a
   non-empty reason was entered (PRD: FR4). */
function openReasonBox(title, onConfirm) {
  const box = document.getElementById("reason-box");
  const input = document.getElementById("reason-input");
  const err = document.getElementById("reason-error");
  document.getElementById("reason-title").textContent = title;
  box.hidden = false;
  err.hidden = true;
  input.value = "";
  input.focus();

  document.getElementById("reason-cancel").onclick = () => { box.hidden = true; };
  document.getElementById("reason-confirm").onclick = () => {
    if (!input.value.trim()) { err.hidden = false; return; }
    onConfirm(input.value.trim());
  };
}

/* ---------- status sharing (PRD: FR7) ----------
   Plain-language summary for a client. Delivery date and full
   timeline are both EXCLUDED by default and only added when the
   user ticks their boxes (business rule: written date
   commitments to frustrated clients are high-risk). */
function buildStatusSummary(project, includeDate, includeTimeline) {
  const stage = getStageById(db, project.stageId);
  const lines = [];
  lines.push("Hi, here is the latest status on your Studioforma order.");
  lines.push("");
  lines.push("Client: " + project.clientName);

  const items = (project.items || []).filter(it => it.name);
  if (items.length) {
    lines.push("Items:");
    items.forEach(it => {
      const qty = Number(it.qty) || 1;
      lines.push("- " + qty + " x " + it.name);
    });
  }

  lines.push("Current stage: " + (stage ? stage.name : "-"));

  if (includeDate && project.expectedDelivery) {
    lines.push("Expected delivery: " + formatDate(project.expectedDelivery));
  }

  if (includeTimeline) {
    lines.push("");
    lines.push("Progress so far:");
    project.history.forEach(h => {
      lines.push("- " + timelineLine(h) + " (" + formatDate(h.timestamp) + ")");
    });
  }

  lines.push("");
  lines.push("- Team Studioforma");
  return lines.join("\n");
}

/* Plain-text (no HTML) version of a history event for sharing. */
function timelineLine(h) {
  if (h.action === "created") return "Started at " + h.toStage;
  if (h.action === "advanced") return "Moved to " + h.toStage;
  if (h.action === "moved_back") return "Returned to " + h.toStage;
  if (h.action === "lost") return "Closed";
  return h.action;
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
  else if (currentView === "edit") {
    const p = getProjectById(db, currentProjectId);
    if (p) renderProjectForm(p); else renderDashboard();
  }
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
