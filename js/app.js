/* ============================================================
   app.js - rendering and event handling.
   Step 1: boot screen that proves the data layer works.
   Step 2 will replace renderBoot() with the real dashboard.
   ============================================================ */

const appEl = document.getElementById("app");
let db = loadData();

function renderBoot() {
  const stages = getStagesInOrder(db);
  const persistOk = storageAvailable();

  appEl.innerHTML = `
    ${persistOk ? "" : `
      <div class="banner warn">
        This browser is blocking storage. Data will not survive a refresh.
      </div>`}
    <section class="boot card">
      <h1>Data layer ready</h1>
      <p class="muted">
        ${stages.length} stages loaded ·
        ${db.team.length} team members ·
        ${db.projects.length} projects ·
        persistence: ${persistOk ? "on" : "OFF"}
      </p>
      <ol class="stage-list">
        ${stages.map(s => `<li data-phase="${s.phase}">${s.name}</li>`).join("")}
      </ol>
      <p class="muted small">
        Refresh this page. If this screen loads again without errors,
        localStorage is working. Step 2 replaces this with the dashboard.
      </p>
    </section>
  `;
}

renderBoot();
