// ─── Estado global ─────────────────────────────────────────────────────────
let mode = "balance";        // "balance" | "proust" | "limit"
let scaleMode = "particle";  // "particle" (masa en u) | "mol" (masa en g)
let liveCount = true;        // recuento de átomos visible en el modo ajuste
let current = null;          // BalanceMode o ReactorMode activo
const selectedReaction = { balance: "agua", proust: "agua", limit: "agua" };
const PAD = 16;
const MAX_AMOUNT = 24;       // partículas como máximo de cada reactivo
const MAX_STEPS = 12;        // posiciones como máximo de cada deslizador

function massUnit() { return scaleMode === "mol" ? "g" : "u"; }
function amountText(n) {
  return scaleMode === "mol" ? i18n.num(n) + " mol" : String(n);
}

function reactionList() {
  return mode === "balance" ? BALANCE_REACTIONS : mode === "proust" ? PROUST_REACTIONS : LIMIT_REACTIONS;
}
function currentReaction() {
  let list = reactionList();
  return list.find(r => r.id === selectedReaction[mode]) || list[0];
}

// ─── Setup / resize ────────────────────────────────────────────────────────
function setup() {
  let holder = document.getElementById("canvas-holder");
  let w = holder ? holder.offsetWidth : 1000;
  let h = holder ? holder.offsetHeight : 680;
  createCanvas(w, h).parent("canvas-holder");
  textFont("system-ui, -apple-system, Segoe UI, Roboto, sans-serif");
  setupEventListeners();
  syncTheme();
  buildReactionSelect();
  rebuild();
  if (holder && window.ResizeObserver) new ResizeObserver(windowResized).observe(holder);
}

function windowResized() {
  let holder = document.getElementById("canvas-holder");
  if (!holder) return;
  resizeCanvas(holder.offsetWidth, holder.offsetHeight);
  if (current && current.resize) current.resize();
}

// ─── Construcción del modo activo ───────────────────────────────────────────
function rebuild() {
  let rx = currentReaction();
  if (mode === "balance") {
    current = new BalanceMode(rx);
    buildCoefRows();
  } else if (typeof ReactorMode !== "undefined") {
    current = new ReactorMode(mode, rx);
    configureAmountSliders();
    buildPredictSelect();
    applyAmounts();
    current.yieldPct = intVal("ui-yield-slider");
  } else {
    current = null;
  }
  updateUIVisibility();
  buildLegend();
}

// ─── Bucle principal ────────────────────────────────────────────────────────
function draw() {
  let P = pal();
  background(P.bg[0], P.bg[1], P.bg[2]);
  if (!current) return;
  current.step();
  current.draw(PAD, PAD, width - 2 * PAD, height - 2 * PAD);
  if (frameCount % 6 === 0) updateStats();
}

// ─── Panel: reacciones, coeficientes y cantidades ──────────────────────────
function buildReactionSelect() {
  let sel = document.getElementById("ui-reaction-select");
  sel.innerHTML = "";
  let groups = {};
  for (let r of reactionList()) {
    let label = mode === "balance"
      ? i18n.t(r.name) + ": " + r.r.map(formulaUnicode).join(" + ") + " → " + r.p.map(formulaUnicode).join(" + ")
      : i18n.t(r.name);
    let opt = document.createElement("option");
    opt.value = r.id; opt.textContent = label;
    let parent = sel;
    if (r.group) {
      if (!groups[r.group]) {
        groups[r.group] = document.createElement("optgroup");
        groups[r.group].label = i18n.t(r.group);
        sel.appendChild(groups[r.group]);
      }
      parent = groups[r.group];
    }
    parent.appendChild(opt);
  }
  sel.value = currentReaction().id;
}

