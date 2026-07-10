import { firebaseConfig } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore, collection, onSnapshot, doc, addDoc, updateDoc, deleteDoc, orderBy, query,
  setDoc, getDoc, arrayUnion, arrayRemove,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { Chart, registerables } from "https://cdn.jsdelivr.net/npm/chart.js@4.4.4/+esm";
Chart.register(...registerables);

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const mesesRef = collection(db, "meses");
const configRef = doc(db, "config", "general");
const beneficiariosRef = collection(db, "beneficiarios");

const DEFAULT_CATEGORIAS = ["Comisiones", "Tasaciones", "Software / Herramientas", "Marketing", "Otros"];
const DEFAULT_CONFIG = {
  categoriasGastos: DEFAULT_CATEGORIAS,
  margenObjetivo: 30,
  partidasFijasIngresos: [],
  partidasFijasGastos: [],
};

let months = [];
let beneficiarios = [];
let config = { ...DEFAULT_CONFIG };
let currentView = "dashboard";
let informesMonthId = null;
let ready = false;

const PIE_COLORS = ["#0f766e", "#be123c", "#d97706", "#7c3aed", "#2563eb", "#db2777", "#65a30d", "#0891b2", "#ea580c", "#4338ca"];

const eur = (n) =>
  (Number(n) || 0).toLocaleString("es-ES", { style: "currency", currency: "EUR" });

