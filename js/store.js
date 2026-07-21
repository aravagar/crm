/* ============================================================
   store.js - the data layer.
   Every localStorage read and write in the whole app happens
   in this file and nowhere else. If we ever move to Supabase,
   only this file changes (PRD: Technical Considerations).
   ============================================================ */

const STORAGE_KEY = "studioforma_tracker_v1";

/* ---------- Default (seed) data ---------- */
/* Sales stage names come from the team's real CRM vocabulary.
   Production names come from the production tracker, with
   Polishing replacing Finishing (PRD: Default Stage List). */
function defaultData() {
  const stageNames = [
    ["New Inquiry", "sales"],
    ["Need 1st F2F Meeting", "sales"],
    ["Factory Visit Done", "sales"],
    ["Details Awaited for Quote", "sales"],
    ["Quote Shared", "sales"],
    ["Negotiation Done", "sales"],
    ["Awaiting Confirmation", "sales"],
    ["Advance Recd", "won"],
    ["Order Received", "production"],
    ["Material Sourced", "production"],
    ["Carpentry", "production"],
    ["Painting", "production"],
    ["Polishing", "production"],
    ["Quality Check", "production"],
    ["Packaging", "production"],
    ["Dispatched", "terminal"]
  ];

  return {
    version: 1,
    stages: stageNames.map(([name, phase], i) => ({
      id: "stg_" + (i + 1),
      name: name,
      order: i + 1,
      phase: phase
    })),
    team: ["Abhiroop", "Arav", "Sanjay"],
    lastUsedPerson: "",
    projects: []
  };
}

/* ---------- Migration ----------
   Model has evolved twice:
   1) single productNeeded + estimatedValue  ->  items list
   2) item.value (flat)  ->  item.qty + item.unitPrice
   Both conversions run once on load so nothing breaks. */
function migrate(data) {
  let changed = false;
  data.projects.forEach(p => {
    // step 3 model: introduce items list
    if (!Array.isArray(p.items)) {
      p.items = [];
      if (p.productNeeded || p.estimatedValue) {
        p.items.push({
          id: crypto.randomUUID(),
          name: p.productNeeded || "Item",
          specs: "",
          qty: 1,
          unitPrice: p.estimatedValue || 0
        });
      }
      delete p.productNeeded;
      delete p.estimatedValue;
      changed = true;
    }
    // step 8 model: flat value -> qty + unitPrice
    p.items.forEach(it => {
      if (it.unitPrice === undefined) {
        it.qty = it.qty || 1;
        it.unitPrice = it.value || 0;
        delete it.value;
        changed = true;
      }
    });
  });
  if (changed) saveData(data);
  return data;
}

/* ---------- Load and save ---------- */

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const seeded = defaultData();
      saveData(seeded);
      return seeded;
    }
    return migrate(JSON.parse(raw));
  } catch (err) {
    // Malformed data or localStorage unavailable (e.g. some
    // private-browsing modes). Fall back to in-memory defaults
    // and let the app show a persistence warning.
    console.error("loadData failed:", err);
    return defaultData();
  }
}

function saveData(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch (err) {
    console.error("saveData failed:", err);
    return false;
  }
}

/* Returns true if localStorage actually works in this browser.
   Used to show the "data will not persist" warning (PRD: Edge Cases). */
function storageAvailable() {
  try {
    localStorage.setItem("__test__", "1");
    localStorage.removeItem("__test__");
    return true;
  } catch (err) {
    return false;
  }
}

/* ---------- Stage helpers ---------- */

function getStagesInOrder(data) {
  return [...data.stages].sort((a, b) => a.order - b.order);
}

function getStageById(data, stageId) {
  return data.stages.find(s => s.id === stageId) || null;
}

/* The "Won boundary" is the Advance Recd stage. Mark as Lost is
   only offered to projects in stages BEFORE it (PRD: FR4). */
function isPreWonStage(data, stageId) {
  const ordered = getStagesInOrder(data);
  const wonIndex = ordered.findIndex(s => s.phase === "won");
  const idx = ordered.findIndex(s => s.id === stageId);
  if (wonIndex === -1) return false; // no won boundary defined
  return idx > -1 && idx < wonIndex;
}

/* ---------- Project CRUD ---------- */