function buildCoefRows() {
  let box = document.getElementById("coef-rows");
  box.innerHTML = "";
  let m = current;
  m.species.forEach((f, i) => {
    if (i === 0 || i === m.nR) {
      let h = document.createElement("div");
      h.className = "coef-side";
      h.textContent = i === 0 ? i18n.t("Reactivos") : i18n.t("Productos");
      box.appendChild(h);
    }
    let row = document.createElement("div");
    row.className = "coef-row";
    row.innerHTML =
      '<span class="coef-formula">' + formulaHTML(f) + '</span>' +
      '<span class="coef-ctrl">' +
      '<button class="coef-btn" data-d="-1" aria-label="' + i18n.t("Quitar una") + " " + f + '">−</button>' +
      '<span class="coef-val" id="coef-' + i + '">' + m.coefs[i] + '</span>' +
      '<button class="coef-btn" data-d="1" aria-label="' + i18n.t("Añadir una") + " " + f + '">+</button>' +
      '</span>';
    row.querySelectorAll(".coef-btn").forEach(b => b.addEventListener("click", () => {
      m.setCoef(i, m.coefs[i] + parseInt(b.dataset.d));
      refreshCoefRows();
    }));
    box.appendChild(row);
  });
  refreshCoefRows();
}

function refreshCoefRows() {
  if (mode !== "balance" || !current) return;
  current.coefs.forEach((c, i) => {
    let v = document.getElementById("coef-" + i);
    if (!v) return;
    v.textContent = c;
    let btns = v.parentNode.querySelectorAll(".coef-btn");
    btns[0].disabled = c <= 1;
    btns[1].disabled = c >= MAX_COEF;
  });
  updateStats();
}

function configureAmountSliders() {
  let rx = current.rx;
  [0, 1].forEach(i => {
    let [f, nu] = rx.r[i];
    let sl = document.getElementById("ui-r" + (i + 1) + "-slider");
    sl.min = 1;
    sl.max = Math.min(MAX_STEPS, Math.floor(MAX_AMOUNT / nu));
    // Por defecto: el segundo reactivo en exceso en el modo limitante
    let def = mode === "limit" ? (i === 0 ? 2 : 3) : (i === 0 ? 2 : 4);
    sl.value = Math.min(def, sl.max);
    document.getElementById("r" + (i + 1) + "-label").innerHTML = formulaHTML(f);
  });
  let steps = rx.r.map(r => r[1]);
  document.getElementById("amount-hint").style.display = steps.some(n => n > 1) ? "" : "none";
}

function applyAmounts() {
  if (!current || mode === "balance") return;
  let n = [0, 1].map(i => intVal("ui-r" + (i + 1) + "-slider") * current.rx.r[i][1]);
  document.getElementById("r1-val").textContent = amountText(n[0]);
  document.getElementById("r2-val").textContent = amountText(n[1]);
  current.setAmounts(n[0], n[1]);
}

function buildPredictSelect() {
  let sel = document.getElementById("ui-predict-select");
  sel.innerHTML = "";
  let opts = [["-1", i18n.t("Sin predicción")]];
  current.rx.r.forEach(([f], i) => opts.push([String(i), formulaUnicode(f)]));
  opts.push(["2", i18n.t("Los dos a la vez")]);
  for (let [v, t] of opts) {
    let o = document.createElement("option");
    o.value = v; o.textContent = t;
    sel.appendChild(o);
  }
  current.prediction = -1;
}

function buildLegend() {
  let box = document.getElementById("legend-rows");
  if (!current) { box.innerHTML = ""; return; }
  let rx = current.rx;
  let list = mode === "balance" ? rx.r.concat(rx.p) : rx.r.concat(rx.p).map(e => e[0]);
  box.innerHTML = elementsOf(list).map(el => {
    let E = ELEMENTS[el];
    return '<div class="legend-row"><div class="legend-dot" style="background:rgb(' + E.col.join(",") +
      ');"></div><span class="legend-sym">' + el + '</span><span>' + i18n.t(E.name) +
      ' · ' + i18n.num(E.mass, 2) + ' u</span></div>';
  }).join("");
}

function updateStats() {
  if (!current) return;
  current.stats().forEach(([label, value], i) => {
    document.getElementById("stat-" + (i + 1) + "-label").textContent = label;
    document.getElementById("stat-" + (i + 1)).innerHTML = value;
  });
}