const estadoClass = (v) => "estado-" + (v || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

function seedMonth() {
  return {
    nombre: "Julio 2026",
    orden: Date.now(),
    saldoInicial: 2982,
    reserva: 950,
    ingresos: [
      { cliente: "Nelson", concepto: "", importe: 580, cobrado: "Sí" },
      { cliente: "Yofre", concepto: "", importe: 2500, cobrado: "Sí" },
    ],
    gastos: [
      { concepto: "Jaime", categoria: "", importe: 400, estado: "Pendiente" },
      { concepto: "Inmovilla", categoria: "", importe: 139, estado: "Pagado" },
      { concepto: "Tasaciones", categoria: "", importe: 720, estado: "Pendiente" },
      { concepto: "Tasacion Alejandro Jordanis", categoria: "", importe: 100, estado: "Pendiente" },
      { concepto: "Tasaciones Roger marcos y elena", categoria: "", importe: 200, estado: "Pagado" },
      { concepto: "Tasacion Jonathan Jaime", categoria: "", importe: 100, estado: "Pendiente" },
      { concepto: "Paula pendientes", categoria: "", importe: 161.1, estado: "Pendiente" },
      { concepto: "Olga", categoria: "", importe: 150, estado: "Pendiente" },
      { concepto: "Fresha", categoria: "", importe: 50, estado: "Pagado" },
      { concepto: "Junior", categoria: "", importe: 150, estado: "Pagado" },
      { concepto: "Bruno", categoria: "", importe: 330, estado: "Pagado" },
      { concepto: "Albert", categoria: "", importe: 700, estado: "Pagado" },
      { concepto: "Tasación Yofre (Marie)", categoria: "", importe: 100, estado: "Pendiente" },
      { concepto: "Tasación Nelson (Marie)", categoria: "", importe: 100, estado: "Pendiente" },
      { concepto: "Cuota Yofre (Marie)", categoria: "", importe: 750, estado: "Pendiente" },
      { concepto: "Lovable", categoria: "", importe: 25, estado: "Pendiente" },
      { concepto: "Esp y santiago", categoria: "", importe: 170, estado: "Pendiente" },
      { concepto: "Zeber", categoria: "", importe: 67, estado: "Pagado" },
      { concepto: "BItrix", categoria: "", importe: 175, estado: "Pagado" },
      { concepto: "Pago Jaime dos tasaciones yop", categoria: "", importe: 408, estado: "Pendiente" },
      { concepto: "workspace", categoria: "", importe: 32, estado: "Pagado" },
      { concepto: "Ads", categoria: "", importe: 153, estado: "Pagado" },
    ],
    facturas: [
      { factura: "Factura_008_THP_2026-06-05.pdf", emisor: "Paula Bodega", concepto: "Gestión puntual visitas", importe: 21.66, notas: "" },
      { factura: "a81c6f5d.pdf", emisor: "Olga Postigo", concepto: "consultas 12/6", importe: 79.5, notas: "" },
      { factura: "93aeb144.pdf", emisor: "Susana Rubio", concepto: "consultas 12/6", importe: 79.5, notas: "" },
      { factura: "b620637c.pdf", emisor: "Roger Oriola", concepto: "Servicios de intermediación comercial", importe: 99.99, notas: "" },
      { factura: "87bc23d8.pdf", emisor: "Roger Oriola", concepto: "Servicios de intermediación comercial", importe: 99.99, notas: "" },
      { factura: "9cef5b59.pdf", emisor: "Roger Oriola", concepto: "Yofre Daniel Galindo Rodríguez", importe: 100, notas: "" },
      { factura: "744b61eb.pdf", emisor: "Paula Bodega", concepto: "Asistencia Virtual - Coordinación visitas", importe: 39.44, notas: "" },
      { factura: "12a8891e.pdf", emisor: "Roger Oriola", concepto: "Marcos Atanasio", importe: 100, notas: "" },
      { factura: "4d27b433.pdf", emisor: "Roger Oriola", concepto: "Jordanis", importe: 100, notas: "" },
      { factura: "no he encontrado", emisor: "Jaime Fernández", concepto: "Comisión tasación Jonathan", importe: 100, notas: "?" },
      { factura: "Factura_011_THP_2026-06-29.pdf", emisor: "Paula Bodega", concepto: "Comisión tasación Marcos", importe: 100, notas: "" },
    ],
  };
}

function computeTotals(m) {
  const ingCobrados = (m.ingresos || []).filter((i) => i.cobrado === "Sí").reduce((s, i) => s + (Number(i.importe) || 0), 0);
  const ingPendientes = (m.ingresos || []).filter((i) => i.cobrado === "No").reduce((s, i) => s + (Number(i.importe) || 0), 0);
  const gasPagados = (m.gastos || []).filter((g) => g.estado === "Pagado").reduce((s, g) => s + (Number(g.importe) || 0), 0);
  const gasPendientes = (m.gastos || []).filter((g) => g.estado === "Pendiente").reduce((s, g) => s + (Number(g.importe) || 0), 0);
  const totalGastos = gasPagados + gasPendientes;
  const facturacionTotal = ingCobrados + ingPendientes;
  // Beneficio neto: real — solo lo que ya se ha cobrado menos lo que ya se ha pagado este periodo.
  const beneficioNeto = ingCobrados - gasPagados;
  // Flujo de caja: saldo acumulado — lo que traías de antes + el beneficio neto real de este mes.
  const flujoCaja = (Number(m.saldoInicial) || 0) + beneficioNeto;
  const cajaNoDisponible = Number(m.reserva) || 0;
  const totalFacturasRecibidas = (m.facturas || []).reduce((s, f) => s + (Number(f.importe) || 0), 0);
  const saldoRealCuenta = (m.saldoRealCuenta !== null && m.saldoRealCuenta !== undefined && m.saldoRealCuenta !== "") ? Number(m.saldoRealCuenta) : null;
  const diferenciaConciliacion = saldoRealCuenta !== null ? saldoRealCuenta - flujoCaja : null;
  return {
    ingCobrados, ingPendientes, gasPagados, gasPendientes, totalGastos,
    facturacionTotal, beneficioNeto, flujoCaja, cajaNoDisponible, totalFacturasRecibidas,
    saldoRealCuenta, diferenciaConciliacion,
  };
}

// ---------- Firestore ----------
async function addMonth(nombre, saldoInicial) {
  const ingresos = (config.partidasFijasIngresos || []).map((p) => ({ ...p, cobrado: "No" }));
  const gastos = (config.partidasFijasGastos || []).map((p) => ({ ...p, estado: "Pendiente" }));
  await addDoc(mesesRef, { nombre, orden: Date.now(), saldoInicial, reserva: 0, saldoRealCuenta: null, saldoRealFecha: "", ingresos, gastos, facturas: [] });
}
async function saveMonthField(id, field, value) {
  await updateDoc(doc(db, "meses", id), { [field]: value });
}
async function removeMonth(id) {
  await deleteDoc(doc(db, "meses", id));
}
async function addCategoria(nombre) {
  await updateDoc(configRef, { categoriasGastos: arrayUnion(nombre) });
}
async function removeCategoria(nombre) {
  await updateDoc(configRef, { categoriasGastos: arrayRemove(nombre) });
}
async function saveConfigField(field, value) {
  await updateDoc(configRef, { [field]: value });
}
async function addBeneficiario(data) {
  await addDoc(beneficiariosRef, { orden: Date.now(), nombre: "", iban: "", nif: "", email: "", telefono: "", notas: "", ...data });
}
async function updateBeneficiarioField(id, field, value) {
  await updateDoc(doc(db, "beneficiarios", id), { [field]: value });
}
async function removeBeneficiario(id) {
  await deleteDoc(doc(db, "beneficiarios", id));
}

// ---------- Render ----------
function renderSidebar() {
  const list = document.getElementById("month-list");
  list.innerHTML = "";
  months.forEach((m) => {
    const btn = document.createElement("button");
    btn.className = "month-item" + (currentView === m.id ? " active" : "");
    btn.innerHTML = `<span>📄 ${m.nombre}</span>`;
    btn.onclick = () => { currentView = m.id; render(); };
    list.appendChild(btn);
  });
  document.getElementById("nav-dashboard").classList.toggle("active", currentView === "dashboard");
  document.getElementById("nav-informes").classList.toggle("active", currentView === "informes");
  document.getElementById("nav-beneficiarios").classList.toggle("active", currentView === "beneficiarios");
  document.getElementById("nav-config").classList.toggle("active", currentView === "config");

  const targetMonth = months.find((x) => x.id === currentView) || months.find((x) => x.id === informesMonthId) || months[months.length - 1];
  document.getElementById("pdf-target-label").textContent = targetMonth ? `se exportará: ${targetMonth.nombre}` : "";
}

function statCard(label, value, tone) {
  return `<div class="stat-card">
    <div class="stat-label">${label}</div>
    <div class="stat-value tone-${tone}">${eur(value)}</div>
  </div>`;
}

function renderDashboard() {
  const main = document.getElementById("main-content");
  main.innerHTML = `
    <div class="card card-pad"><h3 class="section-title">Ingresos vs gastos por mes</h3>
      <canvas id="chartBar" height="90"></canvas></div>
    <div class="card card-pad"><h3 class="section-title">Evolución del beneficio neto</h3>
      <canvas id="chartLine" height="70"></canvas></div>
    <div class="card">
      <table class="dash-table">
        <thead><tr><th>Mes</th><th>Ingresos</th><th>Gastos pagados</th><th>Gastos pendientes</th><th>Beneficio neto</th></tr></thead>
        <tbody>${months.map((m) => {
          const t = computeTotals(m);
          return `<tr>
            <td><strong>${m.nombre}</strong></td>
            <td class="tone-good">${eur(t.ingCobrados)}</td>
            <td class="tone-bad">${eur(t.gasPagados)}</td>
            <td class="tone-warn">${eur(t.gasPendientes)}</td>
            <td class="${t.beneficioNeto >= 0 ? "tone-good" : "tone-bad"}"><strong>${eur(t.beneficioNeto)}</strong></td>
          </tr>`;
        }).join("")}</tbody>
      </table>
    </div>
  `;

  const labels = months.map((m) => m.nombre);
  const totals = months.map(computeTotals);

  new Chart(document.getElementById("chartBar"), {
    type: "bar",
    data: {
      labels,
      datasets: [
        { label: "Ingresos", data: totals.map((t) => t.ingCobrados), backgroundColor: "#0f766e" },
        { label: "Gastos pagados", data: totals.map((t) => t.gasPagados), backgroundColor: "#be123c" },
        { label: "Gastos pendientes", data: totals.map((t) => t.gasPendientes), backgroundColor: "#d97706" },
      ],
    },
    options: { responsive: true, plugins: { legend: { position: "bottom" } } },
  });

  new Chart(document.getElementById("chartLine"), {
    type: "line",
    data: {
      labels,
      datasets: [{ label: "Beneficio neto", data: totals.map((t) => t.beneficioNeto), borderColor: "#0f766e", backgroundColor: "#0f766e33", tension: 0.3, fill: true }],
    },
    options: { responsive: true, plugins: { legend: { display: false } } },
  });
}

function editableRow(cols) {
  return cols.map((c) => `<td>${c}</td>`).join("");
}

function renderInformes() {
  const main = document.getElementById("main-content");
  if (!months.length) {
    main.innerHTML = `<div class="card card-pad">Todavía no hay meses para generar un informe.</div>`;
    return;
  }
  if (!informesMonthId || !months.find((x) => x.id === informesMonthId)) {
    informesMonthId = months[months.length - 1].id;
  }
  const m = months.find((x) => x.id === informesMonthId);
  const t = computeTotals(m);
  const objetivo = Number(config.margenObjetivo ?? 30);
  const margenActual = t.ingCobrados > 0 ? (t.beneficioNeto / t.ingCobrados) * 100 : 0;
  const cumple = margenActual >= objetivo;

  const porCategoria = {};
  (m.gastos || []).forEach((g) => {
    const cat = g.categoria || "Sin categoría";
    porCategoria[cat] = (porCategoria[cat] || 0) + (Number(g.importe) || 0);
  });
  const catLabels = Object.keys(porCategoria);
  const catValues = Object.values(porCategoria);

  main.innerHTML = `
    <div class="card card-pad">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;flex-wrap:wrap;gap:8px;">
        <h3 class="section-title" style="margin:0;">Informe de rentabilidad</h3>
        <select id="informe-month-select">${months.map((mm) => `<option value="${mm.id}" ${mm.id === m.id ? "selected" : ""}>${mm.nombre}</option>`).join("")}</select>
      </div>
      <div class="margin-card">
        <div>
          <div class="margin-value ${cumple ? "tone-good" : "tone-bad"}">${margenActual.toFixed(1)}%</div>
          <div class="margin-sub">Margen de beneficio actual (objetivo: ${objetivo}%)</div>
        </div>
        <div class="margin-gauge">
          <div class="margin-bar-track"><div class="margin-bar-fill" style="width:${Math.max(0, Math.min(100, margenActual))}%;background:${cumple ? "#047857" : "#be123c"}"></div></div>
          <div class="margin-sub" style="margin-top:6px;">${cumple ? "✅ Por encima del objetivo — mes rentable" : "⚠️ Por debajo del objetivo"}</div>
        </div>
      </div>
    </div>
    <div class="card card-pad">
      <h3 class="section-title" style="margin-bottom:12px;">Gastos por categoría — ${m.nombre}</h3>
      ${catLabels.length ? `<div class="chart-wrap"><canvas id="chartPie"></canvas></div>` : `<div class="config-hint">Todavía no hay gastos con importe este mes.</div>`}
    </div>
  `;

  document.getElementById("informe-month-select").addEventListener("change", (e) => { informesMonthId = e.target.value; render(); });

  if (catLabels.length) {
    new Chart(document.getElementById("chartPie"), {
      type: "doughnut",
      data: { labels: catLabels, datasets: [{ data: catValues, backgroundColor: PIE_COLORS.slice(0, catLabels.length) }] },
      options: { responsive: true, plugins: { legend: { position: "bottom" } } },
    });
  }
}

function renderBeneficiarios() {
  const main = document.getElementById("main-content");
  const rows = beneficiarios.map((b) => `
    <tr>
      <td><input data-bf="nombre" data-id="${b.id}" value="${b.nombre || ""}"></td>
      <td><input data-bf="iban" data-id="${b.id}" value="${b.iban || ""}" style="font-family:var(--mono)"></td>
      <td><input data-bf="nif" data-id="${b.id}" value="${b.nif || ""}"></td>
      <td><input data-bf="email" data-id="${b.id}" value="${b.email || ""}"></td>
      <td><input data-bf="telefono" data-id="${b.id}" value="${b.telefono || ""}"></td>
      <td><input data-bf="notas" data-id="${b.id}" value="${b.notas || ""}"></td>
      <td><button class="btn-del" data-delbf="${b.id}">✕</button></td>
    </tr>`).join("");

  main.innerHTML = `
    <div class="card">
      <div class="section-header">
        <div><span class="section-title">Fichas de pago</span><span class="section-count">${beneficiarios.length}</span></div>
        <button class="btn-add" id="btn-add-beneficiario">+ Añadir</button>
      </div>
      <table><thead><tr><th>Nombre</th><th>IBAN</th><th>NIF/CIF</th><th>Email</th><th>Teléfono</th><th>Notas</th><th></th></tr></thead>
      <tbody>${rows}</tbody></table>
      ${!beneficiarios.length ? `<div class="config-hint" style="padding:12px 16px;">Todavía no hay fichas guardadas. Añade la primera con el botón de arriba.</div>` : ""}
    </div>
  `;

  document.getElementById("btn-add-beneficiario").addEventListener("click", () => addBeneficiario({}));
  main.querySelectorAll("[data-bf]").forEach((el) => {
    el.addEventListener("change", (e) => updateBeneficiarioField(e.target.dataset.id, e.target.dataset.bf, e.target.value));
  });
  main.querySelectorAll("[data-delbf]").forEach((el) => {
    el.addEventListener("click", () => { if (confirm("¿Eliminar esta ficha de pago?")) removeBeneficiario(el.dataset.delbf); });
  });
}

function renderConfig() {
  const main = document.getElementById("main-content");

  const catList = (config.categoriasGastos || []).map((c) => `
    <span class="tag">${c}<button data-cat="${c}" title="Eliminar categoría">✕</button></span>
  `).join("") || `<span class="config-hint">Todavía no hay categorías. Añade la primera abajo.</span>`;

  const pfIngresosRows = (config.partidasFijasIngresos || []).map((r, i) => `
    <tr>
      <td><input data-pf="ingresos" data-i="${i}" data-f="cliente" value="${r.cliente || ""}"></td>
      <td><input data-pf="ingresos" data-i="${i}" data-f="concepto" value="${r.concepto || ""}"></td>
      <td><input type="number" step="0.01" data-pf="ingresos" data-i="${i}" data-f="importe" value="${r.importe || 0}"></td>
      <td><button class="btn-del" data-delpf="ingresos" data-i="${i}">✕</button></td>
    </tr>`).join("");

  const pfGastosRows = (config.partidasFijasGastos || []).map((r, i) => {
    const opts = config.categoriasGastos || [];
    return `
    <tr>
      <td><input data-pf="gastos" data-i="${i}" data-f="concepto" value="${r.concepto || ""}"></td>
      <td><select data-pf="gastos" data-i="${i}" data-f="categoria">
        <option value="" ${!r.categoria ? "selected" : ""}>—</option>
        ${opts.map((c) => `<option value="${c}" ${r.categoria === c ? "selected" : ""}>${c}</option>`).join("")}
      </select></td>
      <td><input type="number" step="0.01" data-pf="gastos" data-i="${i}" data-f="importe" value="${r.importe || 0}"></td>
      <td><button class="btn-del" data-delpf="gastos" data-i="${i}">✕</button></td>
    </tr>`;
  }).join("");

  main.innerHTML = `
    <div class="card card-pad">
      <h3 class="section-title" style="margin-bottom:8px;">Margen objetivo</h3>
      <p class="config-hint" style="margin-top:0;margin-bottom:10px;">
        Porcentaje de los ingresos que quieres que quede como beneficio neto. Se usa en Informes para marcar si un mes es rentable.
      </p>
      <div class="target-input-row"><input type="number" id="f-margen" value="${config.margenObjetivo ?? 30}" min="0" max="100" step="1"><span>%</span></div>
    </div>

    <div class="card card-pad">
      <h3 class="section-title" style="margin-bottom:4px;">Categorías de gastos</h3>
      <p class="config-hint" style="margin-top:0;margin-bottom:14px;">
        Opciones del desplegable "Categoría" en la tabla de Gastos, en todos los meses.
      </p>
      <div class="tag-list" id="tag-list">${catList}</div>
      <form id="add-tag-form" class="add-tag-form">
        <input id="new-tag-input" type="text" placeholder="Nueva categoría…" />
        <button type="submit" class="btn-add">+ Añadir</button>
      </form>
      <div class="config-hint">Borrar una categoría no afecta a los gastos ya guardados con ella.</div>
    </div>

    <div class="card">
      <div class="section-header">
        <div><span class="section-title">Partidas fijas de ingresos</span><span class="section-count">${(config.partidasFijasIngresos || []).length}</span></div>
        <button class="btn-add" data-addpf="ingresos">+ Añadir</button>
      </div>
      <p class="config-hint" style="padding:8px 16px 0;">Se precargan automáticamente (como "No cobrado") cada vez que creas un mes nuevo.</p>
      <table><thead><tr><th>Cliente</th><th>Concepto</th><th>Importe</th><th></th></tr></thead>
      <tbody>${pfIngresosRows}</tbody></table>
    </div>

    <div class="card">
      <div class="section-header">
        <div><span class="section-title">Partidas fijas de gastos</span><span class="section-count">${(config.partidasFijasGastos || []).length}</span></div>
        <button class="btn-add" data-addpf="gastos">+ Añadir</button>
      </div>
      <p class="config-hint" style="padding:8px 16px 0;">Se precargan automáticamente (como "Pendiente") cada vez que creas un mes nuevo.</p>
      <table><thead><tr><th>Concepto</th><th>Categoría</th><th>Importe</th><th></th></tr></thead>
      <tbody>${pfGastosRows}</tbody></table>
    </div>
  `;

  document.getElementById("f-margen").addEventListener("change", (e) => saveConfigField("margenObjetivo", Number(e.target.value) || 0));

  document.getElementById("tag-list").querySelectorAll("[data-cat]").forEach((btn) => {
    btn.addEventListener("click", () => removeCategoria(btn.dataset.cat));
  });

  document.getElementById("add-tag-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const input = document.getElementById("new-tag-input");
    const val = input.value.trim();
    if (!val) return;
    if ((config.categoriasGastos || []).includes(val)) { input.value = ""; return; }
    addCategoria(val);
    input.value = "";
  });

  main.querySelectorAll("[data-pf]").forEach((el) => {
    el.addEventListener("change", (e) => {
      const arr = e.target.dataset.pf;
      const i = Number(e.target.dataset.i);
      const f = e.target.dataset.f;
      const field = arr === "ingresos" ? "partidasFijasIngresos" : "partidasFijasGastos";
      const list = [...(config[field] || [])];
      list[i] = { ...list[i], [f]: e.target.type === "number" ? Number(e.target.value) || 0 : e.target.value };
      saveConfigField(field, list);
    });
  });
  main.querySelectorAll("[data-addpf]").forEach((el) => {
    el.addEventListener("click", () => {
      const arr = el.dataset.addpf;
      const field = arr === "ingresos" ? "partidasFijasIngresos" : "partidasFijasGastos";
      const blank = arr === "ingresos" ? { cliente: "", concepto: "", importe: 0 } : { concepto: "", categoria: "", importe: 0 };
      saveConfigField(field, [...(config[field] || []), blank]);
    });
  });
  main.querySelectorAll("[data-delpf]").forEach((el) => {
    el.addEventListener("click", () => {
      const arr = el.dataset.delpf;
      const i = Number(el.dataset.i);
      const field = arr === "ingresos" ? "partidasFijasIngresos" : "partidasFijasGastos";
      const list = (config[field] || []).filter((_, idx) => idx !== i);
      saveConfigField(field, list);
    });
  });
}

