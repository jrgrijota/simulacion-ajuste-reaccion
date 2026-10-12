// ─── Dibujo de átomos, partículas y fórmulas ────────────────────────────────
// s = píxeles por unidad de enlace (las plantillas de chem.js usan esa unidad).

let themeMode = "dark";

// Colores del lienzo según el tema.
function pal() {
  if (themeMode === "light") return {
    bg: [215, 222, 232], panel: [232, 237, 245], panel2: [205, 213, 225], border: [140, 155, 180],
    text: [26, 34, 54], muted: [74, 90, 114], accent: [29, 87, 200], ok: [14, 138, 95], bad: [200, 40, 40],
    warn: [180, 110, 0], atomStroke: [60, 70, 90], grid: [180, 192, 210],
    series: [[29, 87, 200], [214, 110, 20], [14, 138, 95], [150, 70, 200]],
  };
  if (themeMode === "high-contrast") return {
    bg: [0, 0, 0], panel: [0, 0, 0], panel2: [20, 20, 0], border: [255, 255, 0],
    text: [255, 255, 255], muted: [230, 230, 230], accent: [255, 255, 0], ok: [0, 255, 136], bad: [255, 80, 80],
    warn: [255, 200, 0], atomStroke: [255, 255, 255], grid: [90, 90, 0],
    series: [[0, 200, 255], [255, 170, 0], [0, 255, 136], [255, 110, 255]],
  };
  return {
    bg: [11, 12, 16], panel: [20, 24, 36], panel2: [28, 33, 50], border: [57, 66, 100],
    text: [238, 242, 248], muted: [154, 166, 189], accent: [59, 130, 246], ok: [16, 185, 129], bad: [239, 83, 80],
    warn: [245, 180, 60], atomStroke: [12, 14, 20], grid: [40, 48, 72],
    series: [[79, 142, 247], [247, 130, 60], [52, 199, 130], [167, 139, 250]],
  };
}

function fillA(c, a) { fill(c[0], c[1], c[2], a == null ? 255 : a); }
function strokeA(c, a) { stroke(c[0], c[1], c[2], a == null ? 255 : a); }

// Un átomo con su símbolo (si cabe).
function drawAtom(el, x, y, s, alpha) {
  let E = ELEMENTS[el];
  let r = E.r * s;
  let a = alpha == null ? 255 : alpha;
  let P = pal();
  strokeA(P.atomStroke, a * 0.8);
  strokeWeight(Math.max(1, s * 0.05));
  fill(E.col[0], E.col[1], E.col[2], a);
  ellipse(x, y, 2 * r, 2 * r);
  // Brillo
  noStroke();
  fill(255, 255, 255, a * 0.28);
  ellipse(x - r * 0.32, y - r * 0.32, r * 0.7, r * 0.7);
  if (r >= 7.5) {
    fill(E.ink[0], E.ink[1], E.ink[2], a);
    textAlign(CENTER, CENTER);
    textStyle(BOLD);
    textSize(Math.min(r * (el.length > 1 ? 0.95 : 1.15), 22));
    text(el, x, y + 0.5);
    textStyle(NORMAL);
  }
}

// Círculo discontinuo: el hueco de un átomo que falta.
function drawMissingAtom(el, x, y, s, alpha) {
  let r = ELEMENTS[el].r * s;
  let P = pal();
  let a = alpha == null ? 255 : alpha;
  noFill();
  strokeA(P.bad, a);
  strokeWeight(Math.max(1.2, s * 0.06));
  let n = 14;
  for (let i = 0; i < n; i += 2) {
    arc(x, y, 2 * r, 2 * r, (i / n) * TWO_PI, ((i + 1) / n) * TWO_PI);
  }
  if (r >= 7.5) {
    noStroke();
    fillA(P.bad, a);
    textAlign(CENTER, CENTER);
    textStyle(BOLD);
    textSize(Math.min(r * 0.95, 20));
    text(el, x, y + 0.5);
    textStyle(NORMAL);
  }
}

// Posición absoluta de los átomos de una partícula.
function atomsOf(f, x, y, ang, s) {
  let c = Math.cos(ang), si = Math.sin(ang);
  return SPECIES[f].map(([el, ax, ay]) => ({
    el, x: x + (ax * c - ay * si) * s, y: y + (ax * si + ay * c) * s,
  }));
}

// Enlaces: pares de átomos a menos de 1,05 unidades.
const _bondCache = {};
function bondsOf(f) {
  if (_bondCache[f]) return _bondCache[f];
  let t = SPECIES[f], out = [];
  for (let i = 0; i < t.length; i++)
    for (let j = i + 1; j < t.length; j++)
      if (Math.hypot(t[i][1] - t[j][1], t[i][2] - t[j][2]) < 1.05) out.push([i, j]);
  return (_bondCache[f] = out);
}

function drawSpecies(f, x, y, ang, s, alpha) {
  let atoms = atomsOf(f, x, y, ang, s);
  let a = alpha == null ? 255 : alpha;
  let P = pal();
  strokeA(P.muted, a * 0.9);
  strokeWeight(Math.max(1.5, s * 0.16));
  for (let [i, j] of bondsOf(f)) line(atoms[i].x, atoms[i].y, atoms[j].x, atoms[j].y);
  // Los átomos pequeños (H) encima, para que se vean.
  let order = atoms.slice().sort((p, q) => ELEMENTS[q.el].r - ELEMENTS[p.el].r);
  for (let at of order) drawAtom(at.el, at.x, at.y, s, a);
}