// ─── Visibilidad ────────────────────────────────────────────────────────────
function updateUIVisibility() {
  let show = (id, on) => { let e = document.getElementById(id); if (e) e.style.display = on ? "" : "none"; };
  show("mode-hint-balance", mode === "balance");
  show("mode-hint-proust", mode === "proust");
  show("mode-hint-limit", mode === "limit");
  show("card-coefs", mode === "balance");
  show("card-amounts", mode !== "balance");
  show("group-yield", mode === "limit");
  show("group-predict", mode === "limit");
  show("group-clear", mode === "proust");
  show("group-check", mode === "balance" && !liveCount);
  let live = document.getElementById("ui-live-toggle");
  live.classList.toggle("is-on", liveCount);
  live.classList.toggle("is-off", !liveCount);
}

// ─── Event listeners ────────────────────────────────────────────────────────
function val(id) { let e = document.getElementById(id); return e ? e.value : 0; }
function intVal(id) { return parseInt(val(id)); }

function setupEventListeners() {
  document.getElementById("ui-mode-select").addEventListener("change", (e) => {
    mode = e.target.value;
    buildReactionSelect();
    rebuild();
  });
  document.getElementById("ui-reaction-select").addEventListener("change", (e) => {
    selectedReaction[mode] = e.target.value;
    rebuild();
  });
  document.getElementById("ui-scale-select").addEventListener("change", (e) => {
    scaleMode = e.target.value;
    if (mode !== "balance") applyAmounts();
    updateStats();
  });

  // Modo ajuste
  document.getElementById("ui-live-toggle").addEventListener("click", () => {
    liveCount = !liveCount;
    if (current && current.revealed !== undefined) current.revealed = false;
    updateUIVisibility();
    updateStats();
  });
  document.getElementById("ui-btn-check").addEventListener("click", () => {
    if (mode === "balance") { current.revealed = true; updateStats(); }
  });
  document.getElementById("ui-btn-animate").addEventListener("click", () => {
    if (mode === "balance") current.animate();
  });
  document.getElementById("ui-btn-coef-reset").addEventListener("click", () => {
    if (mode === "balance") { current.resetCoefs(); refreshCoefRows(); }
  });

  // Modos reactor
  ["ui-r1-slider", "ui-r2-slider"].forEach(id =>
    document.getElementById(id).addEventListener("input", applyAmounts));
  document.getElementById("ui-yield-slider").addEventListener("input", (e) => {
    document.getElementById("yield-val").textContent = e.target.value + " %";
    if (current && mode === "limit") current.setYield(parseInt(e.target.value));
  });
  document.getElementById("ui-predict-select").addEventListener("change", (e) => {
    if (current && mode !== "balance") current.prediction = parseInt(e.target.value);
  });
  document.getElementById("ui-btn-run").addEventListener("click", () => {
    if (current && mode !== "balance") current.run();
  });
  document.getElementById("ui-btn-reset").addEventListener("click", () => {
    if (current && mode !== "balance") current.reset();
  });
  document.getElementById("ui-btn-clear").addEventListener("click", () => {
    if (current && mode === "proust") current.clearLog();
  });

  // Tema
  let themeSelect = document.getElementById("ui-theme-select");
  let root = document.documentElement;
  themeSelect.value = root.getAttribute("data-theme") || "dark";
  themeMode = themeSelect.value;
  themeSelect.addEventListener("change", (e) => {
    themeMode = e.target.value;
    root.setAttribute("data-theme", e.target.value);
    try { localStorage.setItem("sim-ui-theme-ar", e.target.value); } catch (_) {}
  });

  // Engranaje
  let gear = document.getElementById("ui-dropdown-trigger");
  let drop = document.getElementById("ui-dropdown-container");
  gear.addEventListener("click", (e) => { e.stopPropagation(); drop.classList.toggle("is-active"); });
  drop.querySelector(".dropdown-card").addEventListener("click", (e) => e.stopPropagation());
  document.addEventListener("click", () => drop.classList.remove("is-active"));
}

function syncTheme() {
  try {
    let saved = localStorage.getItem("sim-ui-theme-ar");
    if (saved) {
      themeMode = saved;
      document.documentElement.setAttribute("data-theme", saved);
      document.getElementById("ui-theme-select").value = saved;
    }
  } catch (_) {}
}
