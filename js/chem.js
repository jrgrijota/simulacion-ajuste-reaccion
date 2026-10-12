// ─── Datos químicos ─────────────────────────────────────────────────────────
// Elementos, plantillas de las partículas (posición de cada átomo en unidades de
// «enlace») y reacciones de cada modo. Todo lo demás se calcula a partir de aquí.

// Masas atómicas (u) de la IUPAC; en pantalla se redondean a dos decimales.
// r: radio de dibujo relativo; col: color de relleno (aproximadamente CPK).
const ELEMENTS = {
  H:  { name: "Hidrógeno", mass: 1.008,  r: 0.34, col: [236, 240, 246], ink: [30, 35, 45] },
  C:  { name: "Carbono",   mass: 12.011, r: 0.46, col: [88, 96, 110],   ink: [245, 245, 245] },
  N:  { name: "Nitrógeno", mass: 14.007, r: 0.44, col: [59, 110, 246],  ink: [255, 255, 255] },
  O:  { name: "Oxígeno",   mass: 15.999, r: 0.44, col: [232, 64, 64],   ink: [255, 255, 255] },
  Na: { name: "Sodio",     mass: 22.990, r: 0.60, col: [167, 139, 250], ink: [30, 20, 60] },
  Mg: { name: "Magnesio",  mass: 24.305, r: 0.56, col: [45, 212, 191],  ink: [10, 50, 45] },
  Al: { name: "Aluminio",  mass: 26.982, r: 0.56, col: [214, 160, 196], ink: [60, 20, 45] },
  S:  { name: "Azufre",    mass: 32.06,  r: 0.54, col: [250, 204, 21],  ink: [70, 55, 0] },
  Cl: { name: "Cloro",     mass: 35.45,  r: 0.54, col: [34, 197, 94],   ink: [5, 45, 20] },
  K:  { name: "Potasio",   mass: 39.098, r: 0.66, col: [192, 38, 211],  ink: [255, 255, 255] },
  Ca: { name: "Calcio",    mass: 40.078, r: 0.62, col: [163, 230, 53],  ink: [35, 55, 0] },
  Fe: { name: "Hierro",    mass: 55.845, r: 0.56, col: [234, 118, 40],  ink: [255, 255, 255] },
};

// Plantillas: [símbolo, x, y]. Las sustancias iónicas y los metales se dibujan
// como una «unidad fórmula» o un átomo aislado (ver la guía docente).
const SPECIES = {
  H2:    [["H", -0.5, 0], ["H", 0.5, 0]],
  O2:    [["O", -0.55, 0], ["O", 0.55, 0]],
  N2:    [["N", -0.55, 0], ["N", 0.55, 0]],
  Cl2:   [["Cl", -0.62, 0], ["Cl", 0.62, 0]],
  C:     [["C", 0, 0]],
  S:     [["S", 0, 0]],
  Na:    [["Na", 0, 0]],
  Mg:    [["Mg", 0, 0]],
  Al:    [["Al", 0, 0]],
  Fe:    [["Fe", 0, 0]],
  H2O:   [["O", 0, -0.18], ["H", -0.78, 0.42], ["H", 0.78, 0.42]],
  H2O2:  [["O", -0.52, 0], ["O", 0.52, 0], ["H", -1.12, -0.58], ["H", 1.12, 0.58]],
  NH3:   [["N", 0, 0.1], ["H", -0.86, 0.52], ["H", 0.86, 0.52], ["H", 0, -0.84]],
  HCl:   [["H", -0.58, 0], ["Cl", 0.42, 0]],
  CO:    [["C", -0.52, 0], ["O", 0.52, 0]],
  CO2:   [["O", -0.98, 0], ["C", 0, 0], ["O", 0.98, 0]],
  NO:    [["N", -0.52, 0], ["O", 0.52, 0]],
  NO2:   [["N", 0, -0.2], ["O", -0.86, 0.36], ["O", 0.86, 0.36]],
  CH4:   [["C", 0, 0], ["H", -0.9, 0], ["H", 0.9, 0], ["H", 0, -0.9], ["H", 0, 0.9]],
  C2H6:  [["C", -0.5, 0], ["C", 0.5, 0],
          ["H", -0.5, -0.9], ["H", -0.5, 0.9], ["H", 0.5, -0.9], ["H", 0.5, 0.9],
          ["H", -1.4, 0], ["H", 1.4, 0]],
  C3H8:  [["C", -0.96, 0], ["C", 0, 0], ["C", 0.96, 0],
          ["H", -0.96, -0.9], ["H", -0.96, 0.9], ["H", 0, -0.9], ["H", 0, 0.9],
          ["H", 0.96, -0.9], ["H", 0.96, 0.9], ["H", -1.86, 0], ["H", 1.86, 0]],
  NaCl:  [["Na", -0.58, 0], ["Cl", 0.58, 0]],
  MgO:   [["Mg", -0.52, 0], ["O", 0.52, 0]],
  FeS:   [["Fe", -0.56, 0], ["S", 0.56, 0]],
  CaO:   [["Ca", -0.56, 0], ["O", 0.56, 0]],
  KCl:   [["K", -0.62, 0], ["Cl", 0.62, 0]],
  Fe2O3: [["O", -1.12, 0.36], ["Fe", -0.56, -0.3], ["O", 0, 0.36], ["Fe", 0.56, -0.3], ["O", 1.12, 0.36]],
  Al2O3: [["O", -1.12, 0.36], ["Al", -0.56, -0.3], ["O", 0, 0.36], ["Al", 0.56, -0.3], ["O", 1.12, 0.36]],
  CaCO3: [["Ca", -1.2, 0.1], ["C", 0.3, 0.1], ["O", 0.3, -0.84], ["O", 1.12, 0.56], ["O", -0.52, 0.56]],
  KClO3: [["K", -1.3, 0.1], ["Cl", 0.22, 0.1], ["O", 0.22, -0.92], ["O", 1.06, 0.6], ["O", -0.62, 0.6]],
};

