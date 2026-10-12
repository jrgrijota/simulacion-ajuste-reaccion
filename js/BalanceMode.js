// ─── Modo ajuste (ley de Lavoisier) ─────────────────────────────────────────
// Reactivos a la izquierda y productos a la derecha, tantas partículas como
// indica cada coeficiente. Debajo, el recuento de átomos por elemento y una
// balanza con la masa de cada lado. «Ver la reacción» lleva cada átomo de los
// reactivos a un hueco de los productos: si la ecuación no está ajustada,
// sobran átomos o quedan huecos vacíos.

const MAX_COEF = 9;

class BalanceMode {
  constructor(rx) {
    this.rx = rx;
    this.species = rx.r.concat(rx.p);
    this.nR = rx.r.length;
    this.coefs = this.species.map(() => 1);
    this.flight = null;
    this.revealed = false;   // «Comprobar» con el recuento en vivo apagado
    this.beamAng = 0;
  }

  setCoef(i, v) {
    this.coefs[i] = Math.max(1, Math.min(MAX_COEF, v));
    this.flight = null;
    this.revealed = false;
  }
  resetCoefs() {
    this.coefs = this.species.map(() => 1);
    this.flight = null;
    this.revealed = false;
  }

  state() {
    let rC = this.coefs.slice(0, this.nR), pC = this.coefs.slice(this.nR);
    let R = atomCount(this.rx.r, rC), P = atomCount(this.rx.p, pC);
    let els = elementsOf(this.species);
    let balanced = els.every(el => (R[el] || 0) === (P[el] || 0));
    let mR = 0, mP = 0;
    this.rx.r.forEach((f, i) => mR += rC[i] * molarMass(f));
    this.rx.p.forEach((f, i) => mP += pC[i] * molarMass(f));
    let g = gcdList(this.coefs);
    let nR = 0, nP = 0;
    for (let el of els) { nR += R[el] || 0; nP += P[el] || 0; }
    return { R, P, els, balanced, mR, mP, nR, nP, divisor: balanced && g > 1 ? g : 1 };
  }

  showCounts() { return liveCount || this.revealed; }

  animate() {
    let L = this.lastLayout;
    if (!L) return;
    let sources = [], targets = [];
    L.mols.forEach(m => {
      let atoms = atomsOf(m.f, m.x, m.y, 0, L.s);
      if (m.side === 0) sources.push(...atoms);
      else atoms.forEach((a, k) => targets.push(Object.assign(a, { mol: m, k })));
    });
    this.flight = new AtomFlight(sources, targets, 80);
    this.flightTargets = targets;
    this.revealed = true;
  }

  step() {
    if (this.flight) this.flight.step();
  }

  // ── Distribución en el lienzo ──
  layout(x, y, w, h) {
    let fs = constrain(Math.min(w, h) * 0.034, 12, 20);
    let eqH = fs * 3.2;
    let bottomH = constrain(h * 0.34, 150, 250);
    let boxY = y + eqH, boxH = h - eqH - bottomH - 12;
    let arrowW = constrain(w * 0.06, 26, 56);
    let boxW = (w - arrowW) / 2;
    let boxes = [
      { x: x, y: boxY, w: boxW, h: boxH },
      { x: x + boxW + arrowW, y: boxY, w: boxW, h: boxH },
    ];

    // Escala común: la mayor que deja caber todas las partículas en su columna.
    let labelH = fs * 1.6;
    let cols = [];
    [this.rx.r, this.rx.p].forEach((list, side) => {
      let b = boxes[side];
      let cw = (b.w - 16) / list.length, ch = b.h - labelH - 16;
      list.forEach((f, j) => {
        let idx = side === 0 ? j : this.nR + j;
        cols.push({ f, side, idx, n: this.coefs[idx], ext: speciesExtent(f),
                    x: b.x + 8 + j * cw, y: b.y + 8, w: cw, h: ch });
      });
    });
    const PADU = 0.45;
    let fit = (c, s) => {
      for (let k = 1; k <= c.n; k++) {
        let rows = Math.ceil(c.n / k);
        if (k * (c.ext.w + PADU) * s <= c.w && rows * (c.ext.h + PADU) * s <= c.h) return k;
      }
      return 0;
    };
    let s = constrain(Math.min(w, h) * 0.075, 14, 46);
    while (s > 3 && cols.some(c => !fit(c, s))) s *= 0.94;

    let mols = [];
    for (let c of cols) {
      let k = fit(c, s) || 1, rows = Math.ceil(c.n / k);
      let cellW = (c.ext.w + PADU) * s, cellH = (c.ext.h + PADU) * s;
      let gx = c.x + (c.w - k * cellW) / 2, gy = c.y + (c.h - rows * cellH) / 2;
      for (let i = 0; i < c.n; i++) {
        let col = i % k, row = Math.floor(i / k);
        // En la última fila incompleta, centradas
        let inRow = row === rows - 1 ? c.n - row * k : k;
        let off = (k - inRow) * cellW / 2;
        mols.push({ f: c.f, side: c.side,
                    x: gx + off + (col + 0.5) * cellW - c.ext.cx * s,
                    y: gy + (row + 0.5) * cellH - c.ext.cy * s });
      }
      c.labelY = c.y + c.h + labelH * 0.55;
    }
    return { fs, eqH, boxes, cols, mols, s, arrowW, bottomY: boxY + boxH + 12, bottomH, x, y, w, h };
  }

