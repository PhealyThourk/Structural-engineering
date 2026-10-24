"use strict";
const $ = (id) => document.getElementById(id),
  number = (id) => Number($(id).value),
  round = (x, n = 3) => (Number.isFinite(x) ? Number(x.toFixed(n)) : x),
  fmt = (x, n = 2) => (Number.isFinite(x) ? x.toFixed(n) : "—");
let db, tables;
// 1. Load data and connect the calculator interface.
async function init() {
  try {
    [db, tables] = await Promise.all([
      fetch("steel-section-database.json").then((r) => {
        if (!r.ok) throw Error("Could not load steel-section-database.json");
        return r.json();
      }),
      fetch("steel-ltb-tables.json").then((r) => {
        if (!r.ok) throw Error("Could not load steel-ltb-tables.json");
        return r.json();
      }),
    ]);
    $("series").innerHTML = db.series
      .map((s, i) => `<option value="${i}">${s.name}</option>`)
      .join("");
    fillSections();
    $("series").addEventListener("change", fillSections);
    $("section").addEventListener("change", showSection);
    $("run").addEventListener("click", run);
    $("reset").addEventListener("click", () => location.reload());
    document.querySelectorAll(".tab").forEach(
      (b) =>
        (b.onclick = () => {
          b.classList.add("active");
          $(b.dataset.pane).classList.add("active");
        }),
    );
    showSection();
  } catch (e) {
    showError(e.message);
  }
}
function fillSections() {
  let s = db.series[+$("series").value];
  $("section").innerHTML = s.sections
    .map((x) => `<option>${x.name}</option>`)
    .join("");
  if (s.name.startsWith("IPE"))
    $("section").value = s.sections.some((x) => x.name === "IPE 330")
      ? "IPE 330"
      : s.sections[0].name;
  else
    $("section").value = s.sections.some((x) => x.name === "HEB 300")
      ? "HEB 300"
      : s.sections[0].name;
  showSection();
}
function sec() {
  return db.series[+$("series").value].sections.find(
    (s) => s.name === $("section").value,
  );
}
function showSection() {
  const s = sec();
  if (!s) return;
  $("section-summary").innerHTML =
    `Selected profile: <b>${s.name}</b><br>h ${s["h[mm]"]} mm · b ${s["b[mm]"]} mm · A ${s["A[cm2]"]} cm² · Iy ${s["Iy[cm4]"]} cm⁴ · Iz ${s["Iz[cm4]"]} cm⁴`;
}
function steel() {
  let grade = $("grade").value,
    t = Math.max(sec()["tw[mm]"], sec()["tf[mm]"]),
    hi = ["S460", "S500", "S550", "S600", "S650", "S690", "S700"].includes(
      grade,
    ),
    vals = {
      S235: [235, 360, 215, 360],
      S275: [275, 390, 245, 370],
      S355: [355, 490, 325, 470],
      S420: [420, 510, 390, 490],
      S460: [460, 540, 410, 510],
      S500: [500, 580, 450, 580],
      S550: [550, 600, 500, 600],
      S600: [600, 650, 550, 650],
      S620: [620, 700, 560, 660],
      S650: [650, 700, null, null],
      S690: [690, 770, 630, 710],
      S700: [700, 750, null, null],
    }[grade];
  if (t > 40 && t <= 80) {
    if (!vals[2])
      throw Error(
        `${grade} has no tabulated strength above 40 mm in the supplied Python procedure.`,
      );
    return { fy: vals[2], fu: vals[3] };
  }
  return { fy: vals[0], fu: vals[1] };
}
// 2. Section classification and resistance procedures.
function classifySection(s, fy, v) {
  const eps = Math.sqrt(235 / fy),
    A = s["A[cm2]"],
    h = s["h[mm]"],
    b = s["b[mm]"],
    tw = s["tw[mm]"],
    tf = s["tf[mm]"],
    r = s["r1[mm]"],
    cw = h - 2 * tf - 2 * r,
    cf = b / 2 - r - tf / 2,
    gm = number("gm0"),
    N = v.N,
    My = v.My,
    Mz = v.Mz,
    welY = s["Wy[cm3]"],
    welZ = s["Wz[cm3]"],
    Iz = s["Iz[cm4]"];
  const clamp = (x) => Math.max(0, Math.min(1, x)),
    cls = (x, a, b, c, d) =>
      x <= a ? 1 : x <= b ? 2 : x <= c ? 3 : x <= d ? 3 : 4,
    adj = (sigma) => (sigma > 0 ? eps + Math.sqrt(fy / (gm * sigma)) : eps);
  let lim = Math.max(1e-9, cw * tw * fy),
    alpha = clamp(0.5 * (1 + N / lim)),
    top = (N * 10) / A + (Math.abs(My) * 1000) / welY,
    bottom = (N * 10) / A - (Math.abs(My) * 1000) / welY,
    comp = Math.max(top, bottom),
    l1,
    l2,
    l3,
    l3a;
  if (N === 0 && My !== 0) {
    l1 = 72 * eps;
    l2 = 83 * eps;
    l3 = 121 * eps;
    l3a = 121 * adj(comp);
  } else if (N > 0 && My === 0) {
    l1 = 28 * eps;
    l2 = 34 * eps;
    l3 = 38 * eps;
    l3a = 38 * adj(comp);
  } else if (N < 0) {
    l1 = 72 * eps;
    l2 = 83 * eps;
    l3 = 121 * eps;
    l3a = 121 * adj(comp);
  } else if (N !== 0 && My !== 0) {
    l1 =
      alpha > 0.5
        ? (126 * eps) / (5.5 * alpha - 1)
        : (36 * eps) / Math.max(alpha, 1e-9);
    l2 =
      alpha > 0.5
        ? (188 * eps) / (6.53 * alpha - 1)
        : (41.5 * eps) / Math.max(alpha, 1e-9);
    let psi = top !== 0 ? bottom / top : 1,
      factor =
        psi > -1
          ? 38 / (0.608 + 0.343 * psi + 0.049 * psi * psi)
          : 60.5 * (1 - psi);
    l3 = factor * eps;
    l3a = factor * adj(comp);
  } else {
    l1 = 72 * eps;
    l2 = 83 * eps;
    l3 = 121 * eps;
    l3a = l3;
  }
  let web = cls(cw / tw, l1, l2, l3, l3a);
  function flange(tip) {
    let e =
        (N * 10) / A +
        (Math.abs(My) * 1000) / welY +
        ((tip === 1 ? 1 : -1) * Math.abs(Mz) * 1000) / welZ,
      near =
        (N * 10) / A +
        (Math.abs(My) * 1000) / welY +
        ((tip === 1 ? 1 : -1) * Math.abs(Mz) * 100 * (r + 0.5 * tw)) / Iz;
    let a, b, c, d;
    if ((N > 0 || My !== 0) && Mz === 0) {
      a = 9 * eps;
      b = 10 * eps;
      c = 14 * eps;
      d = 14 * adj(Math.max(e, near));
    } else {
      let fLim = Math.max(1e-9, cf * tf * fy),
        nt =
          N +
          My / Math.max(1, h - tf) +
          (Math.abs(Mz) / (b / 2)) * (tip === 1 ? 1 : -1),
        ac = clamp(0.5 * (1 + nt / fLim));
      a = (9 * eps) / Math.max(ac, 1e-9);
      b = (10 * eps) / Math.max(ac, 1e-9);
      let psi =
          tip === 1 ? (e !== 0 ? near / e : 1) : near !== 0 ? e / near : 1,
        ks =
          psi === 1
            ? 4
            : psi > 0
              ? 8.2 / (1.05 + psi)
              : psi === 0
                ? 7.81
                : psi > -1
                  ? 7.81 - 6.29 * psi + 9.78 * psi * psi
                  : psi === -1
                    ? 23.9
                    : psi >= -3
                      ? 5.98 * (1 - psi) ** 2
                      : 95.68;
      c = 21 * eps * Math.sqrt(ks);
      d = 21 * adj(Math.max(e, near)) * Math.sqrt(ks);
    }
    return cls(cf / tf, a, b, c, d);
  }
  return {
    web,
    flange: Math.max(flange(1), flange(2)),
    overall: Math.max(web, flange(1), flange(2)),
    epsilon: eps,
  };
}
// 3. Member stability and Mcr case-table calculations.
function buckling(s, fy, axis) {
  let curve,
    ratio = s["h[mm]"] / s["b[mm]"],
    tf = s["tf[mm]"];
  if (ratio > 1.2)
    curve = tf <= 40 ? (axis === "y" ? "a" : "b") : axis === "y" ? "b" : "c";
  else curve = tf <= 100 ? (axis === "y" ? "b" : "c") : "d";
  if (
    ["S460", "S500", "S550", "S600", "S650", "S700"].includes($("grade").value)
  )
    curve = { a: "a0", b: "a", c: "b", d: "c" }[curve] || curve;
  let alpha = { a0: 0.13, a: 0.21, b: 0.34, c: 0.49, d: 0.76 }[curve],
    i = s[axis === "y" ? "iy[mm]" : "iz[mm]"],
    L = number(axis === "y" ? "Lcry" : "Lcrz") * 1000,
    lb = L / i / (Math.PI * Math.sqrt(210000 / fy)),
    phi = 0.5 * (1 + alpha * (lb - 0.2) + lb * lb),
    chi = Math.min(1, 1 / (phi + Math.sqrt(Math.max(0, phi * phi - lb * lb))));
  return {
    curve,
    alpha,
    lambda: lb,
    chi,
    Nb: (chi * s["A[cm2]"] * fy * 0.1) / number("gm1"),
  };
}
function reduction(alpha, lambda) {
  let phi = 0.5 * (1 + alpha * (lambda - 0.2) + lambda * lambda);
  return Math.min(
    1,
    1 / (phi + Math.sqrt(Math.max(0, phi * phi - lambda * lambda))),
  );
}
function curveFor(s, fy, axis, result) {
  let pts = [];
  for (let x = 0; x <= 3.001; x += 0.03)
    pts.push([x, reduction(result.alpha, x)]);
  return svgPlot(
    pts,
    [result.lambda, result.chi],
    `Flexural buckling ${axis}-axis`,
    result.curve,
  );
}
function svgPlot(points, mark, title, curve) {
  let W = 700,
    H = 280,
    L = 52,
    R = 18,
    T = 24,
    B = 38,
    px = (x) => L + (x / 3) * (W - L - R),
    py = (y) => T + ((1 - y) / (1 - 0.05)) * (H - T - B),
    poly = points.map((p) => `${px(p[0])},${py(p[1])}`).join(" ");
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${title}"><text x="${W / 2}" y="16" text-anchor="middle" fill="#24364c" font-size="14">${title} · curve ${curve}</text>${[0, 0.2, 0.4, 0.6, 0.8, 1].map((y) => `<line x1="${L}" y1="${py(y)}" x2="${W - R}" y2="${py(y)}" stroke="#dce4ed"/><text x="${L - 8}" y="${py(y) + 4}" text-anchor="end" fill="#66778c" font-size="10">${y.toFixed(1)}</text>`).join("")}<polyline fill="none" stroke="#175db1" stroke-width="3" points="${poly}"/><circle cx="${px(mark[0])}" cy="${py(mark[1])}" r="6" fill="#e3473c"><title>λ̄=${fmt(mark[0], 3)}, χ=${fmt(mark[1], 3)}</title></circle><text x="${W / 2}" y="${H - 7}" text-anchor="middle" fill="#53647a" font-size="11">Relative slenderness λ̄</text><text x="14" y="${H / 2}" transform="rotate(-90 14 ${H / 2})" text-anchor="middle" fill="#53647a" font-size="11">Reduction factor χ</text></svg>`;
}
function bracket(a, x) {
  let i = 0;
  while (i < a.length - 2 && x > a[i + 1]) i++;
  return i;
}
function bilinear(mu, kl, caseNo, loc) {
  let muAxis =
      caseNo === 2
        ? tables.mu_values
        : caseNo === 5
          ? tables.mu_value_case5
          : tables.mu_values_case3,
    klAxis = [0, 1, 2, 3, 4, 6, 8, 10, 15, 20],
    suffix =
      loc === "top"
        ? "topflange"
        : loc === "bottom"
          ? "bottomflange"
          : "middle",
    m = `m${caseNo}_table_${suffix}`;
  if (!tables[m]) throw Error("Mcr table data missing for selected case.");
  mu = Math.max(muAxis[0], Math.min(muAxis.at(-1), mu));
  kl = Math.max(0, Math.min(20, kl));
  let i = bracket(muAxis, mu),
    j = bracket(klAxis, kl),
    u = (mu - muAxis[i]) / (muAxis[i + 1] - muAxis[i]),
    v = (kl - klAxis[j]) / (klAxis[j + 1] - klAxis[j]),
    a = tables[m];
  return (
    a[i][j] * (1 - u) * (1 - v) +
    a[i + 1][j] * u * (1 - v) +
    a[i][j + 1] * (1 - u) * v +
    a[i + 1][j + 1] * u * v
  );
}
function mcrFromCase(s, v) {
  let E = 210000,
    G = 81000,
    L = v.LcrLT * 1000,
    Iz = s["Iz[cm4]"] * 1e4,
    It = s["It[cm4]"] * 1e4,
    Iw = s["Iω[cm6]"] * 1e6,
    ht = s["h[mm]"] - s["tf[mm]"],
    kl = Math.sqrt((G * It * L * L) / (E * Iw)),
    c = +$("case").value,
    loc = $("loadloc").value,
    location =
      loc === "topflange"
        ? "top"
        : loc === "bottomflange"
          ? "bottom"
          : "middle",
    mu = v.mu;
  let maxMu = { 2: 0.25, 3: 1 / 6, 4: 1 / 6, 5: 0.125 }[c];
  if (mu < 0 || mu > maxMu)
    throw Error(`For load case ${c}, μ must be between 0 and ${maxMu}.`);
  if (c === 2 || c === 3 || c === 4 || c === 5) {
    let m = bilinear(mu, kl, c, location),
      q = ((E * Iz) / (L * L)) * ht * m;
    let cr =
      c === 2
        ? Math.max(Math.abs(q / 4 - 0.5 * q * mu), q * mu)
        : c === 3
          ? Math.max(Math.abs(q / 4 - q * mu), q * mu)
          : c === 4
            ? Math.max(Math.abs(q / 8 - 0.5 * q * mu), q * mu)
            : Math.max(Math.abs(q / 8 - q * mu), q * mu);
    return cr / 1e6;
  }
  throw Error("Selected Mcr case is not supported.");
}
// 4. Equivalent-moment and interaction-factor calculations.
function cmFactor(shape, psi, alpha, load) {
  shape = +shape;
  if (shape === 1) return Math.max(0.6 + 0.4 * psi, 0.4);
  if (shape === 2) {
    if (alpha >= 0) return Math.max(0.2 + 0.8 * alpha, 0.4);
    if (load === "Uniform")
      return Math.max(
        psi >= 0 ? 0.1 - 0.8 * alpha : 0.1 * (1 - psi) - 0.8 * alpha,
        0.4,
      );
    return Math.max(psi >= 0 ? -0.8 * alpha : -0.2 * psi - 0.8 * alpha, 0.4);
  }
  if (shape === 3) {
    if (alpha >= 0 || psi >= 0)
      return (
        (load === "Uniform" ? 0.95 : 0.9) +
        (load === "Uniform" ? 0.05 : 0.1) * alpha
      );
    return (
      (load === "Uniform" ? 0.95 : 0.9) +
      (load === "Uniform" ? 0.05 : 0.1) * alpha * (1 + 2 * psi)
    );
  }
  throw Error("Invalid equivalent moment shape.");
}
function interactionFactors(v, ny, nz, cy, cz, cLT, ly, lz, cls) {
  let plastic = cls <= 3,
    kyy = plastic
      ? cy * (1 + (ly < 1 ? ly - 0.2 : 0.8) * ny)
      : cy * (1 + 0.6 * (ly < 1 ? ly : 1) * ny),
    kzy = plastic
      ? lz < 1
        ? Math.min(
            1 - (0.1 * lz * nz) / (cLT - 0.25),
            lz < 0.4 ? 0.6 + lz : Infinity,
          )
        : 1 - (0.1 * nz) / (cLT - 0.25)
      : lz < 1
        ? 1 - (0.05 * lz * nz) / (cLT - 0.25)
        : 1 - (0.05 * nz) / (cLT - 0.25),
    kzz = plastic
      ? cz * (1 + (lz < 1 ? 2 * lz - 0.6 : 1.4) * nz)
      : cz * (1 + 0.6 * (lz < 1 ? lz : 1) * nz),
    kyz = (plastic ? 0.6 : 1) * kzz;
  return { kyy, kyz, kzy, kzz };
}
// 5. Read values and run the design check.
function read() {
  let o = {};
  [
    "N",
    "My",
    "Mz",
    "Vz",
    "Vy",
    "T",
    "B",
    "hole",
    "kfactor",
    "gm0",
    "gm1",
    "gm2",
    "Lcry",
    "Lcrz",
    "LcrT",
    "dz",
    "LcrLT",
    "Mcr",
    "mu",
    "psiY",
    "alphaY",
    "psiZ",
    "alphaZ",
    "psiLT",
    "alphaLT",
  ].forEach((k) => (o[k] = number(k)));
  return o;
}
function run() {
  try {
    $("error").style.display = "none";
    let v = read(),
      s = sec(),
      mat = steel(),
      fy = mat.fy,
      fu = mat.fu,
      E = 210000,
      G = 81000,
      gm0 = v.gm0,
      area = s["A[cm2]"],
      Anet = area - v.hole;
    if (Anet <= 0)
      throw Error("Hole area must be smaller than the gross section area.");
    if (v.kfactor <= 0 || v.kfactor > 1)
      throw Error(
        "Net section factor k must be greater than zero and no more than 1.",
      );
    if ([v.Lcry, v.Lcrz, v.LcrT, v.LcrLT].some((x) => x <= 0))
      throw Error("All buckling lengths must be greater than zero.");
    let nRd = (area * fy * 0.1) / gm0,
      nuRd = (v.kfactor * Anet * fu * 0.1) / v.gm2,
      myRd = (s["Wpl,y[cm3]"] * fy * 0.001) / gm0,
      mzRd = (s["Wpl,z[cm3]"] * fy * 0.001) / gm0,
      vyArea = Math.max(
        area * 100 -
          2 * s["b[mm]"] * s["tf[mm]"] +
          (s["tw[mm]"] + 2 * s["r1[mm]"]) * s["tf[mm]"],
        (s["h[mm]"] - 2 * s["tf[mm]"]) * s["tw[mm]"],
      ),
      vpl = ((vyArea * fy) / Math.sqrt(3) / gm0) * 0.001,
      tau = ((Math.abs(v.T) * s["tw[mm]"]) / s["It[cm4]"]) * 100,
      term = 1 - tau / ((1.25 * (fy / Math.sqrt(3))) / gm0);
    if (term < 0)
      throw Error(
        "Torsional shear exceeds the range supported by the supplied plastic shear interaction equation.",
      );
    let vplT = Math.sqrt(term) * vpl;
    let FB_y = buckling(s, fy, "y"),
      FB_z = buckling(s, fy, "z");
    let Iw = s["Iω[cm6]"] * 1e6,
      It = s["It[cm4]"] * 1e4,
      Amm = area * 100,
      Iy = s["Iy[cm4]"] * 1e4,
      Iz = s["Iz[cm4]"] * 1e4,
      ip = s["ip[mm]"],
      ic2 = s["yc[mm]"] ** 2 + (Iy + Iz) / Amm,
      Lt = v.LcrT * 1000,
      Lz = v.Lcrz * 1000,
      NcrZ = (Math.PI ** 2 * E * Iz) / Lz ** 2 / 1000,
      NcrT = (G * It + (Math.PI ** 2 * E * Iw) / Lt ** 2) / ic2 / 1000,
      Npl = (Amm * fy) / 1000,
      lambdaT = Math.sqrt(Npl / NcrT),
      lambdaZ = Math.sqrt(Npl / NcrZ),
      hbr = s["h[mm]"] / s["b[mm]"],
      curveT =
        hbr > 1.2
          ? s["tf[mm]"] <= 40
            ? "b"
            : "c"
          : s["tf[mm]"] <= 100
            ? "c"
            : "d";
    if (
      ["S460", "S500", "S550", "S600", "S650", "S690", "S700"].includes(
        $("grade").value,
      )
    )
      curveT =
        hbr > 1.2
          ? s["tf[mm]"] <= 40
            ? "a"
            : "b"
          : s["tf[mm]"] <= 100
            ? "b"
            : "c";
    let aT = { a0: 0.13, a: 0.21, b: 0.34, c: 0.49, d: 0.76 }[curveT],
      aTF = Math.min(
        aT,
        aT * Math.sqrt((Amm * fy * (ip * ip + v.dz * v.dz)) / (6.25 * G * It)),
      ),
      phiT =
        0.5 *
        (1 + (lambdaT / lambdaZ) ** 2 * aTF * (lambdaZ - 0.2) + lambdaT ** 2),
      chiT = Math.min(
        1,
        1 / (phiT + Math.sqrt(Math.max(0, phiT * phiT - lambdaT * lambdaT))),
      ),
      NbT = (chiT * Npl) / v.gm1;
    let ncrY = (Math.PI ** 2 * E * Iy) / (v.Lcry * 1000) ** 2 / 1000,
      ic = Math.sqrt(ic2),
      beta = 1 - (s["yc[mm]"] / ic) ** 2,
      ncrTF =
        (ncrY +
          NcrT -
          Math.sqrt(Math.max(0, (ncrY + NcrT) ** 2 - 4 * beta * ncrY * NcrT))) /
        (2 * beta),
      lambdaTF = Math.sqrt(Npl / ncrTF),
      phiTF =
        0.5 *
        (1 + (lambdaTF / lambdaZ) ** 2 * aTF * (lambdaZ - 0.2) + lambdaTF ** 2),
      chiTF = Math.min(
        1,
        1 / (phiTF + Math.sqrt(Math.max(0, phiTF ** 2 - lambdaTF ** 2))),
      ),
      NbTF = (chiTF * Npl) / v.gm1;
    let mcr = v.Mcr;
    if (mcr <= 0) mcr = mcrFromCase(s, v);
    let myRk = s["Wpl,y[cm3]"] * fy * 0.001;
    let lambdaLT = Math.sqrt(myRk / mcr);
    let alphaLT = s["h[mm]"] / s["b[mm]"] <= 2 ? 0.21 : 0.34;
    let ltbRequired = lambdaLT > 0.4 && Math.abs(v.My) > 0.16 * mcr;
    let phiLT = 0.5 * (1 + alphaLT * (lambdaLT - 0.2) + lambdaLT * lambdaLT);
    let chiLT = ltbRequired
      ? Math.min(
          1,
          1 /
            (phiLT +
              Math.sqrt(Math.max(0, phiLT * phiLT - lambdaLT * lambdaLT))),
        )
      : 1;
    let mbRd = (ltbRequired ? chiLT * myRk : myRk) / v.gm1;
    let myReduced =
        myRd *
        Math.sqrt(
          Math.max(
            0,
            1 -
              Math.abs(v.B) /
                Math.max(
                  1e-9,
                  (0.25 *
                    s["tf[mm]"] *
                    s["b[mm]"] ** 2 *
                    (s["h[mm]"] - s["tf[mm]"]) *
                    fy *
                    1e-9) /
                    gm0,
                ),
          ),
        ),
      classification = classifySection(s, fy, v),
      secClass = classification.overall;
    if (secClass === 3 && $("annex").value === "no")
      throw Error(
        "This section is Class 3. Enable the Annex B method to continue, as required by the supplied Python procedure.",
      );
    if (secClass === 3) {
      let eps = Math.sqrt(235 / fy),
        cw = s["h[mm]"] - 2 * s["tf[mm]"] - 2 * s["r1[mm]"],
        cf = (s["b[mm]"] - s["tw[mm]"] - 2 * s["r1[mm]"]) / 2,
        bY = Math.min(
          1,
          Math.max(
            cf / (s["tf[mm]"] * 4 * eps) - 2.5,
            cw / (s["tw[mm]"] * 38 * eps) - 83 / 38,
            0,
          ),
        ),
        bZ = Math.min(1, Math.max(cf / (s["tf[mm]"] * 6 * eps) - 10 / 6, 0)),
        wY = s["Wpl,y[cm3]"] - (s["Wpl,y[cm3]"] - s["Wy[cm3]"]) * bY,
        wZ = s["Wpl,z[cm3]"] - (s["Wpl,z[cm3]"] - s["Wz[cm3]"]) * bZ;
      myRd = (wY * fy * 0.001) / gm0;
      mzRd = (wZ * fy * 0.001) / gm0;
      myReduced =
        myRd *
        Math.sqrt(
          Math.max(
            0,
            1 -
              Math.abs(v.B) /
                Math.max(
                  1e-9,
                  (0.25 *
                    s["tf[mm]"] *
                    s["b[mm]"] ** 2 *
                    (s["h[mm]"] - s["tf[mm]"]) *
                    fy *
                    1e-9) /
                    gm0,
                ),
          ),
        );
      lambdaLT = Math.sqrt((myRd * gm0) / mcr);
      phiLT = 0.5 * (1 + alphaLT * (lambdaLT - 0.2) + lambdaLT * lambdaLT);
      ltbRequired = lambdaLT > 0.4 && Math.abs(v.My) > 0.16 * mcr;
      chiLT = ltbRequired
        ? Math.min(
            1,
            1 /
              (phiLT +
                Math.sqrt(Math.max(0, phiLT * phiLT - lambdaLT * lambdaLT))),
          )
        : 1;
      mbRd = (ltbRequired ? chiLT * myRd * gm0 : myRd * gm0) / v.gm1;
    }
    if (secClass === 4)
      throw Error(
        "Class 4 sections are not available in the supplied Python procedure. Choose a stockier section.",
      );
    let hw = s["h[mm]"] - 2 * s["tf[mm]"],
      wyUsed = (myRd * gm0) / (fy * 0.001),
      wzUsed = (mzRd * gm0) / (fy * 0.001),
      wB = 0.25 * s["tf[mm]"] * s["b[mm]"] ** 2 * (hw + s["tf[mm]"]),
      bRd = (wB * fy * 1e-9) / gm0;
    if (bRd <= 0 || 1 - v.B / bRd < 0)
      throw Error("Bimoment exceeds the supported plastic resistance.");
    let myB = Math.sqrt(1 - v.B / bRd) * myRd,
      myBV = myB;
    if (Math.abs(v.Vz) > 0.5 * vplT) {
      let rho = ((2 * Math.abs(v.Vz)) / vplT - 1) ** 2,
        myShear =
          (((wyUsed - (rho * (s["tw[mm]"] * hw ** 2)) / 4) * fy) / gm0) * 0.001;
      myBV = Math.min(myShear * (myB / myRd), myB);
    }
    let a = Math.min(
        (area * 100 - 2 * s["b[mm]"] * s["tf[mm]"]) / (area * 100),
        0.5,
      ),
      n = Math.abs(v.N / nRd),
      myBVN = myBV;
    if (
      !(v.N <= 0.25 * nRd && v.N <= (0.5 * hw * s["tw[mm]"] * fy * 0.001) / gm0)
    )
      myBVN = Math.min((myBV * (1 - n)) / (1 - 0.5 * a), myBV);
    let mNzRd = mzRd;
    if (v.N > (hw * s["tw[mm]"] * fy * 0.001) / gm0 && n > a)
      mNzRd = mzRd * (1 - ((n - a) / (1 - a)) ** 2);
    if (myBVN <= 0 || mNzRd <= 0)
      throw Error("Design action exceeds cross-section resistance.");
    myReduced = myBVN;
    let nRdUse = v.N > 0 ? nRd : Math.min(nRd, nuRd);
    let ratios = {
      "Axial cross-section": Math.abs(v.N) / nRdUse,
      "Bending y-axis": Math.abs(v.My) / myReduced,
      "Bending z-axis": Math.abs(v.Mz) / mNzRd,
      "Shear z-direction": Math.abs(v.Vz) / vplT,
      "Flexural buckling y-axis": v.N > 0 ? v.N / FB_y.Nb : 0,
      "Flexural buckling z-axis": v.N > 0 ? v.N / FB_z.Nb : 0,
      "Torsional buckling": v.N > 0 ? v.N / NbT : 0,
      "Torsional-flexural buckling": v.N > 0 ? v.N / NbTF : 0,
      "Lateral torsional buckling": Math.abs(v.My) / mbRd,
    };
    let biax =
      Math.abs(v.My) > 0 && Math.abs(v.Mz) > 0
        ? (v.My / myReduced) ** 2 +
          (v.Mz / mNzRd) ** Math.max(1, (5 * v.N) / nRd)
        : Math.max(ratios["Bending y-axis"], ratios["Bending z-axis"]);
    ratios["Biaxial bending"] = biax;
    let ny = v.N > 0 ? v.N / FB_y.Nb : 0,
      nz = v.N > 0 ? v.N / FB_z.Nb : 0,
      cy = cmFactor($("Cmy").value, v.psiY, v.alphaY, $("loadtype").value),
      cz = cmFactor($("Cmz").value, v.psiZ, v.alphaZ, $("loadtype").value),
      cLT = cmFactor($("CmLT").value, v.psiLT, v.alphaLT, $("loadtype").value),
      kf = interactionFactors(
        v,
        ny,
        nz,
        cy,
        cz,
        cLT,
        FB_y.lambda,
        FB_z.lambda,
        secClass,
      ),
      nTFutil = v.N > 0 ? v.N / NbTF : 0,
      kTF = interactionFactors(
        v,
        ny,
        nTFutil,
        cy,
        cz,
        cLT,
        FB_y.lambda,
        lambdaTF,
        secClass,
      ),
      nrk = area * fy * 0.1,
      myrk = myRd * gm0,
      mzrk = mzRd * gm0,
      ne = Math.max(0, v.N),
      eq88 =
        ne / ((FB_y.chi * nrk) / v.gm1) +
        (kf.kyy * Math.abs(v.My)) / ((chiLT * myrk) / v.gm1) +
        (kf.kyz * Math.abs(v.Mz)) / (mzrk / v.gm1),
      eq89 =
        ne / ((FB_z.chi * nrk) / v.gm1) +
        (kf.kzy * Math.abs(v.My)) / ((chiLT * myrk) / v.gm1) +
        (kf.kzz * Math.abs(v.Mz)) / (mzrk / v.gm1);
    ratios["Combined interaction · Eq. 8.88"] = eq88;
    ratios["Combined interaction · Eq. 8.89"] = eq89;
    let eq88TF =
        ne / ((chiTF * nrk) / v.gm1) +
        (kTF.kyy * Math.abs(v.My)) / ((chiLT * myrk) / v.gm1) +
        (kTF.kyz * Math.abs(v.Mz)) / (mzrk / v.gm1),
      eq89TF =
        ne / ((chiTF * nrk) / v.gm1) +
        (kTF.kzy * Math.abs(v.My)) / ((chiLT * myrk) / v.gm1) +
        (kTF.kzz * Math.abs(v.Mz)) / (mzrk / v.gm1);
    ratios["Combined interaction · Eq. 8.88, TF"] = eq88TF;
    ratios["Combined interaction · Eq. 8.89, TF"] = eq89TF;
    let gov = Object.entries(ratios).sort((a, b) => b[1] - a[1])[0],
      pass = gov[1] <= 1;
    render({
      v,
      s,
      mat,
      secClass,
      FB_y,
      FB_z,
      lambdaT,
      chiT,
      NbT,
      lambdaTF,
      chiTF,
      NbTF,
      lambdaLT,
      chiLT,
      mbRd,
      mcr,
      nRd,
      nuRd,
      nRdUse,
      myRd,
      myReduced,
      mzRd,
      mNzRd,
      vplT,
      ncrT: NcrT,
      ncrTF,
      kFlex: kf,
      kTF,
      lambdaZ,
      aTF,
      alphaLT,
      ltbRequired,
      ratios,
      gov,
      pass,
      curveY: curveFor(s, fy, "y", FB_y),
      curveZ: curveFor(s, fy, "z", FB_z),
    });
    document
      .querySelectorAll(".tab,.pane")
      .forEach((x) => x.classList.remove("active"));
    $("results-pane").scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (e) {
    showError(e.message);
  }
}
// 6. Assemble the report preview and print layout.
function escapeHtml(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[char],
  );
}