function printMonth(m, t) {
  const fecha = new Date().toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });

  const resumenRows = [
    ["Saldo inicial", eur(m.saldoInicial || 0)],
    ["Caja no disponible (reserva)", eur(m.reserva || 0)],
    ["Ingresos efectuados", eur(t.ingCobrados)],
    ["Ingresos pendientes", eur(t.ingPendientes)],
    ["Facturación total", eur(t.facturacionTotal)],
    ["Gastos realizados", eur(t.gasPagados)],
    ["Gastos pendientes", eur(t.gasPendientes)],
    ["Total gastos", eur(t.totalGastos)],
    ["Beneficio neto", eur(t.beneficioNeto), true],
    ["Flujo de caja", eur(t.flujoCaja), true],
    ...(t.saldoRealCuenta !== null ? [
      [`Saldo real en cuenta${m.saldoRealFecha ? ` (${m.saldoRealFecha})` : ""}`, eur(t.saldoRealCuenta)],
      ["Diferencia con lo calculado", eur(t.diferenciaConciliacion), true],
    ] : []),
  ];

  const ingresosBody = (m.ingresos || []).map((r) =>
    `<tr><td>${r.cliente || ""}</td><td>${r.concepto || ""}</td><td>${eur(r.importe)}</td><td>${r.cobrado || ""}</td></tr>`
  ).join("") || `<tr><td colspan="4">Sin datos</td></tr>`;

  const gastosBody = (m.gastos || []).map((r) =>
    `<tr><td>${r.concepto || ""}</td><td>${r.categoria || ""}</td><td>${eur(r.importe)}</td><td>${r.estado || ""}</td></tr>`
  ).join("") || `<tr><td colspan="4">Sin datos</td></tr>`;

  const facturasBody = (m.facturas || []).map((r) =>
    `<tr><td>${r.factura || ""}</td><td>${r.emisor || ""}</td><td>${r.concepto || ""}</td><td>${eur(r.importe)}</td></tr>`
  ).join("") || `<tr><td colspan="4">Sin datos</td></tr>`;

  document.getElementById("print-area").innerHTML = `
    <div class="print-title">Finanzas — ${m.nombre}</div>
    <div class="print-sub">Informe generado el ${fecha}</div>

    <div class="print-section-title">Resumen del mes</div>
    <div class="print-resumen">
      ${resumenRows.map(([lbl, val, hl]) => `<div class="${hl ? "hl" : ""}"><span>${lbl}</span><span>${val}</span></div>`).join("")}
    </div>

    <div class="print-section-title">Ingresos (${(m.ingresos || []).length})</div>
    <table class="print-table"><thead><tr><th>Cliente</th><th>Concepto</th><th>Importe</th><th>Cobrado</th></tr></thead><tbody>${ingresosBody}</tbody></table>

    <div class="print-section-title">Gastos (${(m.gastos || []).length})</div>
    <table class="print-table"><thead><tr><th>Concepto</th><th>Categoría</th><th>Importe</th><th>Estado</th></tr></thead><tbody>${gastosBody}</tbody></table>

    <div class="print-section-title">Facturas recibidas (${(m.facturas || []).length}) — total: ${eur(t.totalFacturasRecibidas)}</div>
    <table class="print-table"><thead><tr><th>Factura</th><th>Emisor</th><th>Concepto</th><th>Importe</th></tr></thead><tbody>${facturasBody}</tbody></table>
  `;

  window.print();
}

