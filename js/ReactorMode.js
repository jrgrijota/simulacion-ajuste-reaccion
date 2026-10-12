// ─── Reactor: modos Proust y reactivo limitante ─────────────────────────────
// Un recipiente con las partículas de los dos reactivos moviéndose. Al pulsar
// «Reaccionar», cada cierto tiempo se toma un grupo de reactivos en la
// proporción de los coeficientes (por ejemplo 2 H₂ + 1 O₂) y sus átomos vuelan a
// formar los productos. La barra de masa de abajo no cambia: ley de Lavoisier.

const EVENT_EVERY = 14;   // fotogramas entre dos reacciones
const FLIGHT_FRAMES = 46;

class ReactorMode {
  constructor(kind, rx) {
    this.kind = kind;          // "proust" | "limit"
    this.rx = rx;
    this.n0 = [rx.r[0][1], rx.r[1][1]];
    this.yieldPct = 100;
    this.prediction = -1;
    this.log = [];
    this.box = null;
    this.reset();
  }

  setAmounts(a, b) { this.n0 = [a, b]; this.reset(); }
  setYield(y) { this.yieldPct = y; this.reset(); }
  clearLog() { this.log = []; }

  reset() {
    this.particles = [];
    this.events = [];
    this.started = 0;          // grupos que han empezado a reaccionar
    this.finished = 0;         // grupos ya convertidos en productos
    this.state = "idle";       // "idle" | "running" | "done"
    this.timer = 0;
    this.needSpawn = true;
  }

  // Avance máximo: cuántas veces cabe la ecuación con los reactivos que hay.
  extentMax() {
    return Math.min(...this.rx.r.map(([, nu], i) => Math.floor(this.n0[i] / nu)));
  }
  extentTarget() {
    let m = this.extentMax();
    return this.kind === "limit" ? Math.round(m * this.yieldPct / 100) : m;
  }
  // Reactivo limitante: 0, 1 o 2 (se agotan los dos a la vez)
  limiting() {
    let q = this.rx.r.map(([, nu], i) => this.n0[i] / nu);
    return q[0] === q[1] ? 2 : q[0] < q[1] ? 0 : 1;
  }

  run() {
    if (this.state === "done") this.reset();
    if (this.extentTarget() === 0) { this.state = "done"; this.onDone(); return; }
    this.state = "running";
  }

  // Cantidad de cada especie en este momento (reactivos, luego productos)
  amounts() {
    let r = this.rx.r.map(([, nu], i) => this.n0[i] - nu * this.started);
    let p = this.rx.p.map(([, nu]) => nu * this.finished);
    return r.concat(p);
  }
  speciesList() { return this.rx.r.map(e => e[0]).concat(this.rx.p.map(e => e[0])); }

  // ── Disposición: recipiente y panel de datos ──
  layout(x, y, w, h) {
    let wide = w >= 700;
    let chamber, side;
    if (wide) {
      let cw = Math.floor(w * 0.54);
      chamber = { x, y, w: cw, h };
      side = { x: x + cw + 14, y, w: w - cw - 14, h };
    } else {
      let ch = Math.floor(h * 0.52);
      chamber = { x, y, w, h: ch };
      side = { x, y: y + ch + 12, w, h: h - ch - 12 };
    }
    let fs = constrain(Math.min(chamber.w, chamber.h) * 0.045, 13, 22);
    let eqH = fs * 2.2, barH = 46;
    let box = { x: chamber.x + 8, y: chamber.y + eqH, w: chamber.w - 16, h: chamber.h - eqH - barH - 8 };
    return { chamber, side, box, fs, eqH, barH };
  }

  // Píxeles por unidad de enlace, según el sitio y los átomos que hay.
  scaleFor(box) {
    let atoms = 0;
    this.rx.r.forEach(([f], i) => atoms += this.n0[i] * SPECIES[f].length);
    let s = Math.sqrt(0.2 * box.w * box.h / (Math.max(atoms, 1) * 0.8));
    return constrain(s, 6, 30);
  }