function reportTable(rows) {
  return `<table class="report-table"><thead><tr><th>Quantity</th><th>Symbol</th><th>Result</th><th>Reference</th></tr></thead><tbody>${rows.map(([name, symbol, value, reference = ""]) => `<tr><td>${name}</td><td class="symbol">${symbol}</td><td class="value">${value}</td><td class="reference">${reference}</td></tr>`).join("")}</tbody></table>`;
}

function reportSection(title, rows, options = {}) {
  const { className = "", formula = "" } = options;
  return `<section class="report-subsection ${className}"><h3>${title}</h3>${reportTable(rows)}${formula ? `<p class="report-formula">${formula}</p>` : ""}</section>`;
}

function reportUtilizationChart(ratios) {
  const maximumRatio = Math.max(0, ...ratios.map(([, value]) => value));
  const scaleMaximum = Math.max(1.2, Math.ceil(maximumRatio * 4) / 4);
  const ticks = [...new Set([0, scaleMaximum / 2, 1, scaleMaximum])].sort(
    (a, b) => a - b,
  );
  const rows = ratios
    .map(([name, value]) => {
      const width = Math.min(100, (value / scaleMaximum) * 100);
      const status = value <= 1 ? "PASS" : "FAIL";
      const statusClass = value <= 1 ? "pass" : "fail";
      const limitPosition = (1 / scaleMaximum) * 100;
      return `<div class="utilization-row"><span class="utilization-name">${escapeHtml(name)}</span><span class="utilization-track" style="--limit-position:${limitPosition}%"><i class="utilization-bar ${statusClass}" style="width:${width}%"></i></span><strong class="utilization-value ${statusClass}">${fmt(value, 3)} · ${status}</strong></div>`;
    })
    .join("");
  const axisLabels = ticks
    .map(
      (value) =>
        `<span style="left:${(value / scaleMaximum) * 100}%">${fmt(value, 2)}</span>`,
    )
    .join("");

  return `<div class="utilization-chart" role="img" aria-label="Horizontal utilization ratio chart. The design limit is 1.00."><div class="utilization-chart__heading"><strong>Utilization ratio by design check</strong><span><i></i> Design limit = 1.00</span></div><div class="utilization-chart__rows">${rows}</div><div class="utilization-axis"><span></span><span class="utilization-axis__ticks">${axisLabels}</span><span></span></div></div>`;
}