function renderMonth(m) {

  const t = computeTotals(m);
  const main = document.getElementById("main-content");

  const ingresosRows = (m.ingresos || []).map((r, i) => `
    <tr>
      <td><input data-arr="ingresos" data-i="${i}" data-f="cliente" value="${r.cliente || ""}"></td>
      <td><input data-arr="ingresos" data-i="${i}" data-f="concepto" value="${r.concepto || ""}"></td>
      <td><input type="number" step="0.01" data-arr="ingresos" data-i="${i}" data-f="importe" value="${r.importe || 0}"></td>
      <td><select class="${estadoClass(r.cobrado)}" data-arr="ingresos" data-i="${i}" data-f="cobrado">
        <option value="Sí" ${r.cobrado === "Sí" ? "selected" : ""}>Sí</option>
        <option value="No" ${r.cobrado === "No" ? "selected" : ""}>No</option>
      </select></td>
      <td><button class="btn-del" data-del="ingresos" data-i="${i}">✕</button></td>
    </tr>`).join("");

  const gastosRows = (m.gastos || []).map((r, i) => {
    const catOptions = [...new Set([...(config.categoriasGastos || []), ...(r.categoria ? [r.categoria] : [])])];
    return `
    <tr>
      <td><input data-arr="gastos" data-i="${i}" data-f="concepto" value="${r.concepto || ""}"></td>
      <td><select data-arr="gastos" data-i="${i}" data-f="categoria">
        <option value="" ${!r.categoria ? "selected" : ""}>—</option>
        ${catOptions.map((c) => `<option value="${c}" ${r.categoria === c ? "selected" : ""}>${c}</option>`).join("")}
      </select></td>
      <td><input type="number" step="0.01" data-arr="gastos" data-i="${i}" data-f="importe" value="${r.importe || 0}"></td>
      <td><select class="${estadoClass(r.estado)}" data-arr="gastos" data-i="${i}" data-f="estado">
        <option value="Pagado" ${r.estado === "Pagado" ? "selected" : ""}>Pagado</option>
        <option value="Pendiente" ${r.estado === "Pendiente" ? "selected" : ""}>Pendiente</option>
      </select></td>
      <td><button class="btn-del" data-del="gastos" data-i="${i}">✕</button></td>
    </tr>`;
  }).join("");

  const facturasRows = (m.facturas || []).map((r, i) => `
    <tr>
      <td><input data-arr="facturas" data-i="${i}" data-f="factura" value="${r.factura || ""}"></td>
      <td><input data-arr="facturas" data-i="${i}" data-f="emisor" value="${r.emisor || ""}"></td>
      <td><input data-arr="facturas" data-i="${i}" data-f="concepto" value="${r.concepto || ""}"></td>
      <td><input type="number" step="0.01" data-arr="facturas" data-i="${i}" data-f="importe" value="${r.importe || 0}"></td>
      <td><input data-arr="facturas" data-i="${i}" data-f="notas" value="${r.notas || ""}"></td>
      <td><button class="btn-del" data-del="facturas" data-i="${i}">✕</button></td>
    </tr>`).join("");

  main.innerHTML = `
    <div class="month-header">
      <h2>${m.nombre}</h2>
      ${months.length > 1 ? `<button class="btn-link-danger" id="btn-del-month">✕ Eliminar mes</button>` : ""}
    </div>

    <div class="stat-grid">
      ${statCard("Ingresos cobrados", t.ingCobrados, "good")}
      ${statCard("Gastos pagados", t.gasPagados, "bad")}
      ${statCard("Gastos pendientes", t.gasPendientes, "warn")}
      ${statCard("Beneficio neto", t.beneficioNeto, t.beneficioNeto >= 0 ? "good" : "bad")}
    </div>

    <div class="card card-pad">
      <h3 class="section-title" style="margin-bottom:12px;">Resumen del mes</h3>
      <div class="resumen-grid">
        <div class="resumen-item"><div class="lbl">Saldo inicial</div><input type="number" step="0.01" id="f-saldoInicial" value="${m.saldoInicial || 0}"></div>
        <div class="resumen-item"><div class="lbl">Caja no disponible (reserva)</div><input type="number" step="0.01" id="f-reserva" value="${m.reserva || 0}"></div>
        <div class="resumen-item"><div class="lbl">Ingresos efectuados</div><div class="val tone-good">${eur(t.ingCobrados)}</div></div>
        <div class="resumen-item"><div class="lbl">Ingresos pendientes</div><div class="val tone-warn">${eur(t.ingPendientes)}</div></div>
        <div class="resumen-item"><div class="lbl">Facturación total</div><div class="val">${eur(t.facturacionTotal)}</div></div>
        <div class="resumen-item"><div class="lbl">Gastos realizados</div><div class="val tone-bad">${eur(t.gasPagados)}</div></div>
        <div class="resumen-item"><div class="lbl">Gastos pendientes</div><div class="val tone-warn">${eur(t.gasPendientes)}</div></div>
        <div class="resumen-item"><div class="lbl">Total gastos</div><div class="val">${eur(t.totalGastos)}</div></div>
        <div class="resumen-item"><div class="lbl">Beneficio neto</div><div class="val ${t.beneficioNeto >= 0 ? "tone-good" : "tone-bad"}"><strong>${eur(t.beneficioNeto)}</strong></div></div>
        <div class="resumen-item"><div class="lbl">Flujo de caja (disponible ahora)</div><div class="val"><strong>${eur(t.flujoCaja)}</strong></div></div>
      </div>
      <p class="config-hint" style="margin-top:12px;">
        <strong>Beneficio neto</strong> = Ingresos efectuados − Gastos realizados (solo lo que ya ha entrado y salido de verdad este mes; no cuenta lo pendiente).
        <strong>Flujo de caja</strong> = Saldo inicial + Beneficio neto (el saldo acumulado que traías, más lo que este mes ha generado de verdad).
      </p>
    </div>

    <div class="card card-pad">
      <h3 class="section-title" style="margin-bottom:4px;">Conciliación bancaria</h3>
      <p class="config-hint" style="margin-top:0;margin-bottom:12px;">
        Cuando quieras comprobar la cuenta real, pon aquí el saldo que ves en el banco. No sustituye al Flujo de caja calculado — solo lo compara, para detectar diferencias (dinero retenido, movimientos aún no reflejados, etc.) sin descuadrar las fórmulas.
      </p>
      <div class="resumen-grid">
        <div class="resumen-item"><div class="lbl">Saldo real en cuenta</div><input type="number" step="0.01" id="f-saldoReal" value="${m.saldoRealCuenta ?? ""}" placeholder="Sin comprobar"></div>
        <div class="resumen-item"><div class="lbl">Fecha de comprobación</div><input type="date" id="f-saldoRealFecha" value="${m.saldoRealFecha || ""}"></div>
        <div class="resumen-item"><div class="lbl">Flujo de caja calculado</div><div class="val">${eur(t.flujoCaja)}</div></div>
        <div class="resumen-item"><div class="lbl">Diferencia</div><div class="val ${t.diferenciaConciliacion === null ? "" : Math.abs(t.diferenciaConciliacion) < 1 ? "tone-good" : "tone-bad"}"><strong>${t.diferenciaConciliacion === null ? "—" : eur(t.diferenciaConciliacion)}</strong></div></div>
      </div>
      ${t.diferenciaConciliacion !== null && Math.abs(t.diferenciaConciliacion) >= 1 ? `<p class="config-hint" style="margin-top:10px;">${t.diferenciaConciliacion > 0 ? "Hay más dinero en el banco del que el cálculo espera — revisa si falta marcar algún ingreso como cobrado, o si el banco ya liberó algo que aquí sigue como pendiente." : "Hay menos dinero en el banco del que el cálculo espera — revisa si hay algo retenido (como Hotmart), un gasto pagado que falte marcar, o un ingreso que diste por cobrado y aún no ha llegado."}</p>` : ""}
    </div>

    <div class="card">
      <div class="section-header">
        <div><span class="section-title">Ingresos</span><span class="section-count">${(m.ingresos || []).length}</span></div>
        <button class="btn-add" data-add="ingresos">+ Añadir</button>
      </div>
      <table><thead><tr><th>Cliente</th><th>Concepto</th><th>Importe</th><th>Cobrado</th><th></th></tr></thead>
      <tbody>${ingresosRows}</tbody></table>
    </div>

    <div class="card">
      <div class="section-header">
        <div><span class="section-title">Gastos</span><span class="section-count">${(m.gastos || []).length}</span></div>
        <button class="btn-add" data-add="gastos">+ Añadir</button>
      </div>
      <table><thead><tr><th>Concepto</th><th>Categoría</th><th>Importe</th><th>Estado</th><th></th></tr></thead>
      <tbody>${gastosRows}</tbody></table>
    </div>

    <div class="card">
      <div class="section-header">
        <div><span class="section-title">Facturas recibidas</span><span class="section-count">${(m.facturas || []).length}</span></div>
        <button class="btn-add" data-add="facturas">+ Añadir</button>
      </div>
      <p class="config-hint" style="padding:8px 16px 0;">Registro de facturas que recibes, para cruzarlas manualmente con la tabla de Gastos. No entra en el Resumen del mes.</p>
      <table><thead><tr><th>Factura</th><th>Emisor</th><th>Concepto</th><th>Importe</th><th>Notas</th><th></th></tr></thead>
      <tbody>${facturasRows}</tbody></table>
      <div class="config-hint" style="padding:10px 16px;border-top:1px solid var(--stone-200);">Total facturas recibidas: <strong>${eur(t.totalFacturasRecibidas)}</strong></div>
    </div>
  `;

  document.getElementById("f-saldoInicial").addEventListener("change", (e) => saveMonthField(m.id, "saldoInicial", Number(e.target.value) || 0));
  document.getElementById("f-reserva").addEventListener("change", (e) => saveMonthField(m.id, "reserva", Number(e.target.value) || 0));
  document.getElementById("f-saldoReal").addEventListener("change", (e) => saveMonthField(m.id, "saldoRealCuenta", e.target.value === "" ? null : Number(e.target.value)));
  document.getElementById("f-saldoRealFecha").addEventListener("change", (e) => saveMonthField(m.id, "saldoRealFecha", e.target.value));

  const delMonthBtn = document.getElementById("btn-del-month");
  if (delMonthBtn) delMonthBtn.addEventListener("click", async () => {
    if (confirm(`¿Eliminar "${m.nombre}"? Esta acción no se puede deshacer.`)) {
      await removeMonth(m.id);
      currentView = "dashboard";
    }
  });

  main.querySelectorAll("[data-arr]").forEach((el) => {
    el.addEventListener("change", async (e) => {
      const arr = e.target.dataset.arr;
      const i = Number(e.target.dataset.i);
      const f = e.target.dataset.f;
      const newArr = [...(m[arr] || [])];
      newArr[i] = { ...newArr[i], [f]: e.target.type === "number" ? Number(e.target.value) || 0 : e.target.value };
      await saveMonthField(m.id, arr, newArr);
    });
  });

  main.querySelectorAll("[data-add]").forEach((el) => {
    el.addEventListener("click", async () => {
      const arr = el.dataset.add;
      const blank = arr === "ingresos" ? { cliente: "", concepto: "", importe: 0, cobrado: "No" }
        : arr === "gastos" ? { concepto: "", categoria: "", importe: 0, estado: "Pendiente" }
        : { factura: "", emisor: "", concepto: "", importe: 0, notas: "" };
      await saveMonthField(m.id, arr, [...(m[arr] || []), blank]);
    });
  });

  main.querySelectorAll("[data-del]").forEach((el) => {
    el.addEventListener("click", async () => {
      const arr = el.dataset.del;
      const i = Number(el.dataset.i);
      const newArr = (m[arr] || []).filter((_, idx) => idx !== i);
      await saveMonthField(m.id, arr, newArr);
    });
  });
}

