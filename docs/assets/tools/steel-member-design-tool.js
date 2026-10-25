"use strict";

const $ = (id) => document.getElementById(id);
const number = (id) => Number($(id).value);
const fmt = (value, digits = 2) => Number.isFinite(value) ? value.toFixed(digits) : "—";
let db;

async function init() {
  try {
    const response = await fetch("steel-section-database.json");
    if (!response.ok) throw Error("Could not load steel-section-database.json");
    db = await response.json();
    $("series").innerHTML = db.series
      .map((item, index) => `<option value="${index}">${item.name}</option>`)
      .join("");
    fillSections();
    $("series").addEventListener("change", fillSections);
    $("section").addEventListener("change", showSection);
    $("run").addEventListener("click", run);
    $("reset").addEventListener("click", () => location.reload());
    document.querySelectorAll(".tab").forEach((button) => {
      button.addEventListener("click", () => {
        document.querySelectorAll(".tab").forEach((tab) => tab.classList.remove("active"));
        document.querySelectorAll(".pane").forEach((pane) => pane.classList.remove("active"));
        button.classList.add("active");
        $(button.dataset.pane).classList.add("active");
      });
    });
    showSection();
  } catch (error) {
    showError(error.message);
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

function readInputs() {
  const values = {};
  ["N", "My", "Mz", "Vz", "Vy", "T", "B", "hole", "kfactor", "gm0", "gm1", "gm2", "Lcry", "Lcrz", "LcrT", "dz", "LcrLT", "Mcr", "mu", "psiY", "alphaY", "psiZ", "alphaZ", "psiLT", "alphaLT"].forEach((key) => {
    values[key] = number(key);
  });
  return values;
}

function apiBaseUrl() {
  const configured = String(window.STEEL_DESIGN_API_URL || "").trim().replace(/\/+$/, "");
  if (configured) return configured;
  if (["localhost", "127.0.0.1"].includes(location.hostname)) return "http://127.0.0.1:8001";
  throw Error("The Python calculation API is not configured. Deploy the backend and set STEEL_DESIGN_API_URL in steel-member-design-api-config.js.");
}

async function run() {
  $("error").style.display = "none";
  const button = $("run");
  button.disabled = true;
  const originalText = button.textContent;
  button.textContent = "Calculating…";
  try {
    const payload = {
      ...readInputs(),
      seriesIndex: Number($("series").value),
      sectionName: $("section").value,
      grade: $("grade").value,
      annex: $("annex").value,
      loadtype: $("loadtype").value,
      Cmy: Number($("Cmy").value),
      Cmz: Number($("Cmz").value),
      CmLT: Number($("CmLT").value),
      case: Number($("case").value),
      loadloc: $("loadloc").value,
    };
    const response = await fetch(`${apiBaseUrl()}/api/design-check`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.toLowerCase().includes("application/json")) {
      const bodyPreview = (await response.text()).trim().slice(0, 120);
      const target = `${apiBaseUrl()}/api/design-check`;
      throw Error(
        `The design API returned a non-JSON response (HTTP ${response.status}) from ${target}. ` +
          `Check that STEEL_DESIGN_API_URL points to the running Python API, not the website, ` +
          `and that the API is deployed with the /api/design-check route. ` +
          (bodyPreview.startsWith("<!") ? "The server returned an HTML page." : ""),
      );
    }
    const result = await response.json();
    if (!response.ok) throw Error(result.detail || "The design calculation could not be completed.");
    render(result);
  } catch (error) {
    showError(error.message);
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}
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

function reportCurve(curve, color) {
  const { title, alpha, lambda, chi, points } = curve;
  const W = 720;
  const H = 330;
  const left = 58;
  const right = 24;
  const top = 30;
  const bottom = 46;
  const px = (x) => left + (x / 3) * (W - left - right);
  const py = (y) => top + ((1 - y) / 0.95) * (H - top - bottom);
  const line = points.map(([x, y]) => `${px(x)},${py(y)}`).join(" ");
  const grid = [0, 0.2, 0.4, 0.6, 0.8, 1]
    .map((y) => `<g><line x1="${left}" y1="${py(y)}" x2="${W - right}" y2="${py(y)}"/><text x="${left - 9}" y="${py(y) + 4}" text-anchor="end">${y.toFixed(1)}</text></g>`)
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
        "i<sub>y</sub>, i<sub>z</sub>, i<sub>p</sub>",
        `${fmt(section["iy[mm]"], 1)}, ${fmt(section["iz[mm]"], 1)}, ${fmt(section["ip[mm]"], 1)} mm`,
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
        "C<sub>my</sub>, C<sub>mz</sub>, C<sub>m,LT</sub>",
        `${$("Cmy").selectedOptions[0].textContent}, ${$("Cmz").selectedOptions[0].textContent}, ${$("CmLT").selectedOptions[0].textContent}`,
      ],
      ["Load type", "—", $("loadtype").value],
      [
        "ψ values",
        "ψ<sub>y</sub>, ψ<sub>z</sub>, ψ<sub>LT</sub>",
        `${fmt(input.psiY, 2)}, ${fmt(input.psiZ, 2)}, ${fmt(input.psiLT, 2)}`,
      ],
      [
        "α values",
        "α<sub>y</sub>, α<sub>z</sub>, α<sub>LT</sub>",
        `${fmt(input.alphaY, 2)}, ${fmt(input.alphaZ, 2)}, ${fmt(input.alphaLT, 2)}`,
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
        "k<sub>yy</sub>, k<sub>yz</sub>",
        `${fmt(r.kFlex.kyy, 3)}, ${fmt(r.kFlex.kyz, 3)}`,
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
        "k<sub>zy</sub>, k<sub>zz</sub>",
        `${fmt(r.kFlex.kzy, 3)}, ${fmt(r.kFlex.kzz, 3)}`,
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
          "k<sub>yy</sub>, k<sub>yz</sub>",
          `${fmt(r.kTF.kyy, 3)}, ${fmt(r.kTF.kyz, 3)}`,
          "Table 8.7",
        ],
        [
          "Interaction factors",
          "k<sub>zy</sub>, k<sub>zz</sub>",
          `${fmt(r.kTF.kzy, 3)}, ${fmt(r.kTF.kzz, 3)}`,
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
    reportSection(
      "2.7 Combined bending and axial compression",
      [
        [
          "Eq. (8.88) using χ<sub>y</sub>",
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
      ],
      {
        formula: `
          <span class="report-equation-label">Eq. (8.88), buckling about the y-axis</span><br>
          N<sub>Ed</sub> / (χ<sub>y</sub> N<sub>Rk</sub> / γ<sub>M1</sub>) + k<sub>yy</sub> |M<sub>y,Ed</sub>| / (χ<sub>LT</sub> M<sub>y,Rk</sub> / γ<sub>M1</sub>) + k<sub>yz</sub> |M<sub>z,Ed</sub>| / (M<sub>z,Rk</sub> / γ<sub>M1</sub>) ≤ 1.0<br>
          <span class="report-equation-label">Eq. (8.88), torsional-flexural variant</span><br>
          N<sub>Ed</sub> / (χ<sub>TF</sub> N<sub>Rk</sub> / γ<sub>M1</sub>) + k<sub>yy,TF</sub> |M<sub>y,Ed</sub>| / (χ<sub>LT</sub> M<sub>y,Rk</sub> / γ<sub>M1</sub>) + k<sub>yz,TF</sub> |M<sub>z,Ed</sub>| / (M<sub>z,Rk</sub> / γ<sub>M1</sub>) ≤ 1.0<br>
          <span class="report-equation-label">Eq. (8.89), buckling about the z-axis</span><br>
          N<sub>Ed</sub> / (χ<sub>z</sub> N<sub>Rk</sub> / γ<sub>M1</sub>) + k<sub>zy</sub> |M<sub>y,Ed</sub>| / (χ<sub>LT</sub> M<sub>y,Rk</sub> / γ<sub>M1</sub>) + k<sub>zz</sub> |M<sub>z,Ed</sub>| / (M<sub>z,Rk</sub> / γ<sub>M1</sub>) ≤ 1.0<br>
          <span class="report-equation-label">Eq. (8.89), torsional-flexural variant</span><br>
          N<sub>Ed</sub> / (χ<sub>TF</sub> N<sub>Rk</sub> / γ<sub>M1</sub>) + k<sub>zy,TF</sub> |M<sub>y,Ed</sub>| / (χ<sub>LT</sub> M<sub>y,Rk</sub> / γ<sub>M1</sub>) + k<sub>zz,TF</sub> |M<sub>z,Ed</sub>| / (M<sub>z,Rk</sub> / γ<sub>M1</sub>) ≤ 1.0`,
      },
    ),
    verificationSummary,
  ].join("");

  const curveColors = ["#175db1", "#175db1", "#ed9a20", "#8c2995", "#175db1"];
  const curves = r.curves
    .map((curve, index) => reportCurve(curve, curveColors[index]))
    .join("");

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