function reportCurve(title, alpha, lambda, chi, color, coupledLambda = null) {
  const formula = (x) => {
    const phi =
      coupledLambda === null
        ? 0.5 * (1 + alpha * (x - 0.2) + x * x)
        : 0.5 *
          (1 +
            (x / coupledLambda) ** 2 * alpha * (coupledLambda - 0.2) +
            x * x);
    return Math.min(1, 1 / (phi + Math.sqrt(Math.max(0, phi * phi - x * x))));
  };
  const points = Array.from({ length: 101 }, (_, index) => {
    const x = index * 0.03;
    return [x, formula(x)];
  });
  const W = 720,
    H = 330,
    left = 58,
    right = 24,
    top = 30,
    bottom = 46;
  const px = (x) => left + (x / 3) * (W - left - right);
  const py = (y) => top + ((1 - y) / 0.95) * (H - top - bottom);
  const line = points.map(([x, y]) => `${px(x)},${py(y)}`).join(" ");
  const grid = [0, 0.2, 0.4, 0.6, 0.8, 1]
    .map(
      (y) =>
        `<g><line x1="${left}" y1="${py(y)}" x2="${W - right}" y2="${py(y)}"/><text x="${left - 9}" y="${py(y) + 4}" text-anchor="end">${y.toFixed(1)}</text></g>`,
    )
    .join("");
  return `<figure class="report-chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${escapeHtml(title)}"><text class="chart-title" x="${W / 2}" y="18" text-anchor="middle">${escapeHtml(title)}</text>${grid}<polyline points="${line}" style="stroke:${color}"/><circle cx="${px(lambda)}" cy="${py(chi)}" r="6" fill="#d9493f"><title>λ̄ = ${fmt(lambda, 3)}, χ = ${fmt(chi, 3)}</title></circle><text class="chart-point" x="${px(lambda) + 10}" y="${py(chi) - 9}">(${fmt(lambda, 2)}, ${fmt(chi, 2)})</text><text x="${W / 2}" y="${H - 8}" text-anchor="middle">Relative slenderness λ̄</text><text x="15" y="${H / 2}" transform="rotate(-90 15 ${H / 2})" text-anchor="middle">Reduction factor χ</text></svg><figcaption>${escapeHtml(title)} · curve α = ${fmt(alpha, 2)}</figcaption></figure>`;
}