function render() {
  if (!ready) return;
  renderSidebar();
  if (currentView === "dashboard") {
    renderDashboard();
  } else if (currentView === "informes") {
    renderInformes();
  } else if (currentView === "beneficiarios") {
    renderBeneficiarios();
  } else if (currentView === "config") {
    renderConfig();
  } else if (months.find((m) => m.id === currentView)) {
    renderMonth(months.find((m) => m.id === currentView));
  } else {
    currentView = "dashboard";
    renderDashboard();
  }
}

// ---------- Bootstrap ----------
document.getElementById("nav-dashboard").addEventListener("click", () => { currentView = "dashboard"; render(); });
document.getElementById("nav-informes").addEventListener("click", () => { currentView = "informes"; render(); });
document.getElementById("nav-beneficiarios").addEventListener("click", () => { currentView = "beneficiarios"; render(); });
document.getElementById("nav-config").addEventListener("click", () => { currentView = "config"; render(); });

document.getElementById("btn-pdf").addEventListener("click", () => {
  if (!months.length) { alert("Todavía no hay ningún mes con datos."); return; }
  const m = months.find((x) => x.id === currentView) || months.find((x) => x.id === informesMonthId) || months[months.length - 1];
  printMonth(m, computeTotals(m));
});

document.getElementById("btn-add-month").addEventListener("click", async () => {
  const nombre = prompt("Nombre del nuevo mes (ej. Agosto 2026):");
  if (!nombre) return;
  const last = months[months.length - 1];
  const saldoInicial = last ? (computeTotals(last).flujoCaja + computeTotals(last).cajaNoDisponible) : 0;
  await addMonth(nombre, saldoInicial);
});