// ─── Reacciones del modo ajuste ─────────────────────────────────────────────
// sol: coeficientes mínimos (solo para comprobar el ajuste y para la guía).
const BALANCE_REACTIONS = [
  { id: "agua",       group: "Sencillas",     name: "Formación de agua",        r: ["H2", "O2"],    p: ["H2O"],        sol: [2, 1, 2] },
  { id: "hcl",        group: "Sencillas",     name: "Cloruro de hidrógeno",     r: ["H2", "Cl2"],   p: ["HCl"],        sol: [1, 1, 2] },
  { id: "amoniaco",   group: "Sencillas",     name: "Síntesis del amoniaco",    r: ["N2", "H2"],    p: ["NH3"],        sol: [1, 3, 2] },
  { id: "mgo",        group: "Sencillas",     name: "Oxidación del magnesio",   r: ["Mg", "O2"],    p: ["MgO"],        sol: [2, 1, 2] },
  { id: "nacl",       group: "Sencillas",     name: "Formación de sal común",   r: ["Na", "Cl2"],   p: ["NaCl"],       sol: [2, 1, 2] },
  { id: "caco3",      group: "Sencillas",     name: "Descomposición de la caliza", r: ["CaCO3"],    p: ["CaO", "CO2"], sol: [1, 1, 1] },
  { id: "h2o2",       group: "Sencillas",     name: "Descomposición del agua oxigenada", r: ["H2O2"], p: ["H2O", "O2"], sol: [2, 2, 1] },
  { id: "no2",        group: "Sencillas",     name: "Dióxido de nitrógeno",     r: ["N2", "O2"],    p: ["NO2"],        sol: [1, 2, 2] },
  { id: "metano",     group: "Combustiones",  name: "Combustión del metano",    r: ["CH4", "O2"],   p: ["CO2", "H2O"], sol: [1, 2, 1, 2] },
  { id: "propano",    group: "Combustiones",  name: "Combustión del propano",   r: ["C3H8", "O2"],  p: ["CO2", "H2O"], sol: [1, 5, 3, 4] },
  { id: "etano",      group: "Combustiones",  name: "Combustión del etano",     r: ["C2H6", "O2"],  p: ["CO2", "H2O"], sol: [2, 7, 4, 6] },
  { id: "carbono",    group: "Combustiones",  name: "Combustión incompleta del carbono", r: ["C", "O2"], p: ["CO"],    sol: [2, 1, 2] },
  { id: "fe2o3",      group: "Más difíciles", name: "Oxidación del hierro",     r: ["Fe", "O2"],    p: ["Fe2O3"],      sol: [4, 3, 2] },
  { id: "al2o3",      group: "Más difíciles", name: "Oxidación del aluminio",   r: ["Al", "O2"],    p: ["Al2O3"],      sol: [4, 3, 2] },
  { id: "kclo3",      group: "Más difíciles", name: "Descomposición del clorato de potasio", r: ["KClO3"], p: ["KCl", "O2"], sol: [2, 2, 3] },
  { id: "ostwald",    group: "Más difíciles", name: "Oxidación del amoniaco",   r: ["NH3", "O2"],   p: ["NO", "H2O"],  sol: [4, 5, 4, 6] },
];