  spawn(box, s) {
    let list = [];
    this.rx.r.forEach(([f], i) => { for (let k = 0; k < this.n0[i]; k++) list.push(f); });
    // Mezclados, en una rejilla con algo de desorden para que no se solapen al empezar
    shuffle(list, true);
    let n = list.length;
    let cols = Math.max(1, Math.round(Math.sqrt(n * box.w / box.h)));
    let rows = Math.ceil(n / cols);
    this.particles = list.map((f, i) => {
      let c = i % cols, r = Math.floor(i / cols);
      let px = box.x + (c + 0.5 + (Math.random() - 0.5) * 0.4) * box.w / cols;
      let py = box.y + (r + 0.5 + (Math.random() - 0.5) * 0.4) * box.h / rows;
      return new Particle(f, px, py);
    });
    this.needSpawn = false;
  }

  resize() { /* el reajuste se hace en draw() al detectar el cambio de caja */ }

  fitToBox(box) {
    if (!this.box) { this.box = box; return; }
    let o = this.box;
    if (o.x === box.x && o.y === box.y && o.w === box.w && o.h === box.h) return;
    let mapP = (p) => { p.x = box.x + (p.x - o.x) * box.w / o.w; p.y = box.y + (p.y - o.y) * box.h / o.h; };
    this.particles.forEach(mapP);
    // Las reacciones en vuelo se terminan al instante
    for (let ev of this.events) ev.flight.t = ev.flight.duration;
    this.box = box;
  }

  step() {
    if (!this.box) return;
    let s = this.s;
    for (let p of this.particles) p.step(this.box, s);
    this.separate(s);
    if (this.state !== "running") return;

    let target = this.extentTarget();
    if (this.started < target && this.timer <= 0) {
      if (this.startEvent()) this.timer = EVENT_EVERY;
    }
    this.timer--;

    for (let ev of this.events) ev.flight.step();
    let done = this.events.filter(ev => ev.flight.done);
    for (let ev of done) {
      for (let pr of ev.products) {
        let p = new Particle(pr.f, pr.x, pr.y);
        p.ang = pr.ang;
        this.particles.push(p);
      }
      this.finished++;
    }
    this.events = this.events.filter(ev => !ev.flight.done);

    if (this.finished >= target && this.events.length === 0) {
      this.state = "done";
      this.onDone();
    }
  }

  // Empujón suave entre partículas que se solapan, para que no se amontonen.
  separate(s) {
    let ps = this.particles;
    for (let i = 0; i < ps.length; i++) {
      let a = ps[i];
      if (a.busy) continue;
      for (let j = i + 1; j < ps.length; j++) {
        let b = ps[j];
        let dx = b.x - a.x, dy = b.y - a.y;
        let min = (a.ext.r + b.ext.r) * s * 0.9;
        let d2 = dx * dx + dy * dy;
        if (d2 >= min * min || d2 === 0) continue;
        let d = Math.sqrt(d2), push = (min - d) * 0.06 / d;
        a.x -= dx * push; a.y -= dy * push;
        b.x += dx * push; b.y += dy * push;
      }
    }
  }

  startEvent() {
    let s = this.s, box = this.box;
    let free = (f) => this.particles.filter(p => p.f === f && !p.busy);
    let seedList = free(this.rx.r[0][0]);
    if (!seedList.length) return false;
    let seed = random(seedList);
    let chosen = [];
    for (let [f, nu] of this.rx.r) {
      let cand = free(f).filter(p => !chosen.includes(p))
        .sort((a, b) => Math.hypot(a.x - seed.x, a.y - seed.y) - Math.hypot(b.x - seed.x, b.y - seed.y));
      if (cand.length < nu) return false;
      chosen.push(...cand.slice(0, nu));
    }
    let cx = 0, cy = 0;
    chosen.forEach(p => { cx += p.x; cy += p.y; });
    cx /= chosen.length; cy /= chosen.length;

    // Productos repartidos en corro alrededor del centro del grupo
    let prods = [];
    this.rx.p.forEach(([f, nu]) => { for (let k = 0; k < nu; k++) prods.push(f); });
    let maxR = Math.max(...prods.map(f => speciesExtent(f).r));
    let ring = prods.length > 1 ? maxR * s * 1.6 / Math.sin(Math.PI / prods.length) : 0;
    let m = (maxR + 0.3) * s + ring;
    cx = constrain(cx, box.x + m, box.x + box.w - m);
    cy = constrain(cy, box.y + m, box.y + box.h - m);
    let a0 = Math.random() * TWO_PI;
    let products = prods.map((f, k) => ({
      f,
      x: cx + Math.cos(a0 + k * TWO_PI / prods.length) * ring,
      y: cy + Math.sin(a0 + k * TWO_PI / prods.length) * ring,
      ang: Math.random() * TWO_PI,
    }));
    let sources = [];
    chosen.forEach(p => sources.push(...p.atoms(s)));
    let targets = [];
    products.forEach(pr => targets.push(...atomsOf(pr.f, pr.x, pr.y, pr.ang, s)));

    this.particles = this.particles.filter(p => !chosen.includes(p));
    this.events.push({ flight: new AtomFlight(sources, targets, FLIGHT_FRAMES), products, sources });
    this.started++;
    return true;
  }

