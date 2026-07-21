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
   Early projects stored a single productNeeded + estimatedValue.
   The model is now an items list (name, specs, value each).
   This converts old projects once, on load, so nothing breaks. */
function migrate(data) {
  let changed = false;
  data.projects.forEach(p => {
    if (!Array.isArray(p.items)) {
      p.items = [];
      if (p.productNeeded || p.estimatedValue) {
        p.items.push({
          id: crypto.randomUUID(),
          name: p.productNeeded || "Item",
          specs: "",
          value: p.estimatedValue || 0
        });
      }
      delete p.productNeeded;
      delete p.estimatedValue;
      changed = true;
    }
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

/* Sum of item values. Null-safe so an empty project totals 0. */
function projectTotal(project) {
  return (project.items || []).reduce((sum, it) => sum + (Number(it.value) || 0), 0);
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

/* ---------- Phone normalization ----------
   wa.me needs international format: 91XXXXXXXXXX, no + or
   spaces (PRD: FR7). We store it that way from the start. */
function normalizePhone(raw) {
  let digits = String(raw).replace(/\D/g, ""); // strip everything non-numeric
  if (digits.length === 10) digits = "91" + digits; // assume India if 10 digits
  return digits;
}