  draw(x, y, w, h) {
    let P = pal();
    let L = this.layout(x, y, w, h);
    // Si cambia el tamaño durante la animación, se reinicia (los huecos se han movido)
    if (this.flight && this.lastLayout && (this.lastLayout.w !== L.w || this.lastLayout.h !== L.h)) this.flight = null;
    this.lastLayout = L;
    let st = this.state();
    let show = this.showCounts();

    this.drawEquation(L, st, show);

    // Cajas
    let titles = [i18n.t("REACTIVOS"), i18n.t("PRODUCTOS")];
    L.boxes.forEach((b, i) => {
      noStroke(); fillA(P.panel);
      rect(b.x, b.y, b.w, b.h, 10);
      noFill(); strokeA(P.border); strokeWeight(themeMode === "high-contrast" ? 1.5 : 1);
      rect(b.x, b.y, b.w, b.h, 10);
      noStroke(); fillA(P.muted);
      textAlign(LEFT, TOP); textSize(10); textStyle(BOLD);
      text(titles[i], b.x + 10, b.y + 7);
      textStyle(NORMAL);
    });
    // Flecha
    let ay = L.boxes[0].y + L.boxes[0].h / 2;
    let ax0 = L.boxes[0].x + L.boxes[0].w + 6, ax1 = L.boxes[1].x - 6;
    strokeA(P.muted); strokeWeight(2.5);
    line(ax0, ay, ax1 - 4, ay);
    noStroke(); fillA(P.muted);
    triangle(ax1, ay, ax1 - 10, ay - 6, ax1 - 10, ay + 6);

    // Etiqueta de cada columna: «2 H₂O»
    for (let c of L.cols) {
      drawFormula(c.f, c.x + c.w / 2, c.labelY, L.fs * 0.8, CENTER,
                  { coef: c.n, col: P.muted, coefCol: P.accent });
    }

    // Partículas
    let bob = (i) => this.flight ? 0 : Math.sin(frameCount * 0.03 + i * 1.7) * 1.2;
    if (!this.flight) {
      L.mols.forEach((m, i) => drawSpecies(m.f, m.x, m.y + bob(i), 0, L.s));
    } else {
      this.drawFlight(L);
    }

    this.drawAtomTable(L, st, show);
    this.drawBalance(L, st, show);
  }

  drawFlight(L) {
    let P = pal();
    let fl = this.flight;
    // Productos: silueta mientras vuelan los átomos
    let molsP = L.mols.filter(m => m.side === 1);
    if (!fl.done) {
      molsP.forEach(m => drawSpecies(m.f, m.x, m.y, 0, L.s, 45));
    } else {
      // Al terminar: partículas completas, átomos sueltos y huecos vacíos
      let byMol = new Map();
      this.flightTargets.forEach((t, j) => {
        if (!byMol.has(t.mol)) byMol.set(t.mol, []);
        byMol.get(t.mol).push({ t, ok: fl.filled.has(j) });
      });
      for (let [m, list] of byMol) {
        if (list.every(e => e.ok)) { drawSpecies(m.f, m.x, m.y, 0, L.s); continue; }
        drawSpecies(m.f, m.x, m.y, 0, L.s, 30);
        for (let e of list) {
          if (e.ok) drawAtom(e.t.el, e.t.x, e.t.y, L.s);
          else drawMissingAtom(e.t.el, e.t.x, e.t.y, L.s);
        }
      }
    }
    if (!fl.done) fl.draw(L.s);
    // Átomos que sobran: se quedan en los reactivos, con un anillo rojo
    let pulse = 0.5 + 0.5 * Math.sin(frameCount * 0.12);
    for (let a of fl.leftover) {
      drawAtom(a.el, a.x, a.y, L.s);
      if (fl.done) {
        noFill(); strokeA(P.bad, 140 + 115 * pulse); strokeWeight(2);
        let r = ELEMENTS[a.el].r * L.s + 4;
        ellipse(a.x, a.y, 2 * r, 2 * r);
      }
    }
  }