// ─── Fórmulas con subíndices ────────────────────────────────────────────────
function formulaWidth(f, size) {
  let w = 0;
  for (let tk of formulaTokens(f)) {
    textSize(tk.sub ? size * 0.68 : size);
    w += textWidth(tk.t);
  }
  return w;
}

// Dibuja «coef fórmula» con la base del texto centrada en y. Devuelve el ancho.
// align: LEFT | CENTER | RIGHT. coef: número o null; coefCol: color del coeficiente.
function drawFormula(f, x, y, size, align, opts) {
  opts = opts || {};
  textStyle(BOLD);
  let coefTxt = opts.coef != null ? String(opts.coef) : "";
  textSize(size);
  let cw = coefTxt ? textWidth(coefTxt) + size * 0.22 : 0;
  let w = cw + formulaWidth(f, size);
  let x0 = align === CENTER ? x - w / 2 : align === RIGHT ? x - w : x;
  textAlign(LEFT, CENTER);
  noStroke();
  if (coefTxt) {
    fillA(opts.coefCol || opts.col, opts.coefAlpha == null ? 255 : opts.coefAlpha);
    textSize(size);
    text(coefTxt, x0, y);
    x0 += cw;
  }
  fillA(opts.col, 255);
  for (let tk of formulaTokens(f)) {
    if (tk.sub) {
      textSize(size * 0.68);
      text(tk.t, x0, y + size * 0.3);
    } else {
      textSize(size);
      text(tk.t, x0, y);
    }
    x0 += textWidth(tk.t);
  }
  textStyle(NORMAL);
  return w;
}

// ─── Partícula que se mueve en el reactor ───────────────────────────────────
class Particle {
  constructor(f, x, y) {
    this.f = f;
    this.x = x; this.y = y;
    let a = Math.random() * TWO_PI, v = 0.35 + Math.random() * 0.45;
    this.vx = Math.cos(a) * v; this.vy = Math.sin(a) * v;
    this.ang = Math.random() * TWO_PI;
    this.va = (Math.random() - 0.5) * 0.02;
    this.busy = false;     // reservada para una reacción en curso
    this.ext = speciesExtent(f);
  }

  step(box, s) {
    if (this.busy) return;
    // Pequeño movimiento browniano
    this.vx += (Math.random() - 0.5) * 0.06;
    this.vy += (Math.random() - 0.5) * 0.06;
    let v = Math.hypot(this.vx, this.vy);
    if (v > 0.9) { this.vx *= 0.9 / v; this.vy *= 0.9 / v; }
    this.x += this.vx; this.y += this.vy;
    this.ang += this.va;
    let m = this.ext.r * s;
    if (this.x < box.x + m)         { this.x = box.x + m;         this.vx = Math.abs(this.vx); }
    if (this.x > box.x + box.w - m) { this.x = box.x + box.w - m; this.vx = -Math.abs(this.vx); }
    if (this.y < box.y + m)         { this.y = box.y + m;         this.vy = Math.abs(this.vy); }
    if (this.y > box.y + box.h - m) { this.y = box.y + box.h - m; this.vy = -Math.abs(this.vy); }
  }

  atoms(s) { return atomsOf(this.f, this.x, this.y, this.ang, s); }
  draw(s, alpha) { drawSpecies(this.f, this.x, this.y, this.ang, s, alpha); }
}

// ─── Vuelo de átomos: de los reactivos a los productos ──────────────────────
// sources: átomos de partida {el, x, y}; targets: huecos de llegada {el, x, y}.
// Empareja cada hueco con el átomo libre más cercano del mismo elemento (voraz
// por distancia). Lo que no se empareja son átomos que sobran o que faltan.
class AtomFlight {
  constructor(sources, targets, duration) {
    this.duration = duration || 60;
    this.t = 0;
    let pairs = [];
    sources.forEach((a, i) => targets.forEach((b, j) => {
      if (a.el === b.el) pairs.push([Math.hypot(a.x - b.x, a.y - b.y), i, j]);
    }));
    pairs.sort((p, q) => p[0] - q[0]);
    let usedS = new Set(), usedT = new Set();
    this.moves = [];
    for (let [, i, j] of pairs) {
      if (usedS.has(i) || usedT.has(j)) continue;
      usedS.add(i); usedT.add(j);
      let a = sources[i], b = targets[j];
      // Arco suave perpendicular a la trayectoria
      let bend = (Math.random() - 0.5) * 0.5;
      this.moves.push({ el: a.el, x0: a.x, y0: a.y, x1: b.x, y1: b.y, bend, target: j });
    }
    this.leftover = sources.filter((_, i) => !usedS.has(i));
    this.missing = targets.filter((_, j) => !usedT.has(j));
    this.filled = usedT;
  }

  get done() { return this.t >= this.duration; }
  step() { if (this.t < this.duration) this.t++; }
  progress() {
    let u = Math.min(1, this.t / this.duration);
    return u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
  }

  draw(s) {
    let e = this.progress();
    for (let m of this.moves) {
      let dx = m.x1 - m.x0, dy = m.y1 - m.y0;
      let k = Math.sin(Math.PI * e) * m.bend;
      let x = m.x0 + dx * e - dy * k;
      let y = m.y0 + dy * e + dx * k;
      drawAtom(m.el, x, y, s);
    }
  }
}