function createProject(data, fields) {
  const firstStage = getStagesInOrder(data)[0];
  const stageId = fields.stageId || firstStage.id;
  const now = new Date().toISOString();

  const project = {
    id: crypto.randomUUID(),
    clientName: fields.clientName.trim(),
    contact: normalizePhone(fields.contact || ""),
    projectType: (fields.projectType || "").trim(),
    items: fields.items || [], // [{id, name, specs, value}]
    expectedDelivery: fields.expectedDelivery || null, // internal only
    stageId: stageId,
    status: "active", // active | lost | dispatched
    createdAt: now,
    history: [
      {
        action: "created",
        fromStage: null,
        toStage: getStageById(data, stageId).name,
        timestamp: now,
        person: fields.person || "",
        reason: ""
      }
    ],
    notes: []
  };

  if (fields.initialNote && fields.initialNote.trim()) {
    project.notes.push({ text: fields.initialNote.trim(), timestamp: now });
  }

  data.projects.push(project);
  saveData(data);
  return project;
}

function getProjectById(data, id) {
  return data.projects.find(p => p.id === id) || null;
}

/* Line total for one item = quantity x unit price. */
function lineTotal(item) {
  return (Number(item.qty) || 0) * (Number(item.unitPrice) || 0);
}

/* Project total = sum of all line totals. Null-safe. */
function projectTotal(project) {
  return (project.items || []).reduce((sum, it) => sum + lineTotal(it), 0);
}

/* Edit an existing project's editable fields (PRD: edit mode).
   Stage, status, history, notes and id are NOT touched here;
   those change only through their own dedicated actions. */
function updateProject(data, projectId, fields) {
  const p = getProjectById(data, projectId);
  if (!p) return false;
  p.clientName = fields.clientName.trim();
  p.contact = normalizePhone(fields.contact || "");
  p.projectType = (fields.projectType || "").trim();
  p.items = fields.items || [];
  p.expectedDelivery = fields.expectedDelivery || null;
  saveData(data);
  return true;
}

function addNote(data, projectId, text) {
  const p = getProjectById(data, projectId);
  if (!p || !text.trim()) return;
  p.notes.push({ text: text.trim(), timestamp: new Date().toISOString() });
  saveData(data);
}

/* ---------- Stage movement (PRD: FR4) ----------
   Three moves only: advance one stage, move back one stage
   (reason required), mark as lost (pre-Won only, reason
   required). Every move appends an immutable history event
   with who, when, and why. There are no arbitrary jumps. */

function advanceProject(data, projectId, person) {
  const p = getProjectById(data, projectId);
  if (!p || p.status !== "active") return false;

  const ordered = getStagesInOrder(data);
  const idx = ordered.findIndex(s => s.id === p.stageId);
  if (idx === -1) return false;               // unknown stage
  if (idx >= ordered.length - 1) return false; // already at last stage

  const from = ordered[idx];
  const to = ordered[idx + 1];
  p.stageId = to.id;
  p.history.push({
    action: "advanced",
    fromStage: from.name,
    toStage: to.name,
    timestamp: new Date().toISOString(),
    person: person,
    reason: ""
  });

  // Reaching the terminal stage (Dispatched) closes the project
  // as a success and moves it to the collapsed section.
  if (to.phase === "terminal") p.status = "dispatched";

  setLastUsedPerson(data, person);
  saveData(data);
  return true;
}

function moveProjectBack(data, projectId, person, reason) {
  const p = getProjectById(data, projectId);
  if (!p || p.status !== "active" || !reason.trim()) return false;

  const ordered = getStagesInOrder(data);
  const idx = ordered.findIndex(s => s.id === p.stageId);
  if (idx <= 0) return false; // already at first stage

  const from = ordered[idx];
  const to = ordered[idx - 1];
  p.stageId = to.id;
  p.history.push({
    action: "moved_back",
    fromStage: from.name,
    toStage: to.name,
    timestamp: new Date().toISOString(),
    person: person,
    reason: reason.trim()
  });

  setLastUsedPerson(data, person);
  saveData(data);
  return true;
}

function markProjectLost(data, projectId, person, reason) {
  const p = getProjectById(data, projectId);
  if (!p || p.status !== "active" || !reason.trim()) return false;
  if (!isPreWonStage(data, p.stageId)) return false; // Lost only before Advance Recd

  const from = getStageById(data, p.stageId);
  p.status = "lost";
  p.history.push({
    action: "lost",
    fromStage: from ? from.name : "?",
    toStage: null,
    timestamp: new Date().toISOString(),
    person: person,
    reason: reason.trim()
  });

  setLastUsedPerson(data, person);
  saveData(data);
  return true;
}