  drawEquation(L, st, show) {
    let P = pal();
    let size = L.fs * 1.35;
    let parts = [];
    this.species.forEach((f, i) => {
      if (i > 0) parts.push(i === this.nR ? { op: "→" } : { op: "+" });
      parts.push({ f, coef: this.coefs[i] });
    });
    // Medir
    let gap = size * 0.5, total = 0;
    textStyle(BOLD);
    for (let p of parts) {
      textSize(size);
      p.w = p.op ? textWidth(p.op) : (textWidth(String(p.coef)) + size * 0.22 + formulaWidth(p.f, size));
      total += p.w + gap;
    }
    total -= gap;
    let scale = Math.min(1, (L.w - 20) / total);
    size *= scale; gap *= scale; total *= scale;
    let cx = L.x + L.w / 2 - total / 2, cy = L.y + L.eqH * 0.36;
    let good = show && st.balanced;
    let mainCol = good ? P.ok : P.text;
    for (let p of parts) {
      if (p.op) {
        noStroke(); fillA(P.muted); textStyle(BOLD); textSize(size); textAlign(LEFT, CENTER);
        text(p.op, cx, cy);
        cx += p.w * scale + gap;
      } else {
        let w = drawFormula(p.f, cx, cy, size, LEFT, {
          coef: p.coef, col: mainCol, coefCol: P.accent, coefAlpha: p.coef === 1 ? 90 : 255,
        });
        cx += w + gap;
      }
    }
    // Estado (tras «Ver la reacción», lo que ha pasado con los átomos)
    let msg, col;
    let fl = this.flight;
    if (fl && fl.done) {
      [msg, col] = this.flightMessage(fl);
    } else if (!show) { msg = i18n.t("Pulsa «Comprobar» para ver si está ajustada"); col = P.muted; }
    else if (st.balanced && st.divisor > 1) {
      msg = i18n.t("✓ Ajustada, pero se puede simplificar: divide los coeficientes entre {n}", { n: st.divisor });
      col = P.warn;
    } else if (st.balanced) { msg = i18n.t("✓ Ecuación ajustada: se conservan los átomos y la masa"); col = P.ok; }
    else { msg = i18n.t("✗ Sin ajustar: algún elemento no tiene los mismos átomos a cada lado"); col = P.bad; }
    noStroke(); fillA(col); textAlign(CENTER, CENTER); textSize(Math.max(11, L.fs * 0.72)); textStyle(BOLD);
    if (textWidth(msg) > L.w) textSize(Math.max(8, textSize() * L.w / textWidth(msg)));
    text(msg, L.x + L.w / 2, L.y + L.eqH * 0.8);
    textStyle(NORMAL);
  }

  flightMessage(fl) {
    let P = pal();
    if (!fl.leftover.length && !fl.missing.length)
      return [i18n.t("✓ Cada átomo encuentra su sitio: no sobra ni falta ninguno"), P.ok];
    let cnt = (list) => {
      let c = {};
      list.forEach(a => c[a.el] = (c[a.el] || 0) + 1);
      return Object.keys(c).map(el => c[el] + " " + el).join(", ");
    };
    let parts = [];
    if (fl.leftover.length) parts.push(i18n.t("Sobran átomos: {a}", { a: cnt(fl.leftover) }));
    if (fl.missing.length) parts.push(i18n.t("faltan átomos: {a}", { a: cnt(fl.missing) }));
    return ["✗ " + parts.join(" · "), P.bad];
  }