  onDone() {
    if (this.kind !== "proust") return;
    let rx = this.rx, a = this.amounts();
    let [fp, nuP] = rx.p[0];
    let nP = a[2];
    let comp = composition(fp);
    let mX = nP * comp[rx.x] * ELEMENTS[rx.x].mass;
    let mY = nP * comp[rx.y] * ELEMENTS[rx.y].mass;
    let left = [0, 1].map(i => a[i]);
    this.log.push({
      m0: [0, 1].map(i => this.n0[i] * molarMass(rx.r[i][0])),
      mP: nP * molarMass(fp),
      left,
      mX, mY,
    });
    if (this.log.length > 8) this.log.shift();
  }

  // ── Dibujo ──
  draw(x, y, w, h) {
    let L = this.layout(x, y, w, h);
    this.s = this.scaleFor(L.box);
    if (this.needSpawn) { this.box = L.box; this.spawn(L.box, this.s); }
    else this.fitToBox(L.box);
    this.drawChamber(L);
    if (this.kind === "proust") this.drawSideProust(L.side);
    else if (this.drawSideLimit) this.drawSideLimit(L.side);
  }

  drawChamber(L) {
    let P = pal(), c = L.chamber, b = L.box;
    noStroke(); fillA(P.panel); rect(c.x, c.y, c.w, c.h, 10);
    noFill(); strokeA(P.border); strokeWeight(themeMode === "high-contrast" ? 1.5 : 1);
    rect(c.x, c.y, c.w, c.h, 10);

    // Ecuación ajustada
    let parts = [];
    this.rx.r.forEach(([f, nu], i) => { if (i) parts.push("+"); parts.push([f, nu]); });
    parts.push("→");
    this.rx.p.forEach(([f, nu], i) => { if (i) parts.push("+"); parts.push([f, nu]); });
    let size = L.fs, gap = size * 0.45;
    let widths = parts.map(p => {
      textStyle(BOLD); textSize(size);
      return typeof p === "string" ? textWidth(p)
        : formulaWidth(p[0], size) + (p[1] > 1 ? textWidth(String(p[1])) + size * 0.22 : 0);
    });
    let total = widths.reduce((a, v) => a + v + gap, -gap);
    let k = Math.min(1, (c.w - 20) / total);
    size *= k; gap *= k;
    let cx = c.x + c.w / 2 - total * k / 2, cy = c.y + L.eqH * 0.5;
    parts.forEach((p, i) => {
      if (typeof p === "string") {
        noStroke(); fillA(P.muted); textStyle(BOLD); textSize(size); textAlign(LEFT, CENTER);
        text(p, cx, cy);
        cx += widths[i] * k + gap;
      } else {
        cx += drawFormula(p[0], cx, cy, size, LEFT, { coef: p[1] > 1 ? p[1] : null, col: P.text, coefCol: P.accent }) + gap;
      }
    });

    // Partículas y reacciones en curso
    noStroke(); fillA(P.bg, themeMode === "light" ? 90 : 120);
    rect(b.x, b.y, b.w, b.h, 8);
    for (let p of this.particles) p.draw(this.s);
    for (let ev of this.events) ev.flight.draw(this.s);

    this.drawMassBar(L);
  }