// ─── Reacciones del reactor (ya ajustadas) ──────────────────────────────────
// x, y: elementos que se comparan en la ley de Proust (masa de y / masa de x).
const PROUST_REACTIONS = [
  { id: "agua",  name: "Agua (H₂O)",              r: [["H2", 2], ["O2", 1]],  p: [["H2O", 2]],  x: "H",  y: "O" },
  { id: "h2o2",  name: "Agua oxigenada (H₂O₂)",   r: [["H2", 1], ["O2", 1]],  p: [["H2O2", 1]], x: "H",  y: "O" },
  { id: "co2",   name: "Dióxido de carbono (CO₂)", r: [["C", 1], ["O2", 1]],   p: [["CO2", 1]],  x: "C",  y: "O" },
  { id: "co",    name: "Monóxido de carbono (CO)", r: [["C", 2], ["O2", 1]],   p: [["CO", 2]],   x: "C",  y: "O" },
  { id: "amoniaco", name: "Amoniaco (NH₃)",       r: [["N2", 1], ["H2", 3]],  p: [["NH3", 2]],  x: "H",  y: "N" },
  { id: "fes",   name: "Sulfuro de hierro (FeS)", r: [["Fe", 1], ["S", 1]],   p: [["FeS", 1]],  x: "S",  y: "Fe" },
  { id: "mgo",   name: "Óxido de magnesio (MgO)", r: [["Mg", 2], ["O2", 1]],  p: [["MgO", 2]],  x: "O",  y: "Mg" },
];

const LIMIT_REACTIONS = [
  { id: "agua",     name: "Formación de agua",       r: [["H2", 2], ["O2", 1]],   p: [["H2O", 2]] },
  { id: "amoniaco", name: "Síntesis del amoniaco",   r: [["N2", 1], ["H2", 3]],   p: [["NH3", 2]] },
  { id: "hcl",      name: "Cloruro de hidrógeno",    r: [["H2", 1], ["Cl2", 1]],  p: [["HCl", 2]] },
  { id: "mgo",      name: "Oxidación del magnesio",  r: [["Mg", 2], ["O2", 1]],   p: [["MgO", 2]] },
  { id: "fes",      name: "Sulfuro de hierro",       r: [["Fe", 1], ["S", 1]],    p: [["FeS", 1]] },
  { id: "metano",   name: "Combustión del metano",   r: [["CH4", 1], ["O2", 2]],  p: [["CO2", 1], ["H2O", 2]] },
  { id: "propano",  name: "Combustión del propano",  r: [["C3H8", 1], ["O2", 5]], p: [["CO2", 3], ["H2O", 4]] },
];

// ─── Utilidades ─────────────────────────────────────────────────────────────
const _compCache = {};
// Composición de una especie: { H: 2, O: 1 }
function composition(f) {
  if (_compCache[f]) return _compCache[f];
  let c = {};
  for (let a of SPECIES[f]) c[a[0]] = (c[a[0]] || 0) + 1;
  return (_compCache[f] = c);
}

function molarMass(f) {
  let m = 0;
  for (let a of SPECIES[f]) m += ELEMENTS[a[0]].mass;
  return m;
}

// Elementos que aparecen en una lista de especies, en orden de aparición.
function elementsOf(list) {
  let out = [];
  for (let f of list) for (let a of SPECIES[f]) if (!out.includes(a[0])) out.push(a[0]);
  return out;
}

// Átomos de cada elemento en un lado: species[i] × coef[i]
function atomCount(species, coefs) {
  let c = {};
  species.forEach((f, i) => {
    let comp = composition(f);
    for (let el in comp) c[el] = (c[el] || 0) + comp[el] * coefs[i];
  });
  return c;
}

function gcd(a, b) { while (b) { [a, b] = [b, a % b]; } return a; }
function gcdList(list) { return list.reduce((g, v) => gcd(g, v), 0); }

// Fórmula en HTML con subíndices: "C3H8" → "C<sub>3</sub>H<sub>8</sub>"
function formulaHTML(f) {
  return f.replace(/(\d+)/g, "<sub>$1</sub>");
}

// Fórmula con subíndices Unicode, para <option> (no admite HTML).
const SUB_DIGITS = "₀₁₂₃₄₅₆₇₈₉";
function formulaUnicode(f) {
  return f.replace(/\d/g, d => SUB_DIGITS[+d]);
}

// Trozos de una fórmula para dibujarla en el lienzo: [{t:"C"}, {t:"3", sub:true}, …]
function formulaTokens(f) {
  let out = [];
  let re = /([A-Z][a-z]?)|(\d+)/g, m;
  while ((m = re.exec(f))) out.push(m[1] ? { t: m[1] } : { t: m[2], sub: true });
  return out;
}

// Caja que ocupa una plantilla (unidades de enlace), contando el radio de los átomos.
function speciesExtent(f) {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (let [el, x, y] of SPECIES[f]) {
    let r = ELEMENTS[el].r;
    x0 = Math.min(x0, x - r); x1 = Math.max(x1, x + r);
    y0 = Math.min(y0, y - r); y1 = Math.max(y1, y + r);
  }
  return { w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, r: Math.hypot(x1 - x0, y1 - y0) / 2 };
}