  drawAtomTable(L, st, show) {
    let P = pal();
    let x = L.x, y = L.bottomY, w = L.w * 0.5 - 6, h = L.bottomH;
    noStroke(); fillA(P.panel); rect(x, y, w, h, 10);
    noFill(); strokeA(P.border); strokeWeight(1); rect(x, y, w, h, 10);
    noStroke(); fillA(P.muted); textAlign(LEFT, TOP); textSize(10); textStyle(BOLD);
    text(i18n.t("RECUENTO DE ÁTOMOS"), x + 10, y + 7);

    let n = st.els.length;
    let top = y + 26, rowH = Math.min(34, (h - 34) / (n + 1));
    let fs = constrain(rowH * 0.5, 10, 15);
    let cEl = x + 12, cR = x + w * 0.46, cP = x + w * 0.73, cOk = x + w - 14;
    fillA(P.muted); textAlign(CENTER, CENTER);
    for (let [t, cx] of [[i18n.t("Reactivos"), cR], [i18n.t("Productos"), cP]]) {
      textSize(Math.min(fs * 0.8, 11));
      let maxW = w * 0.25;
      if (textWidth(t) > maxW) textSize(Math.max(7, textSize() * maxW / textWidth(t)));
      text(t, cx, top + rowH / 2);
    }
    textStyle(NORMAL);
    st.els.forEach((el, i) => {
      let ry = top + rowH * (i + 1.5);
      let s = Math.min(rowH * 0.8, 26) / (2 * ELEMENTS[el].r) * 0.85;
      drawAtom(el, cEl + rowH * 0.4, ry, Math.min(s, rowH * 0.9));
      noStroke(); fillA(P.text); textAlign(LEFT, CENTER); textSize(fs); textStyle(BOLD);
      text(el, cEl + rowH * 0.9, ry);
      let r = st.R[el] || 0, p = st.P[el] || 0;
      let ok = r === p;
      textAlign(CENTER, CENTER);
      fillA(show ? (ok ? P.ok : P.bad) : P.muted);
      text(show ? r : "?", cR, ry);
      text(show ? p : "?", cP, ry);
      text(show ? (ok ? "✓" : "✗") : "", cOk, ry);
      textStyle(NORMAL);
    });
  }

  drawBalance(L, st, show) {
    let P = pal();
    let x = L.x + L.w * 0.5 + 6, y = L.bottomY, w = L.w * 0.5 - 6, h = L.bottomH;
    noStroke(); fillA(P.panel); rect(x, y, w, h, 10);
    noFill(); strokeA(P.border); strokeWeight(1); rect(x, y, w, h, 10);
    noStroke(); fillA(P.muted); textAlign(LEFT, TOP); textSize(10); textStyle(BOLD);
    text(i18n.t("BALANZA (MASA TOTAL)"), x + 10, y + 7);
    textStyle(NORMAL);

    let target = 0;
    if (show) {
      let d = (st.mR - st.mP) / Math.max(st.mR, st.mP);
      target = constrain(-d * 0.6, -0.2, 0.2);
    }
    this.beamAng += (target - this.beamAng) * 0.08;

    let cx = x + w / 2, baseY = y + h - 12;
    let pivotY = y + 34 + (h - 46) * 0.2;
    let half = w * 0.36;
    // Pie
    fillA(P.muted);
    triangle(cx, pivotY, cx - 14, baseY, cx + 14, baseY);
    rect(cx - w * 0.18, baseY - 2, w * 0.36, 4, 2);
    // Brazo
    let c = Math.cos(this.beamAng), sn = Math.sin(this.beamAng);
    let lx = cx - half * c, ly = pivotY - half * sn;
    let rx = cx + half * c, ry = pivotY + half * sn;
    strokeA(P.text); strokeWeight(3); line(lx, ly, rx, ry);
    noStroke(); fillA(P.accent); ellipse(cx, pivotY, 8, 8);
    // Platillos
    let hang = Math.min(42, (baseY - pivotY) * 0.45);
    let unit = massUnit();
    let pans = [
      { x: lx, y: ly, m: st.mR, label: i18n.t("Reactivos") },
      { x: rx, y: ry, m: st.mP, label: i18n.t("Productos") },
    ];
    let fs = constrain(w * 0.04, 10, 14);
    for (let p of pans) {
      let py = p.y + hang;
      strokeA(P.muted); strokeWeight(1.2);
      line(p.x, p.y, p.x - w * 0.11, py);
      line(p.x, p.y, p.x + w * 0.11, py);
      noStroke(); fillA(P.muted);
      arc(p.x, py, w * 0.26, 16, 0, PI, CHORD);
      fillA(P.text); textAlign(CENTER, TOP); textSize(fs); textStyle(BOLD);
      text(show ? i18n.num(p.m, 2) + " " + unit : "? " + unit, p.x, py + 11);
      textStyle(NORMAL); fillA(P.muted); textSize(fs * 0.85);
      text(p.label, p.x, py + 11 + fs * 1.3);
    }
  }

  stats() {
    let st = this.state(), show = this.showCounts(), u = massUnit();
    let q = (v) => show ? v : "?";
    return [
      [i18n.t("Átomos en reactivos"), q(st.nR)],
      [i18n.t("Átomos en productos"), q(st.nP)],
      [i18n.t("Masa de reactivos"), q(i18n.num(st.mR, 2) + " " + u)],
      [i18n.t("Masa de productos"), q(i18n.num(st.mP, 2) + " " + u)],
    ];
  }
}