function render(r) {
  const input = r.v;
  const section = r.s;
  const steelName = $("grade").value;
  const today = new Date().toLocaleDateString("en-GB").replaceAll("/", ".");
  const author = escapeHtml($("author").value.trim() || "Not specified");
  const status = r.pass ? "PASS" : "FAIL";
  const statusColor = r.pass ? "pass" : "fail";
  const ratioPercent = Math.min(100, Math.max(0, r.gov[1] * 100));
  const productStandard = db.series[+$("series").value].name.includes("IPE")
    ? "EN 10365:2017"
    : "DIN 1025-2";

  const inputSections = [
    reportSection("1.1 Cross-section", [
      ["Section profile", "—", section.name],
      ["Product standard", "—", productStandard],
      ["Section height", "h", `${fmt(section["h[mm]"], 1)} mm`],
      ["Flange width", "b", `${fmt(section["b[mm]"], 1)} mm`],
      ["Web thickness", "t<sub>w</sub>", `${fmt(section["tw[mm]"], 2)} mm`],
      ["Flange thickness", "t<sub>f</sub>", `${fmt(section["tf[mm]"], 2)} mm`],
      ["Root radius", "r<sub>1</sub>", `${fmt(section["r1[mm]"], 1)} mm`],
      [
        "Net area after holes",
        "A<sub>net</sub>",
        `${fmt(section["A[cm2]"] - input.hole, 2)} cm²`,
      ],
    ]),
    reportSection("1.2 Section properties", [
      ["Cross-sectional area", "A", `${fmt(section["A[cm2]"], 2)} cm²`],
      [
        "Elastic section modulus about y-axis",
        "W<sub>el,y</sub>",
        `${fmt(section["Wy[cm3]"], 2)} cm³`,
      ],
      [
        "Elastic section modulus about z-axis",
        "W<sub>el,z</sub>",
        `${fmt(section["Wz[cm3]"], 2)} cm³`,
      ],
      [
        "Plastic section modulus about y-axis",
        "W<sub>pl,y</sub>",
        `${fmt(section["Wpl,y[cm3]"], 2)} cm³`,
      ],
      [
        "Plastic section modulus about z-axis",
        "W<sub>pl,z</sub>",
        `${fmt(section["Wpl,z[cm3]"], 2)} cm³`,
      ],
      [
        "Second moment of area about y-axis",
        "I<sub>y</sub>",
        `${fmt(section["Iy[cm4]"], 2)} cm⁴`,
      ],
      [
        "Second moment of area about z-axis",
        "I<sub>z</sub>",
        `${fmt(section["Iz[cm4]"], 2)} cm⁴`,
      ],
      [
        "Torsion constant",
        "I<sub>t</sub>",
        `${fmt(section["It[cm4]"], 2)} cm⁴`,
      ],
      [
        "Warping constant",
        "I<sub>ω</sub>",
        `${fmt(section["Iω[cm6]"], 2)} cm⁶`,
      ],
      [
        "Radii of gyration",
        "i<sub>y</sub> / i<sub>z</sub> / i<sub>p</sub>",
        `${fmt(section["iy[mm]"], 1)} / ${fmt(section["iz[mm]"], 1)} / ${fmt(section["ip[mm]"], 1)} mm`,
      ],
    ]),
    reportSection("1.3 Material", [
      ["Steel grade", "—", steelName],
      [
        "Governing plate thickness",
        "t",
        `${fmt(Math.max(section["tw[mm]"], section["tf[mm]"]), 2)} mm`,
      ],
      ["Yield strength", "f<sub>y</sub>", `${r.mat.fy} N/mm²`],
      ["Ultimate tensile strength", "f<sub>u</sub>", `${r.mat.fu} N/mm²`],
      ["Modulus of elasticity", "E", "210000 N/mm²"],
      ["Shear modulus", "G", "81000 N/mm²"],
      ["Poisson ratio", "ν", "0.3"],
    ]),
    reportSection("1.4 Safety factors", [
      ["Cross-section resistance", "γ<sub>M0</sub>", fmt(input.gm0, 2)],
      ["Member stability resistance", "γ<sub>M1</sub>", fmt(input.gm1, 2)],
      ["Fracture resistance", "γ<sub>M2</sub>", fmt(input.gm2, 2)],
      ["Net-section factor", "k", fmt(input.kfactor, 2)],
    ]),
    reportSection("1.5 Internal forces", [
      ["Design axial force", "N<sub>Ed</sub>", `${fmt(input.N, 2)} kN`],
      [
        "Design bending moment about y-axis",
        "M<sub>Ed,y</sub>",
        `${fmt(input.My, 2)} kNm`,
      ],
      [
        "Design bending moment about z-axis",
        "M<sub>Ed,z</sub>",
        `${fmt(input.Mz, 2)} kNm`,
      ],
      [
        "Design shear force in z-direction",
        "V<sub>Ed,z</sub>",
        `${fmt(input.Vz, 2)} kN`,
      ],
      [
        "Design shear force in y-direction",
        "V<sub>Ed,y</sub>",
        `${fmt(input.Vy, 2)} kN`,
      ],
      ["Design torsional moment", "T<sub>Ed</sub>", `${fmt(input.T, 2)} kNm`],
      ["Design bimoment", "B<sub>Ed</sub>", `${fmt(input.B, 2)} kNm²`],
    ]),
    reportSection("1.6 Critical buckling lengths", [
      [
        "Flexural buckling about y-axis",
        "L<sub>cr,y</sub>",
        `${fmt(input.Lcry, 2)} m`,
      ],
      [
        "Flexural buckling about z-axis",
        "L<sub>cr,z</sub>",
        `${fmt(input.Lcrz, 2)} m`,
      ],
      ["Torsional buckling", "L<sub>cr,T</sub>", `${fmt(input.LcrT, 2)} m`],
      [
        "Lateral torsional buckling",
        "L<sub>cr,LT</sub>",
        `${fmt(input.LcrLT, 2)} m`,
      ],
      [
        "Lateral support offset from shear centre",
        "d<sub>z</sub>",
        `${fmt(input.dz, 2)} mm`,
      ],
    ]),
    reportSection("1.7 Lateral torsional buckling inputs", [
      ["LTB verification", "—", r.ltbRequired ? "Required" : "Neglected"],
      ["Elastic critical moment", "M<sub>cr</sub>", `${fmt(r.mcr, 2)} kNm`],
      [
        "LTB moment shape",
        "C<sub>m,LT</sub>",
        $("CmLT").selectedOptions[0].textContent,
      ],
    ]),
    reportSection("1.8 Combined bending and compression inputs", [
      [
        "Moment shape factors",
        "C<sub>my</sub> / C<sub>mz</sub> / C<sub>m,LT</sub>",
        `${$("Cmy").selectedOptions[0].textContent} / ${$("Cmz").selectedOptions[0].textContent} / ${$("CmLT").selectedOptions[0].textContent}`,
      ],
      ["Load type", "—", $("loadtype").value],
      [
        "ψ values",
        "ψ<sub>y</sub> / ψ<sub>z</sub> / ψ<sub>LT</sub>",
        `${fmt(input.psiY, 2)} / ${fmt(input.psiZ, 2)} / ${fmt(input.psiLT, 2)}`,
      ],
      [
        "α values",
        "α<sub>y</sub> / α<sub>z</sub> / α<sub>LT</sub>",
        `${fmt(input.alphaY, 2)} / ${fmt(input.alphaZ, 2)} / ${fmt(input.alphaLT, 2)}`,
      ],
    ]),
  ].join("");

  const checks = Object.entries(r.ratios).map(([name, value]) => [
    name,
    "—",
    `<span class="ratio-value ${value <= 1 ? "good" : "bad"}">${fmt(value, 3)} · ${value <= 1 ? "PASS" : "FAIL"}</span>`,
    "",
  ]);
  const verificationSummary = `<section class="report-subsection verification-summary"><h3>2.8 Verification summary</h3>${reportTable(checks)}${reportUtilizationChart(Object.entries(r.ratios))}</section>`;

  const resultSections = [
    reportSection("2.1 Cross-section resistance", [
      [
        "Design axial resistance",
        "N<sub>Rd</sub>",
        `${fmt(r.nRdUse, 2)} kN`,
        "Eq. (8.18)",
      ],
      [
        "Bending resistance reduced for axial force, shear and bimoment",
        "M<sub>y,BVN,Rd</sub>",
        `${fmt(r.myReduced, 2)} kNm`,
        "Eqs. (8.41), (8.48)",
      ],
      [
        "Plastic shear resistance with torsion",
        "V<sub>pl,T,Rd</sub>",
        `${fmt(r.vplT, 2)} kN`,
        "8.2.7 (9)",
      ],
      [
        "Bending resistance about z-axis reduced for axial force",
        "M<sub>N,z,Rd</sub>",
        `${fmt(r.mNzRd, 2)} kNm`,
        "8.2.9.1 (5)",
      ],
      [
        "Axial force utilization",
        "N<sub>Ed</sub> / N<sub>Rd</sub>",
        fmt(r.ratios["Axial cross-section"], 3),
        "",
      ],
      [
        "Bending utilization about y-axis",
        "M<sub>Ed,y</sub> / M<sub>y,BVN,Rd</sub>",
        fmt(r.ratios["Bending y-axis"], 3),
        "",
      ],
      [
        "Shear utilization",
        "V<sub>Ed,z</sub> / V<sub>pl,T,Rd</sub>",
        fmt(r.ratios["Shear z-direction"], 3),
        "",
      ],
      [
        "Bending utilization about z-axis",
        "M<sub>Ed,z</sub> / M<sub>N,z,Rd</sub>",
        fmt(r.ratios["Bending z-axis"], 3),
        "",
      ],
    ]),
    reportSection("2.2 Flexural buckling about the y-axis", [
      [
        "Relative slenderness",
        "λ̄<sub>y</sub>",
        fmt(r.FB_y.lambda, 3),
        "8.3.1.2 (2)",
      ],
      ["Reduction factor", "χ<sub>y</sub>", fmt(r.FB_y.chi, 3), "8.3.1.3 (1)"],
      [
        "Buckling resistance",
        "N<sub>b,y,Rd</sub>",
        `${fmt(r.FB_y.Nb, 2)} kN`,
        "Eq. (8.68)",
      ],
      [
        "Interaction factors",
        "k<sub>yy</sub> / k<sub>yz</sub>",
        `${fmt(r.kFlex.kyy, 3)} / ${fmt(r.kFlex.kyz, 3)}`,
        "Table 8.7",
      ],
      [
        "Utilization",
        "N<sub>Ed</sub> / N<sub>b,y,Rd</sub>",
        fmt(r.ratios["Flexural buckling y-axis"], 3),
        "",
      ],
    ]),
    reportSection("2.3 Flexural buckling about the z-axis", [
      [
        "Relative slenderness",
        "λ̄<sub>z</sub>",
        fmt(r.FB_z.lambda, 3),
        "8.3.1.2 (2)",
      ],
      ["Reduction factor", "χ<sub>z</sub>", fmt(r.FB_z.chi, 3), "8.3.1.3 (1)"],
      [
        "Buckling resistance",
        "N<sub>b,z,Rd</sub>",
        `${fmt(r.FB_z.Nb, 2)} kN`,
        "Eq. (8.68)",
      ],
      [
        "Interaction factors",
        "k<sub>zy</sub> / k<sub>zz</sub>",
        `${fmt(r.kFlex.kzy, 3)} / ${fmt(r.kFlex.kzz, 3)}`,
        "Table 8.8",
      ],
      [
        "Utilization",
        "N<sub>Ed</sub> / N<sub>b,z,Rd</sub>",
        fmt(r.ratios["Flexural buckling z-axis"], 3),
        "",
      ],
    ]),
    reportSection(
      "2.4 Torsional buckling",
      [
        [
          "Elastic critical torsional buckling force",
          "N<sub>cr,T</sub>",
          `${fmt(r.ncrT, 2)} kN`,
          "",
        ],
        [
          "Relative slenderness",
          "λ̄<sub>T</sub>",
          fmt(r.lambdaT, 3),
          "Eq. (8.69)",
        ],
        ["Reduction factor", "χ<sub>T</sub>", fmt(r.chiT, 3), "Eq. (8.75)"],
        [
          "Torsional buckling resistance",
          "N<sub>b,T,Rd</sub>",
          `${fmt(r.NbT, 2)} kN`,
          "8.3.1.4, Eq. (8.68)",
        ],
        [
          "Utilization",
          "N<sub>Ed</sub> / N<sub>b,T,Rd</sub>",
          fmt(r.ratios["Torsional buckling"], 3),
          "",
        ],
      ],
      {
        formula:
          "N<sub>cr,T</sub> = (1 / i<sub>p</sub>²) · (π² · E · I<sub>ω</sub> / L<sub>cr,T</sub>² + G · I<sub>t</sub>)",
      },
    ),
    reportSection(
      "2.5 Torsional-flexural buckling",
      [
        [
          "Elastic critical torsional-flexural buckling force",
          "N<sub>cr,TF</sub>",
          `${fmt(r.ncrTF, 2)} kN`,
          "Eq. (3.60)",
        ],
        [
          "Relative slenderness",
          "λ̄<sub>TF</sub>",
          fmt(r.lambdaTF, 3),
          "Eq. (8.69)",
        ],
        ["Reduction factor", "χ<sub>TF</sub>", fmt(r.chiTF, 3), "Eq. (8.75)"],
        [
          "Buckling resistance",
          "N<sub>b,TF,Rd</sub>",
          `${fmt(r.NbTF, 2)} kN`,
          "8.3.1.4, Eq. (8.68)",
        ],
        [
          "Interaction factors",
          "k<sub>yy</sub> / k<sub>yz</sub>",
          `${fmt(r.kTF.kyy, 3)} / ${fmt(r.kTF.kyz, 3)}`,
          "Table 8.7",
        ],
        [
          "Interaction factors",
          "k<sub>zy</sub> / k<sub>zz</sub>",
          `${fmt(r.kTF.kzy, 3)} / ${fmt(r.kTF.kzz, 3)}`,
          "Table 8.8",
        ],
        [
          "Utilization",
          "N<sub>Ed</sub> / N<sub>b,TF,Rd</sub>",
          fmt(r.ratios["Torsional-flexural buckling"], 3),
          "",
        ],
      ],
      {
        formula:
          "N<sub>cr,TF</sub> = [N<sub>cr,y</sub> + N<sub>cr,T</sub> - √((N<sub>cr,y</sub> + N<sub>cr,T</sub>)² - 4 · β · N<sub>cr,y</sub> · N<sub>cr,T</sub>)] / (2 · β)",
      },
    ),
    reportSection("2.6 Lateral torsional buckling", [
      [
        "Verification status",
        "—",
        r.ltbRequired ? "Required" : "Neglected",
        "",
      ],
      ["Elastic critical moment", "M<sub>cr</sub>", `${fmt(r.mcr, 2)} kNm`, ""],
      ["Relative slenderness", "λ̄<sub>LT</sub>", fmt(r.lambdaLT, 3), ""],
      ["Reduction factor", "χ<sub>LT</sub>", fmt(r.chiLT, 3), "8.3.2.3 (2)"],
      [
        "Lateral torsional buckling resistance",
        "M<sub>b,Rd</sub>",
        `${fmt(r.mbRd, 2)} kNm`,
        "Eq. (8.79)",
      ],
      [
        "Utilization",
        "M<sub>Ed,y</sub> / M<sub>b,Rd</sub>",
        fmt(r.ratios["Lateral torsional buckling"], 3),
        "",
      ],
    ]),
    reportSection("2.7 Combined bending and axial compression", [
      [
        "Eq. (8.88) using χ<sub>z</sub>",
        "—",
        fmt(r.ratios["Combined interaction · Eq. 8.88"], 3),
        "",
      ],
      [
        "Eq. (8.88) using χ<sub>TF</sub>",
        "—",
        fmt(r.ratios["Combined interaction · Eq. 8.88, TF"], 3),
        "",
      ],
      [
        "Eq. (8.89) using χ<sub>z</sub>",
        "—",
        fmt(r.ratios["Combined interaction · Eq. 8.89"], 3),
        "",
      ],
      [
        "Eq. (8.89) using χ<sub>TF</sub>",
        "—",
        fmt(r.ratios["Combined interaction · Eq. 8.89, TF"], 3),
        "",
      ],
    ]),
    verificationSummary,
  ].join("");

  const curves = [
    reportCurve(
      "Flexural buckling reduction curve · y-axis",
      r.FB_y.alpha,
      r.FB_y.lambda,
      r.FB_y.chi,
      "#175db1",
    ),
    reportCurve(
      "Flexural buckling reduction curve · z-axis",
      r.FB_z.alpha,
      r.FB_z.lambda,
      r.FB_z.chi,
      "#175db1",
    ),
    reportCurve(
      "Torsional buckling reduction curve",
      r.aTF,
      r.lambdaT,
      r.chiT,
      "#ed9a20",
      r.lambdaZ,
    ),
    reportCurve(
      "Torsional-flexural buckling reduction curve",
      r.aTF,
      r.lambdaTF,
      r.chiTF,
      "#8c2995",
      r.lambdaZ,
    ),
    reportCurve(
      "Lateral torsional buckling reduction curve",
      r.alphaLT,
      r.lambdaLT,
      r.chiLT,
      "#175db1",
    ),
  ].join("");

  $("results").innerHTML = `
    <article class="report-document">
      <header class="report-cover">
        <p class="eyebrow">STRUCTURAL STEEL · MEMBER VERIFICATION</p>
        <h1>Steel member design report</h1>
        <p class="report-subtitle">Resistance and buckling checks of I- and H-sections according to EN 1993-1-1:2022</p>
      </header>
      <div class="report-meta">
        <div><span>Author</span><strong>${author}</strong></div>
        <div><span>Date</span><strong>${today}</strong></div>
        <div><span>Design code</span><strong>EN 1993-1-1:2022</strong></div>
        <div><span>Section</span><strong>${escapeHtml(section.name)} · ${escapeHtml(productStandard)}</strong></div>
        <div><span>Steel grade</span><strong>${escapeHtml(steelName)}</strong></div>
        <div><span>Cross-section class</span><strong>${r.secClass}</strong></div>
      </div>
      <section class="governing-card ${statusColor}">
        <div class="governing-number"><span>Governing utilization ratio</span><strong>${fmt(r.gov[1], 2)}</strong></div>
        <div class="governing-detail"><strong>${status} · ${r.pass ? "all checks are satisfied" : "one or more checks exceed the limit"}</strong><p>Limit: ratio ≤ 1.00 · Governing check: ${escapeHtml(r.gov[0])}</p><div class="ratio-track"><span style="width:${ratioPercent}%"></span><i></i></div></div>
      </section>
      <section class="report-major"><h2><span>1</span> Inputs</h2>${inputSections}</section>
      <section class="report-major results-major"><h2><span>2</span> Calculation results</h2>${resultSections}</section>
      <section class="report-major curves-major"><h2><span>3</span> Buckling reduction curves</h2><div class="curve-grid">${curves}</div></section>
      <p class="report-disclaimer">This report was generated automatically. The results must be checked independently by a qualified structural engineer before they are used in design or construction. Class 4 sections and non-General LTB methods are not supported by the supplied procedure.</p>
      <div class="report-actions"><button class="secondary" id="print-report" type="button">Print / save report as PDF</button></div>
    </article>`;
  $("print-report").addEventListener("click", () => window.print());
}

function showError(msg) {
  $("error").textContent = msg;
  $("error").style.display = "block";
}
init();