  // Barra con la masa de cada sustancia: su longitud total no cambia nunca.
  drawMassBar(L) {
    let P = pal(), c = L.chamber;
    let x = c.x + 12, y = c.y + c.h - L.barH + 2, w = c.w - 24, h = 14;
    let list = this.speciesList();
    let masses = list.map(() => 0);
    for (let p of this.particles) masses[list.indexOf(p.f)] += molarMass(p.f);
    let flying = 0;
    for (let ev of this.events) for (let a of ev.sources) flying += ELEMENTS[a.el].mass;
    let total0 = this.rx.r.reduce((acc, [f], i) => acc + this.n0[i] * molarMass(f), 0);
    let now = masses.reduce((a, v) => a + v, 0) + flying;

    noStroke(); fillA(P.muted); textSize(10); textStyle(BOLD); textAlign(LEFT, BOTTOM);
    text(i18n.t("MASA TOTAL EN EL RECIPIENTE"), x, y - 1);
    textAlign(RIGHT, BOTTOM); fillA(P.text);
    text(i18n.num(now, 2) + " " + massUnit(), x + w, y - 1);
    textStyle(NORMAL);

    let cx = x;
    let segs = masses.map((m, i) => [m, P.series[i % 4], list[i]]);
    segs.splice(this.rx.r.length, 0, [flying, P.muted, null]);
    for (let [m, col] of segs) {
      if (m <= 0) continue;
      let sw = w * m / total0;
      noStroke(); fillA(col, 220); rect(cx, y + 2, sw, h);
      cx += sw;
    }
    noFill(); strokeA(P.border); strokeWeight(1); rect(x, y + 2, w, h, 3);
    // Leyenda de colores
    let lx = x, ly = y + h + 12;
    textSize(10); textAlign(LEFT, CENTER);
    list.forEach((f, i) => {
      noStroke(); fillA(P.series[i % 4]); rect(lx, ly - 4, 8, 8, 2);
      lx += 12;
      lx += drawFormula(f, lx, ly, 10.5, LEFT, { col: P.muted }) + 12;
    });
  }

  // ── Panel de la ley de Proust ──
  drawSideProust(S) {
    let P = pal(), rx = this.rx;
    panelBox(S);
    let [fp] = rx.p[0];
    let comp = composition(fp);
    let ratio = comp[rx.y] * ELEMENTS[rx.y].mass / (comp[rx.x] * ELEMENTS[rx.x].mass);
    let u = massUnit();
    let x = S.x + 12, w = S.w - 24, y = S.y + 10;
    let fs = constrain(S.w * 0.032, 11, 14);

    noStroke(); fillA(P.muted); textSize(10); textStyle(BOLD); textAlign(LEFT, TOP);
    text(i18n.t("LEY DE PROUST (PROPORCIONES DEFINIDAS)"), x, y);
    textStyle(NORMAL);
    y += 20;

    // Proporción y composición centesimal del compuesto
    let mXf = comp[rx.x] * ELEMENTS[rx.x].mass, mYf = comp[rx.y] * ELEMENTS[rx.y].mass;
    let pX = 100 * mXf / (mXf + mYf);
    fillA(P.text); textSize(fs); textAlign(LEFT, CENTER); textStyle(BOLD);
    let lx = x;
    let seg = (t, col) => { fillA(col || P.text); text(t, lx, y + fs * 0.6); lx += textWidth(t); };
    lx += drawFormula(fp, lx, y + fs * 0.6, fs, LEFT, { col: P.accent });
    seg(":  m(" + rx.y + ") / m(" + rx.x + ") = ");
    seg(i18n.num(ratio, 2), P.ok);
    textStyle(NORMAL);
    y += fs * 1.6;
    fillA(P.muted); textSize(fs * 0.9);
    text(i18n.t("Composición centesimal:") + " " + i18n.num(pX, 1) + " % " + rx.x + " · " +
         i18n.num(100 - pX, 1) + " % " + rx.y, x, y + fs * 0.5);
    y += fs * 1.8;

    // Gráfica m(Y) frente a m(X) combinadas
    let rest = S.y + S.h - y - 10;
    let gh = Math.max(90, Math.min(rest * 0.52, w * 0.62));
    this.drawProustGraph(x, y, w, gh, ratio, fs);
    y += gh + 10;

    // Tabla de experimentos
    let cols = [
      ["#", 0.07],
      [formulaUnicode(rx.r[0][0]) + " (" + u + ")", 0.18],
      [formulaUnicode(rx.r[1][0]) + " (" + u + ")", 0.18],
      [formulaUnicode(fp) + " (" + u + ")", 0.19],
      [i18n.t("Sobra"), 0.2],
      ["m(" + rx.y + ")/m(" + rx.x + ")", 0.18],
    ];
    let rowH = fs * 1.55;
    let maxRows = Math.max(0, Math.floor((S.y + S.h - y - 8) / rowH) - 1);
    let rows = this.log.slice(-maxRows).map((e, i, arr) => {
      let idx = this.log.length - arr.length + i + 1;
      let left = e.left.map((n, j) => n > 0 ? amountText(n) + " " + formulaUnicode(rx.r[j][0]) : "").filter(Boolean).join(", ");
      return [String(idx), i18n.num(e.m0[0], 1), i18n.num(e.m0[1], 1), i18n.num(e.mP, 1),
              left || i18n.t("nada"), i18n.num(e.mY / e.mX, 2)];
    });
    if (maxRows > 0) drawTable(x, y, w, cols, rows, rowH, fs * 0.82,
      this.log.length ? null : i18n.t("Pulsa «Reaccionar»: cada experimento se anota aquí"));
  }

