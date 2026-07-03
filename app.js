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

const DEFAULT_CATEGORIAS = ["Comisiones", "Tasaciones", "Software / Herramientas", "Marketing", "Otros"];

let months = [];
let config = { categoriasGastos: DEFAULT_CATEGORIAS };
let currentView = "dashboard";
let ready = false;

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
  const saldoDisponible = (Number(m.saldoInicial) || 0) + ingCobrados - gasPagados;
  const saldoTotal = saldoDisponible + (Number(m.reserva) || 0);
  const totalRecursos = (Number(m.saldoInicial) || 0) + ingCobrados + (Number(m.reserva) || 0);
  const totalGastos = gasPagados + gasPendientes;
  const beneficioNeto = totalRecursos - totalGastos;
  const totalFacturado = (m.facturas || []).reduce((s, f) => s + (Number(f.importe) || 0), 0);
  return { ingCobrados, ingPendientes, gasPagados, gasPendientes, saldoDisponible, saldoTotal, totalRecursos, totalGastos, beneficioNeto, totalFacturado };
}

// ---------- Firestore ----------
async function addMonth(nombre, saldoInicial) {
  await addDoc(mesesRef, { nombre, orden: Date.now(), saldoInicial, reserva: 0, ingresos: [], gastos: [], facturas: [] });
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
  document.getElementById("nav-config").classList.toggle("active", currentView === "config");
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

function renderConfig() {
  const main = document.getElementById("main-content");
  main.innerHTML = `
    <div class="card card-pad">
      <h3 class="section-title" style="margin-bottom:4px;">Categorías de gastos</h3>
      <p class="config-hint" style="margin-top:0;margin-bottom:14px;">
        Estas son las opciones que aparecen en el desplegable "Categoría" de la tabla de Gastos, en todos los meses.
      </p>
      <div class="tag-list" id="tag-list"></div>
      <form id="add-tag-form" class="add-tag-form">
        <input id="new-tag-input" type="text" placeholder="Nueva categoría…" />
        <button type="submit" class="btn-add">+ Añadir</button>
      </form>
      <div class="config-hint">Borrar una categoría no afecta a los gastos ya guardados con ella, solo deja de aparecer como opción para gastos nuevos.</div>
    </div>
  `;

  const tagList = document.getElementById("tag-list");
  tagList.innerHTML = (config.categoriasGastos || []).map((c) => `
    <span class="tag">${c}<button data-cat="${c}" title="Eliminar categoría">✕</button></span>
  `).join("") || `<span class="config-hint">Todavía no hay categorías. Añade la primera abajo.</span>`;

  tagList.querySelectorAll("[data-cat]").forEach((btn) => {
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
        <div class="resumen-item"><div class="lbl">Reserva / no disponible</div><input type="number" step="0.01" id="f-reserva" value="${m.reserva || 0}"></div>
        <div class="resumen-item"><div class="lbl">Saldo disponible</div><div class="val">${eur(t.saldoDisponible)}</div></div>
        <div class="resumen-item"><div class="lbl">Saldo total (con reserva)</div><div class="val">${eur(t.saldoTotal)}</div></div>
        <div class="resumen-item"><div class="lbl">Total recursos del periodo</div><div class="val">${eur(t.totalRecursos)}</div></div>
        <div class="resumen-item"><div class="lbl">Total gastos</div><div class="val">${eur(t.totalGastos)}</div></div>
        <div class="resumen-item"><div class="lbl">Total facturado</div><div class="val">${eur(t.totalFacturado)}</div></div>
      </div>
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
        <div><span class="section-title">Facturas emitidas</span><span class="section-count">${(m.facturas || []).length}</span></div>
        <button class="btn-add" data-add="facturas">+ Añadir</button>
      </div>
      <table><thead><tr><th>Factura</th><th>Emisor</th><th>Concepto</th><th>Importe</th><th>Notas</th><th></th></tr></thead>
      <tbody>${facturasRows}</tbody></table>
    </div>
  `;

  document.getElementById("f-saldoInicial").addEventListener("change", (e) => saveMonthField(m.id, "saldoInicial", Number(e.target.value) || 0));
  document.getElementById("f-reserva").addEventListener("change", (e) => saveMonthField(m.id, "reserva", Number(e.target.value) || 0));

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
document.getElementById("nav-config").addEventListener("click", () => { currentView = "config"; render(); });

document.getElementById("btn-add-month").addEventListener("click", async () => {
  const nombre = prompt("Nombre del nuevo mes (ej. Agosto 2026):");
  if (!nombre) return;
  const last = months[months.length - 1];
  const saldoInicial = last ? computeTotals(last).saldoTotal : 0;
  await addMonth(nombre, saldoInicial);
});

let monthsReady = false;
let configReady = false;
function maybeReady() {
  if (monthsReady && configReady) { ready = true; render(); }
}

onAuthStateChanged(auth, async (user) => {
  if (!user) return;

  const configSnap = await getDoc(configRef);
  if (!configSnap.exists()) {
    await setDoc(configRef, { categoriasGastos: DEFAULT_CATEGORIAS });
  }
  onSnapshot(configRef, (snap) => {
    config = snap.exists() ? snap.data() : { categoriasGastos: DEFAULT_CATEGORIAS };
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
});

signInAnonymously(auth).catch((err) => {
  document.getElementById("main-content").innerHTML =
    `<div class="card card-pad">Error al conectar con Firebase: ${err.message}. Revisa <code>firebase-config.js</code> y que la autenticación anónima esté activada.</div>`;
});