let monthsReady = false;
let configReady = false;
let beneficiariosReady = false;
function maybeReady() {
  if (monthsReady && configReady && beneficiariosReady) { ready = true; render(); }
}

onAuthStateChanged(auth, async (user) => {
  if (!user) return;

  const configSnap = await getDoc(configRef);
  if (!configSnap.exists()) {
    await setDoc(configRef, DEFAULT_CONFIG);
  }
  onSnapshot(configRef, (snap) => {
    config = snap.exists() ? { ...DEFAULT_CONFIG, ...snap.data() } : { ...DEFAULT_CONFIG };
    configReady = true;
    if (ready) render(); else maybeReady();
  });

  const q = query(mesesRef, orderBy("orden", "asc"));
  onSnapshot(q, async (snap) => {
    if (snap.empty && !ready) {
      await addDoc(mesesRef, seedMonth());
      return;
    }
    months = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    monthsReady = true;
    if (ready) render(); else maybeReady();
  });

  const qb = query(beneficiariosRef, orderBy("orden", "asc"));
  onSnapshot(qb, (snap) => {
    beneficiarios = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    beneficiariosReady = true;
    if (ready) render(); else maybeReady();
  });
});

signInAnonymously(auth).catch((err) => {
  document.getElementById("main-content").innerHTML =
    `<div class="card card-pad">Error al conectar con Firebase: ${err.message}. Revisa <code>firebase-config.js</code> y que la autenticación anónima esté activada.</div>`;
});