  drawProustGraph(x, y, w, h, ratio, fs) {
    let P = pal(), rx = this.rx;
    let padL = 38, padB = 26, padT = 8, padR = 8;
    let ax = x + padL, ay = y + padT, aw = w - padL - padR, ah = h - padT - padB;
    noStroke(); fillA(P.panel2); rect(x, y, w, h, 6);
    let maxX = 1, maxY = 1;
    for (let e of this.log) { maxX = Math.max(maxX, e.mX); maxY = Math.max(maxY, e.mY); }
    // Mismo factor de escala en los dos ejes no hace falta: se ajusta a los datos
    maxX = niceMax(maxX * 1.1); maxY = niceMax(Math.max(maxY, maxX * ratio) * 1.05);
    strokeA(P.grid); strokeWeight(1);
    for (let g = 0; g <= 4; g++) {
      let gy = ay + ah - ah * g / 4, gx = ax + aw * g / 4;
      line(ax, gy, ax + aw, gy); line(gx, ay, gx, ay + ah);
    }
    noStroke(); fillA(P.muted); textSize(9);
    textAlign(RIGHT, CENTER);
    text(i18n.num(maxY), ax - 4, ay); text("0", ax - 4, ay + ah);
    textAlign(CENTER, TOP);
    text(i18n.num(maxX), ax + aw, ay + ah + 3);
    textSize(10); textStyle(BOLD);
    text(i18n.t("masa de {el} combinada ({u})", { el: rx.x, u: massUnit() }), ax + aw / 2, ay + ah + 12);
    push(); translate(x + 10, ay + ah / 2); rotate(-HALF_PI); textAlign(CENTER, CENTER);
    text(i18n.t("masa de {el} ({u})", { el: rx.y, u: massUnit() }), 0, 0); pop();
    textStyle(NORMAL);

    let toPx = (mx, my) => [ax + aw * mx / maxX, ay + ah - ah * my / maxY];
    if (this.log.length) {
      // Recta de pendiente constante: m(Y) = proporción · m(X)
      let xEnd = Math.min(maxX, maxY / ratio);
      let [x0, y0] = toPx(0, 0), [x1, y1] = toPx(xEnd, xEnd * ratio);
      strokeA(P.ok, 170); strokeWeight(1.5);
      drawingContext.setLineDash([5, 4]); line(x0, y0, x1, y1); drawingContext.setLineDash([]);
    }
    this.log.forEach((e, i) => {
      let [px, py] = toPx(e.mX, e.mY);
      let last = i === this.log.length - 1;
      noStroke(); fillA(P.accent); ellipse(px, py, last ? 10 : 7, last ? 10 : 7);
      fillA(P.text); textSize(9); textAlign(LEFT, BOTTOM);
      text(i + 1, px + 5, py - 2);
    });
  }

  stats() {
    let u = massUnit(), a = this.amounts();
    let m0 = this.rx.r.reduce((acc, [f], i) => acc + this.n0[i] * molarMass(f), 0);
    let mp = this.rx.p.reduce((acc, [f], i) => acc + a[2 + i] * molarMass(f), 0);
    let list = this.speciesList();
    let fmt = (i) => amountText(a[i]) + " " + formulaHTML(list[i]);
    if (this.kind === "proust") {
      return [
        [i18n.t("Masa total"), i18n.num(m0, 2) + " " + u],
        [i18n.t("Compuesto formado"), i18n.num(mp, 2) + " " + u],
        [i18n.t("Queda de {f}", { f: formulaUnicode(list[0]) }), fmt(0)],
        [i18n.t("Queda de {f}", { f: formulaUnicode(list[1]) }), fmt(1)],
      ];
    }
    return this.statsLimit ? this.statsLimit(a, m0, mp) : [];
  }
}