/* Remember who last made a change, so the person picker
   defaults to them next time (PRD: FR4). */
function setLastUsedPerson(data, name) {
  data.lastUsedPerson = name;
  saveData(data);
}

/* ---------- Stage management (PRD: FR5) ----------
   Rename, reorder, add, and remove stages. History entries
   store stage NAMES (not ids), so past history is never
   rewritten when a stage is renamed or removed. */

function renameStage(data, stageId, newName) {
  const s = getStageById(data, stageId);
  if (!s || !newName.trim()) return false;
  s.name = newName.trim();
  saveData(data);
  return true;
}

function moveStage(data, stageId, direction) {
  const ordered = getStagesInOrder(data);
  const idx = ordered.findIndex(s => s.id === stageId);
  const swapWith = direction === "up" ? idx - 1 : idx + 1;
  if (idx === -1 || swapWith < 0 || swapWith >= ordered.length) return false;
  // swap the order values of the two neighbours
  const a = ordered[idx], b = ordered[swapWith];
  const tmp = a.order; a.order = b.order; b.order = tmp;
  saveData(data);
  return true;
}

function addStage(data, name, phase) {
  if (!name.trim()) return false;
  const maxOrder = data.stages.reduce((m, s) => Math.max(m, s.order), 0);
  data.stages.push({
    id: "stg_" + crypto.randomUUID().slice(0, 8),
    name: name.trim(),
    order: maxOrder + 1,
    phase: phase || "sales"
  });
  saveData(data);
  return true;
}

/* Removing a stage that still holds projects requires a
   destination stage to move them to (PRD: FR5). Returns
   the number of projects that had to be reassigned, or -1
   if the removal is invalid. */
function removeStage(data, stageId, reassignToId) {
  if (data.stages.length <= 1) return -1; // never remove the last stage
  const affected = data.projects.filter(p => p.stageId === stageId);
  if (affected.length > 0) {
    if (!reassignToId || reassignToId === stageId) return -1;
    const dest = getStageById(data, reassignToId);
    if (!dest) return -1;
    affected.forEach(p => {
      p.history.push({
        action: "advanced",
        fromStage: getStageById(data, stageId).name,
        toStage: dest.name,
        timestamp: new Date().toISOString(),
        person: "",
        reason: "Stage removed; project reassigned"
      });
      p.stageId = reassignToId;
    });
  }
  data.stages = data.stages.filter(s => s.id !== stageId);
  saveData(data);
  return affected.length;
}

/* ---------- Team management (PRD: FR6) ---------- */

function addTeamMember(data, name) {
  const clean = name.trim();
  if (!clean || data.team.includes(clean)) return false;
  data.team.push(clean);
  saveData(data);
  return true;
}

function removeTeamMember(data, name) {
  data.team = data.team.filter(n => n !== name);
  if (data.lastUsedPerson === name) data.lastUsedPerson = "";
  saveData(data);
  return true;
}

/* ---------- Backup: export / import (PRD: FR8) ----------
   localStorage lives in one browser only. Export downloads the
   whole dataset as JSON so it can be backed up or carried to
   another device; import replaces the current data with a file.
   Import is REPLACE-ONLY: it does not merge two devices. */

function exportData(data) {
  return JSON.stringify(data, null, 2);
}

/* Validates a parsed object looks like our data before accepting
   it, so a wrong file fails safely instead of corrupting state.
   Returns the clean data object, or throws. */
function validateImported(obj) {
  if (!obj || typeof obj !== "object") throw new Error("Not a valid file.");
  if (!Array.isArray(obj.stages) || !Array.isArray(obj.projects) || !Array.isArray(obj.team)) {
    throw new Error("This file is missing stages, projects, or team.");
  }
  return obj;
}

function importData(jsonText) {
  const parsed = JSON.parse(jsonText);      // throws on malformed JSON
  const clean = validateImported(parsed);   // throws if wrong shape
  clean.version = clean.version || 1;
  saveData(clean);
  return migrate(clean); // run migrations in case the file is older
}

/* ---------- Phone normalization ----------
   wa.me needs international format: 91XXXXXXXXXX, no + or
   spaces (PRD: FR7). We store it that way from the start. */
function normalizePhone(raw) {
  let digits = String(raw).replace(/\D/g, ""); // strip everything non-numeric
  if (digits.length === 10) digits = "91" + digits; // assume India if 10 digits
  return digits;
}