// ─── Utilidades de dibujo de los paneles ────────────────────────────────────
function panelBox(S) {
  let P = pal();
  noStroke(); fillA(P.panel); rect(S.x, S.y, S.w, S.h, 10);
  noFill(); strokeA(P.border); strokeWeight(themeMode === "high-contrast" ? 1.5 : 1);
  rect(S.x, S.y, S.w, S.h, 10);
}

function niceMax(v) {
  let e = Math.pow(10, Math.floor(Math.log10(v)));
  for (let m of [1, 2, 2.5, 5, 10]) if (m * e >= v) return m * e;
  return 10 * e;
}

// cols: [[título, fracción del ancho]]; rows: listas de textos
function drawTable(x, y, w, cols, rows, rowH, fs, emptyMsg) {
  let P = pal();
  let xs = [], acc = x;
  for (let [, f] of cols) { xs.push(acc); acc += f * w; }
  noStroke(); fillA(P.panel2); rect(x, y, w, rowH, 4);
  // Texto que encoge si no cabe en su columna
  let cell = (t, i, cy) => {
    let cw = cols[i][1] * w - 6;
    textSize(fs);
    if (textWidth(t) > cw) textSize(Math.max(7, fs * cw / textWidth(t)));
    text(t, xs[i] + 4, cy);
  };
  fillA(P.muted); textStyle(BOLD); textAlign(LEFT, CENTER);
  cols.forEach(([t], i) => cell(t, i, y + rowH / 2));
  textStyle(NORMAL);
  if (!rows.length && emptyMsg) {
    fillA(P.muted); textAlign(CENTER, CENTER); textSize(fs);
    text(emptyMsg, x + w / 2, y + rowH * 1.6);
    return;
  }
  rows.forEach((r, j) => {
    let ry = y + rowH * (j + 1);
    if (j % 2) { noStroke(); fillA(P.panel2, 110); rect(x, ry, w, rowH); }
    fillA(P.text); textAlign(LEFT, CENTER);
    r.forEach((t, i) => cell(t, i, ry + rowH / 2));
  });
}

// ─── Panel del modo reactivo limitante y rendimiento ────────────────────────
ReactorMode.prototype.drawSideLimit = function (S) {
  let P = pal(), rx = this.rx;
  panelBox(S);
  let u = massUnit();
  let x = S.x + 12, w = S.w - 24, y = S.y + 10;
  let fs = constrain(S.w * 0.032, 11, 14);
  let list = this.speciesList(), a = this.amounts();
  let nR = rx.r.length;
  let xiMax = this.extentMax(), xiT = this.extentTarget();
  let theo = list.map((f, i) => i < nR ? this.n0[i] : rx.p[i - nR][1] * xiMax);

  noStroke(); fillA(P.muted); textSize(10); textStyle(BOLD); textAlign(LEFT, TOP);
  text(i18n.t("REACTIVO LIMITANTE Y RENDIMIENTO"), x, y);
  textStyle(NORMAL);
  y += 20;

  // Tabla inicial / cambio / final
  let cols = [
    [i18n.t("Sustancia"), 0.2], [i18n.t("Inicial"), 0.18], [i18n.t("Cambio"), 0.2],
    [i18n.t("Final"), 0.18], [i18n.t("Masa final") + " (" + u + ")", 0.24],
  ];
  let rows = list.map((f, i) => {
    let ini = i < nR ? this.n0[i] : 0;
    let d = a[i] - ini;
    return [formulaUnicode(f), amountText(ini), (d > 0 ? "+" : d < 0 ? "−" : "") + amountText(Math.abs(d)),
            amountText(a[i]), i18n.num(a[i] * molarMass(f), 2)];
  });
  let rowH = fs * 1.6;
  drawTable(x, y, w, cols, rows, rowH, fs * 0.85);
  y += rowH * (rows.length + 1) + 12;

  // Barras: relleno = cantidad ahora; contorno = inicial (reactivos) o teórica (productos)
  let maxN = Math.max(1, ...theo, ...a);
  let barH = constrain((S.y + S.h - y) * 0.06, 10, 18);
  let labelW = fs * 3.4;
  list.forEach((f, i) => {
    let by = y + i * (barH + 7);
    drawFormula(f, x, by + barH / 2, fs * 0.9, LEFT, { col: P.text });
    let bx = x + labelW, bw = w - labelW - fs * 5.5;
    noStroke(); fillA(P.series[i % 4], 220);
    rect(bx, by, bw * a[i] / maxN, barH, 3);
    noFill(); strokeA(P.series[i % 4]); strokeWeight(1.2);
    drawingContext.setLineDash([4, 3]);
    rect(bx, by, bw * theo[i] / maxN, barH, 3);
    drawingContext.setLineDash([]);
    noStroke(); fillA(P.muted); textSize(fs * 0.8); textAlign(LEFT, CENTER);
    let tag = i < nR ? i18n.t("de {n}", { n: amountText(theo[i]) }) : i18n.t("de {n} teór.", { n: amountText(theo[i]) });
    text(amountText(a[i]) + " " + tag, bx + bw + 6, by + barH / 2);
  });
  y += list.length * (barH + 7) + 10;

  // Resultados
  let lines = [];
  let done = this.state === "done";
  let lim = this.limiting();
  let fq = (i) => formulaUnicode(list[i]);
  if (!done) {
    lines.push([i18n.t("Reactivo limitante:") + " ?", P.muted]);
    lines.push([this.state === "running" ? i18n.t("Reaccionando…") : i18n.t("Predice qué reactivo se agota y pulsa «Reaccionar»"), P.muted]);
  } else {
    if (lim === 2) {
      lines.push([i18n.t("Proporción estequiométrica: no hay reactivo limitante ni en exceso"), P.accent]);
    } else {
      let ex = 1 - lim;
      let need = rx.r[ex][1] * xiMax;
      lines.push([i18n.t("Reactivo limitante: {f}", { f: fq(lim) }) +
                  (a[lim] > 0 ? " " + i18n.t("(con un 100 % se agotaría)") : " " + i18n.t("(se agota)")), P.accent]);
      lines.push([i18n.t("En exceso: {f} (solo hacen falta {n} de {t})", { f: fq(ex), n: amountText(need), t: amountText(this.n0[ex]) }), P.text]);
    }
    let fp = list[nR], nuP = rx.p[0][1];
    let th = nuP * xiMax, real = a[nR];
    lines.push([i18n.t("Producto teórico: {n} {f} = {m} {u}", { n: amountText(th), f: formulaUnicode(fp), m: i18n.num(th * molarMass(fp), 2), u }), P.text]);
    lines.push([i18n.t("Producto real: {n} {f} = {m} {u}", { n: amountText(real), f: formulaUnicode(fp), m: i18n.num(real * molarMass(fp), 2), u }), P.text]);
    let got = th ? Math.round(100 * real / th) : 0;
    let rLine = i18n.t("Rendimiento = real / teórico · 100 = {p} %", { p: got });
    if (th && got !== this.yieldPct) rLine += " " + i18n.t("(se redondea a partículas enteras)");
    lines.push([rLine, P.ok]);
    if (this.prediction >= 0) {
      let ok = this.prediction === lim;
      lines.push([ok ? i18n.t("✓ Tu predicción era correcta") : i18n.t("✗ Tu predicción no era correcta"), ok ? P.ok : P.bad]);
    }
  }
  textSize(fs * 0.92); textAlign(LEFT, TOP);
  for (let [t, col] of lines) {
    if (y > S.y + S.h - fs * 1.2) break;
    noStroke(); fillA(col); textStyle(col === P.accent || col === P.ok ? BOLD : NORMAL);
    text(t, x, y, w);
    let nLines = Math.ceil(textWidth(t) / w);
    y += fs * 1.35 * Math.max(1, nLines) + 2;
  }
  textStyle(NORMAL);
};

ReactorMode.prototype.statsLimit = function (a, m0, mp) {
  let rx = this.rx, nR = rx.r.length, u = massUnit();
  let done = this.state === "done";
  let lim = this.limiting();
  let fp = rx.p[0][0], th = rx.p[0][1] * this.extentMax();
  let limTxt = !done ? "?" : lim === 2 ? i18n.t("ninguno") : formulaHTML(rx.r[lim][0]);
  let got = th ? Math.round(100 * a[nR] / th) : 0;
  return [
    [i18n.t("Reactivo limitante"), limTxt],
    [i18n.t("Masa total"), i18n.num(m0, 2) + " " + u],
    [i18n.t("Producto teórico"), amountText(th) + " " + formulaHTML(fp)],
    [i18n.t("Rendimiento"), done ? got + " %" : "—"],
  ];
};
