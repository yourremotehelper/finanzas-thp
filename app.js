import { firebaseConfig } from "./firebase-config.js";
import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";

import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

import {
  getFirestore,
  collection,
  onSnapshot,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  orderBy,
  query,
  setDoc,
  getDoc,
  arrayUnion,
  arrayRemove,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

import {
  Chart,
  registerables
} from "https://cdn.jsdelivr.net/npm/chart.js@4.4.4/+esm";

Chart.register(...registerables);

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const mesesRef = collection(db, "meses");
const configRef = doc(db, "config", "general");
const beneficiariosRef = collection(db, "beneficiarios");

const DEFAULT_CATEGORIAS = [
  "Comisiones",
  "Tasaciones",
  "Software / Herramientas",
  "Marketing",
  "Otros"
];

const DEFAULT_CONFIG = {
  categoriasGastos: DEFAULT_CATEGORIAS,
  margenObjetivo: 30,
  partidasFijasIngresos: [],
  partidasFijasGastos: [],
  cuentas: {
    empresa1: "Cuenta Empresa 1",
    empresa2: "Cuenta Empresa 2"
  }
};

const ACCOUNT_IDS = ["empresa1", "empresa2"];

const ACCOUNT_NAMES = {
  empresa1: "Cuenta Empresa 1",
  empresa2: "Cuenta Empresa 2"
};

let months = [];
let beneficiarios = [];
let config = { ...DEFAULT_CONFIG };

let currentView = "dashboard";
let informesMonthId = null;
let cuentasMonthId = null;
let ready = false;

const PIE_COLORS = [
  "#0f766e",
  "#be123c",
  "#d97706",
  "#7c3aed",
  "#2563eb",
  "#db2777",
  "#65a30d",
  "#0891b2",
  "#ea580c",
  "#4338ca"
];

const eur = (n) =>
  (Number(n) || 0).toLocaleString("es-ES", {
    style: "currency",
    currency: "EUR"
  });

const estadoClass = (v) =>
  "estado-" +
  (v || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* =========================================================
   ESTRUCTURA DE CUENTAS
   ========================================================= */

function defaultAccounts() {
  return {
    empresa1: {
      saldoInicial: 0,
      saldoReal: null,
      saldoRealFecha: ""
    },
    empresa2: {
      saldoInicial: 0,
      saldoReal: null,
      saldoRealFecha: ""
    }
  };
}

function normalizeMonth(m) {
  const accounts = {
    ...defaultAccounts(),
    ...(m.accounts || {})
  };

  for (const id of ACCOUNT_IDS) {
    accounts[id] = {
      saldoInicial: Number(accounts[id]?.saldoInicial) || 0,
      saldoReal:
        accounts[id]?.saldoReal === null ||
        accounts[id]?.saldoReal === undefined ||
        accounts[id]?.saldoReal === ""
          ? null
          : Number(accounts[id].saldoReal),
      saldoRealFecha: accounts[id]?.saldoRealFecha || ""
    };
  }

  const ingresos = (m.ingresos || []).map((i) => ({
    ...i,
    cuenta: i.cuenta || "empresa1"
  }));

  const gastos = (m.gastos || []).map((g) => ({
    ...g,
    cuenta: g.cuenta || "empresa1"
  }));

  const movimientosCuenta = (m.movimientosCuenta || []).map((x) => ({
    fecha: x.fecha || "",
    cuenta: x.cuenta || "empresa1",
    tipo: x.tipo || "Otro movimiento",
    concepto: x.concepto || "",
    importe: Number(x.importe) || 0
  }));

  return {
    ...m,
    accounts,
    ingresos,
    gastos,
    movimientosCuenta
  };
}

/* =========================================================
   MES SEMILLA
   ========================================================= */

function seedMonth() {
  return {
    nombre: "Julio 2026",
    orden: Date.now(),

    accounts: {
      empresa1: {
        saldoInicial: 2982,
        saldoReal: null,
        saldoRealFecha: ""
      },
      empresa2: {
        saldoInicial: 0,
        saldoReal: null,
        saldoRealFecha: ""
      }
    },

    reserva: 950,

    ingresos: [
      {
        cliente: "Nelson",
        concepto: "",
        importe: 580,
        cobrado: "Sí",
        cuenta: "empresa1"
      },
      {
        cliente: "Yofre",
        concepto: "",
        importe: 2500,
        cobrado: "Sí",
        cuenta: "empresa1"
      }
    ],

    gastos: [
      { concepto: "Jaime", categoria: "", importe: 400, estado: "Pendiente", cuenta: "empresa1" },
      { concepto: "Inmovilla", categoria: "", importe: 139, estado: "Pagado", cuenta: "empresa1" },
      { concepto: "Tasaciones", categoria: "", importe: 720, estado: "Pendiente", cuenta: "empresa1" },
      { concepto: "Tasacion Alejandro Jordanis", categoria: "", importe: 100, estado: "Pendiente", cuenta: "empresa1" },
      { concepto: "Tasaciones Roger marcos y elena", categoria: "", importe: 200, estado: "Pagado", cuenta: "empresa1" },
      { concepto: "Tasacion Jonathan Jaime", categoria: "", importe: 100, estado: "Pendiente", cuenta: "empresa1" },
      { concepto: "Paula pendientes", categoria: "", importe: 161.1, estado: "Pendiente", cuenta: "empresa1" },
      { concepto: "Olga", categoria: "", importe: 150, estado: "Pendiente", cuenta: "empresa1" },
      { concepto: "Fresha", categoria: "", importe: 50, estado: "Pagado", cuenta: "empresa1" },
      { concepto: "Junior", categoria: "", importe: 150, estado: "Pagado", cuenta: "empresa1" },
      { concepto: "Bruno", categoria: "", importe: 330, estado: "Pagado", cuenta: "empresa1" },
      { concepto: "Albert", categoria: "", importe: 700, estado: "Pagado", cuenta: "empresa1" },
      { concepto: "Tasación Yofre (Marie)", categoria: "", importe: 100, estado: "Pendiente", cuenta: "empresa1" },
      { concepto: "Tasación Nelson (Marie)", categoria: "", importe: 100, estado: "Pendiente", cuenta: "empresa1" },
      { concepto: "Cuota Yofre (Marie)", categoria: "", importe: 750, estado: "Pendiente", cuenta: "empresa1" },
      { concepto: "Lovable", categoria: "", importe: 25, estado: "Pendiente", cuenta: "empresa1" },
      { concepto: "Esp y santiago", categoria: "", importe: 170, estado: "Pendiente", cuenta: "empresa1" },
      { concepto: "Zeber", categoria: "", importe: 67, estado: "Pagado", cuenta: "empresa1" },
      { concepto: "BItrix", categoria: "", importe: 175, estado: "Pagado", cuenta: "empresa1" },
      { concepto: "Pago Jaime dos tasaciones yop", categoria: "", importe: 408, estado: "Pendiente", cuenta: "empresa1" },
      { concepto: "workspace", categoria: "", importe: 32, estado: "Pagado", cuenta: "empresa1" },
      { concepto: "Ads", categoria: "", importe: 153, estado: "Pagado", cuenta: "empresa1" }
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
      { factura: "Factura_011_THP_2026-06-29.pdf", emisor: "Paula Bodega", concepto: "Comisión tasación Marcos", importe: 100, notas: "" }
    ],

    movimientosCuenta: []
  };
}

/* =========================================================
   CÁLCULOS
   ========================================================= */

function computeTotals(rawMonth) {
  const m = normalizeMonth(rawMonth);

  const ingCobrados = (m.ingresos || [])
    .filter((i) => i.cobrado === "Sí")
    .reduce((s, i) => s + (Number(i.importe) || 0), 0);

  const ingPendientes = (m.ingresos || [])
    .filter((i) => i.cobrado === "No")
    .reduce((s, i) => s + (Number(i.importe) || 0), 0);

  const gasPagados = (m.gastos || [])
    .filter((g) => g.estado === "Pagado")
    .reduce((s, g) => s + (Number(g.importe) || 0), 0);

  const gasPendientes = (m.gastos || [])
    .filter((g) => g.estado === "Pendiente")
    .reduce((s, g) => s + (Number(g.importe) || 0), 0);

  const totalGastos = gasPagados + gasPendientes;
  const facturacionTotal = ingCobrados + ingPendientes;

  /*
   * IMPORTANTE:
   *
   * El beneficio NO incluye movimientos del CEO.
   * Tampoco incluye transferencias entre cuentas.
   */
  const beneficioNeto = ingCobrados - gasPagados;

  const totalFacturasRecibidas = (m.facturas || [])
    .reduce((s, f) => s + (Number(f.importe) || 0), 0);

  const accounts = {};

  for (const accountId of ACCOUNT_IDS) {
    const account = m.accounts[accountId] || {};

    const ingresosCuenta = (m.ingresos || [])
      .filter((i) => i.cobrado === "Sí" && i.cuenta === accountId)
      .reduce((s, i) => s + (Number(i.importe) || 0), 0);

    const gastosCuenta = (m.gastos || [])
      .filter((g) => g.estado === "Pagado" && g.cuenta === accountId)
      .reduce((s, g) => s + (Number(g.importe) || 0), 0);

    /*
     * Los movimientos de cuenta ya vienen con signo:
     *
     * Retirada CEO = negativo
     * Aportación CEO = positivo
     * Otro movimiento = según corresponda
     */
    const movimientosCuenta = (m.movimientosCuenta || [])
      .filter((x) => x.cuenta === accountId)
      .reduce((s, x) => s + (Number(x.importe) || 0), 0);

    const saldoInicial = Number(account.saldoInicial) || 0;

    const saldoCalculado =
      saldoInicial +
      ingresosCuenta -
      gastosCuenta +
      movimientosCuenta;

    const saldoReal =
      account.saldoReal === null ||
      account.saldoReal === undefined ||
      account.saldoReal === ""
        ? null
        : Number(account.saldoReal);

    const diferencia =
      saldoReal === null
        ? null
        : saldoReal - saldoCalculado;

    accounts[accountId] = {
      ingresosCuenta,
      gastosCuenta,
      movimientosCuenta,
      saldoInicial,
      saldoCalculado,
      saldoReal,
      diferencia
    };
  }

  const cajaTotalCalculada =
    accounts.empresa1.saldoCalculado +
    accounts.empresa2.saldoCalculado;

  const cajaTotalReal =
    accounts.empresa1.saldoReal !== null &&
    accounts.empresa2.saldoReal !== null
      ? accounts.empresa1.saldoReal + accounts.empresa2.saldoReal
      : null;

  const diferenciaCajaTotal =
    cajaTotalReal === null
      ? null
      : cajaTotalReal - cajaTotalCalculada;

  return {
    ingCobrados,
    ingPendientes,
    gasPagados,
    gasPendientes,
    totalGastos,
    facturacionTotal,
    beneficioNeto,
    totalFacturasRecibidas,
    accounts,
    cajaTotalCalculada,
    cajaTotalReal,
    diferenciaCajaTotal
  };
}

/* =========================================================
   FIRESTORE
   ========================================================= */

async function addMonth(nombre, accountsIniciales) {
  const ingresos =
    (config.partidasFijasIngresos || []).map((p) => ({
      ...p,
      cobrado: "No",
      cuenta: "empresa1"
    }));

  const gastos =
    (config.partidasFijasGastos || []).map((p) => ({
      ...p,
      estado: "Pendiente",
      cuenta: "empresa1"
    }));

  await addDoc(mesesRef, {
    nombre,
    orden: Date.now(),

    accounts: {
      empresa1: {
        saldoInicial: Number(accountsIniciales?.empresa1) || 0,
        saldoReal: null,
        saldoRealFecha: ""
      },
      empresa2: {
        saldoInicial: Number(accountsIniciales?.empresa2) || 0,
        saldoReal: null,
        saldoRealFecha: ""
      }
    },

    reserva: 0,
    ingresos,
    gastos,
    facturas: [],
    movimientosCuenta: []
  });
}

async function saveMonthField(id, field, value) {
  await updateDoc(doc(db, "meses", id), {
    [field]: value
  });
}

async function saveAccountField(id, accountId, field, value) {
  const month = months.find((m) => m.id === id);
  if (!month) return;

  const normalized = normalizeMonth(month);

  const accounts = {
    ...normalized.accounts,
    [accountId]: {
      ...normalized.accounts[accountId],
      [field]: value
    }
  };

  await updateDoc(doc(db, "meses", id), {
    accounts
  });
}

async function removeMonth(id) {
  await deleteDoc(doc(db, "meses", id));
}

async function addCategoria(nombre) {
  await updateDoc(configRef, {
    categoriasGastos: arrayUnion(nombre)
  });
}

async function removeCategoria(nombre) {
  await updateDoc(configRef, {
    categoriasGastos: arrayRemove(nombre)
  });
}

async function saveConfigField(field, value) {
  await updateDoc(configRef, {
    [field]: value
  });
}

async function addBeneficiario(data) {
  await addDoc(beneficiariosRef, {
    orden: Date.now(),
    nombre: "",
    iban: "",
    nif: "",
    email: "",
    telefono: "",
    notas: "",
    ...data
  });
}

async function updateBeneficiarioField(id, field, value) {
  await updateDoc(doc(db, "beneficiarios", id), {
    [field]: value
  });
}

async function removeBeneficiario(id) {
  await deleteDoc(doc(db, "beneficiarios", id));
}

/* =========================================================
   SIDEBAR
   ========================================================= */

function renderSidebar() {
  const list = document.getElementById("month-list");

  list.innerHTML = "";

  months.forEach((m) => {
    const btn = document.createElement("button");

    btn.className =
      "month-item" +
      (currentView === m.id ? " active" : "");

    btn.innerHTML = `<span>📄 ${escapeHtml(m.nombre)}</span>`;

    btn.onclick = () => {
      currentView = m.id;
      render();
    };

    list.appendChild(btn);
  });

  document
    .getElementById("nav-dashboard")
    .classList.toggle("active", currentView === "dashboard");

  document
    .getElementById("nav-informes")
    .classList.toggle("active", currentView === "informes");

  document
    .getElementById("nav-cuentas")
    .classList.toggle("active", currentView === "cuentas");

  document
    .getElementById("nav-beneficiarios")
    .classList.toggle("active", currentView === "beneficiarios");

  document
    .getElementById("nav-config")
    .classList.toggle("active", currentView === "config");

  const targetMonth =
    months.find((x) => x.id === currentView) ||
    months.find((x) => x.id === informesMonthId) ||
    months.find((x) => x.id === cuentasMonthId) ||
    months[months.length - 1];

  document.getElementById("pdf-target-label").textContent =
    targetMonth
      ? `se exportará: ${targetMonth.nombre}`
      : "";
}

/* =========================================================
   DASHBOARD
   ========================================================= */

function statCard(label, value, tone) {
  return `
    <div class="stat-card">
      <div class="stat-label">${label}</div>
      <div class="stat-value tone-${tone}">
        ${eur(value)}
      </div>
    </div>
  `;
}

function renderDashboard() {
  const main = document.getElementById("main-content");

  main.innerHTML = `
    <div class="card card-pad">
      <h3 class="section-title">
        Ingresos vs gastos por mes
      </h3>
      <canvas id="chartBar" height="90"></canvas>
    </div>

    <div class="card card-pad">
      <h3 class="section-title">
        Evolución del beneficio neto
      </h3>
      <canvas id="chartLine" height="70"></canvas>
    </div>

    <div class="card">
      <table class="dash-table">
        <thead>
          <tr>
            <th>Mes</th>
            <th>Ingresos</th>
            <th>Gastos pagados</th>
            <th>Gastos pendientes</th>
            <th>Beneficio neto</th>
            <th>Caja empresa</th>
          </tr>
        </thead>

        <tbody>
          ${months.map((m) => {
            const t = computeTotals(m);

            return `
              <tr>
                <td><strong>${escapeHtml(m.nombre)}</strong></td>

                <td class="tone-good">
                  ${eur(t.ingCobrados)}
                </td>

                <td class="tone-bad">
                  ${eur(t.gasPagados)}
                </td>

                <td class="tone-warn">
                  ${eur(t.gasPendientes)}
                </td>

                <td class="${t.beneficioNeto >= 0 ? "tone-good" : "tone-bad"}">
                  <strong>${eur(t.beneficioNeto)}</strong>
                </td>

                <td>
                  <strong>${eur(t.cajaTotalCalculada)}</strong>
                </td>
              </tr>
            `;
          }).join("")}
        </tbody>
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
        {
          label: "Ingresos",
          data: totals.map((t) => t.ingCobrados),
          backgroundColor: "#0f766e"
        },

        {
          label: "Gastos pagados",
          data: totals.map((t) => t.gasPagados),
          backgroundColor: "#be123c"
        },

        {
          label: "Gastos pendientes",
          data: totals.map((t) => t.gasPendientes),
          backgroundColor: "#d97706"
        }
      ]
    },

    options: {
      responsive: true,
      plugins: {
        legend: {
          position: "bottom"
        }
      }
    }
  });

  new Chart(document.getElementById("chartLine"), {
    type: "line",

    data: {
      labels,

      datasets: [
        {
          label: "Beneficio neto",
          data: totals.map((t) => t.beneficioNeto),
          borderColor: "#0f766e",
          backgroundColor: "#0f766e33",
          tension: 0.3,
          fill: true
        }
      ]
    },

    options: {
      responsive: true,
      plugins: {
        legend: {
          display: false
        }
      }
    }
  });
}

/* =========================================================
   CUENTAS
   ========================================================= */

function renderAccountCard(m, t, accountId) {
  const a = t.accounts[accountId];
  const name =
    config.cuentas?.[accountId] ||
    ACCOUNT_NAMES[accountId];

  const diffTone =
    a.diferencia === null
      ? ""
      : Math.abs(a.diferencia) < 0.01
        ? "tone-good"
        : "tone-bad";

  return `
    <div class="account-card">

      <div class="account-card-header">
        <h3>🏦 ${escapeHtml(name)}</h3>
        <p>
          Saldo calculado a partir de los movimientos registrados
        </p>
      </div>

      <div class="account-body">

        <div class="account-mini-grid">

          <div class="account-mini-item">
            <div class="lbl">Saldo inicial</div>
            <input
              class="account-real-input"
              type="number"
              step="0.01"
              data-account-field="saldoInicial"
              data-account-id="${accountId}"
              value="${a.saldoInicial}"
            />
          </div>

          <div class="account-mini-item">
            <div class="lbl">Saldo calculado</div>
            <div class="account-balance ${a.saldoCalculado >= 0 ? "tone-good" : "tone-bad"}">
              ${eur(a.saldoCalculado)}
            </div>
          </div>

        </div>

        <div class="account-mini-grid">

          <div class="account-mini-item">
            <div class="lbl">Ingresos cobrados</div>
            <div class="val tone-good">
              ${eur(a.ingresosCuenta)}
            </div>
          </div>

          <div class="account-mini-item">
            <div class="lbl">Gastos pagados</div>
            <div class="val tone-bad">
              ${eur(a.gastosCuenta)}
            </div>
          </div>

          <div class="account-mini-item">
            <div class="lbl">Movimientos CEO / caja</div>
            <div class="val ${a.movimientosCuenta >= 0 ? "tone-good" : "tone-bad"}">
              ${eur(a.movimientosCuenta)}
            </div>
          </div>

          <div class="account-mini-item">
            <div class="lbl">Saldo real banco</div>
            <input
              class="account-real-input"
              type="number"
              step="0.01"
              data-account-field="saldoReal"
              data-account-id="${accountId}"
              value="${a.saldoReal ?? ""}"
              placeholder="Sin comprobar"
            />
          </div>

        </div>

        <div style="margin-top:14px;">
          <div class="account-mini-item">
            <div class="lbl">Fecha de comprobación</div>

            <input
              class="account-date-input"
              type="date"
              data-account-field="saldoRealFecha"
              data-account-id="${accountId}"
              value="${a.saldoRealFecha || ""}"
            />
          </div>
        </div>

        <div style="margin-top:14px;">
          <div class="lbl" style="font-size:10px;color:var(--stone-400);">
            Diferencia banco vs cálculo
          </div>

          <div class="val ${diffTone}" style="font-family:var(--mono);font-size:15px;">
            ${
              a.diferencia === null
                ? "—"
                : `<strong>${eur(a.diferencia)}</strong>`
            }
          </div>
        </div>

      </div>
    </div>
  `;
}

function renderCuentas() {
  if (!months.length) {
    document.getElementById("main-content").innerHTML =
      `<div class="card card-pad">Todavía no hay meses.</div>`;

    return;
  }

  if (
    !cuentasMonthId ||
    !months.find((m) => m.id === cuentasMonthId)
  ) {
    cuentasMonthId = months[months.length - 1].id;
  }

  const m = normalizeMonth(
    months.find((x) => x.id === cuentasMonthId)
  );

  const t = computeTotals(m);

  const diferenciaTotal =
    t.diferenciaCajaTotal;

  const movimientos = m.movimientosCuenta || [];

  const movementRows = movimientos.map((r, i) => `
    <tr>

      <td>
        <input
          type="date"
          data-mov-field="fecha"
          data-i="${i}"
          value="${r.fecha || ""}"
        >
      </td>

      <td>
        <select
          data-mov-field="tipo"
          data-i="${i}"
          class="movement-type-${r.importe < 0 ? "ceo-out" : "ceo-in"}"
        >
          <option value="Retirada CEO"
            ${r.tipo === "Retirada CEO" ? "selected" : ""}>
            Retirada CEO
          </option>

          <option value="Aportación CEO"
            ${r.tipo === "Aportación CEO" ? "selected" : ""}>
            Aportación CEO
          </option>

          <option value="Otro movimiento"
            ${r.tipo === "Otro movimiento" ? "selected" : ""}>
            Otro movimiento
          </option>
        </select>
      </td>

      <td>
        <select
          data-mov-field="cuenta"
          data-i="${i}"
          class="account-select"
        >
          ${ACCOUNT_IDS.map((id) => `
            <option value="${id}"
              ${r.cuenta === id ? "selected" : ""}>
              ${escapeHtml(config.cuentas?.[id] || ACCOUNT_NAMES[id])}
            </option>
          `).join("")}
        </select>
      </td>

      <td>
        <input
          data-mov-field="concepto"
          data-i="${i}"
          value="${escapeHtml(r.concepto)}"
          placeholder="Ej. Retirada para gastos personales"
        >
      </td>

      <td>
        <input
          type="number"
          step="0.01"
          data-mov-field="importe"
          data-i="${i}"
          value="${r.importe}"
          title="Negativo = salida / positivo = entrada"
        >
      </td>

      <td>
        <button
          class="btn-del"
          data-del-mov="${i}"
        >
          ✕
        </button>
      </td>

    </tr>
  `).join("");

  const main = document.getElementById("main-content");

  main.innerHTML = `

    <div class="month-header">
      <div>
        <h2>🏦 Cuentas de empresa</h2>

        <div class="config-hint">
          Control independiente de las dos cuentas bancarias.
        </div>
      </div>

      <select id="cuentas-month-select">
        ${months.map((mm) => `
          <option value="${mm.id}"
            ${mm.id === m.id ? "selected" : ""}>
            ${escapeHtml(mm.nombre)}
          </option>
        `).join("")}
      </select>
    </div>

    <div class="good-box">
      <strong>Importante:</strong>
      las retiradas y aportaciones del CEO afectan al saldo bancario,
      pero <strong>no afectan al beneficio de la empresa</strong>.
      El beneficio solo utiliza ingresos cobrados y gastos pagados.
    </div>

    <div class="account-grid">
      ${renderAccountCard(m, t, "empresa1")}
      ${renderAccountCard(m, t, "empresa2")}
    </div>

    <div class="card">
      <div class="account-summary-total">
        <span>Saldo calculado total de las dos cuentas</span>
        <strong>${eur(t.cajaTotalCalculada)}</strong>
      </div>

      <div class="account-summary-total">
        <span>Saldo real total de las dos cuentas</span>
        <strong>
          ${
            t.cajaTotalReal === null
              ? "—"
              : eur(t.cajaTotalReal)
          }
        </strong>
      </div>

      <div class="account-summary-total">
        <span>Diferencia total</span>
        <strong class="${
          diferenciaTotal === null
            ? ""
            : Math.abs(diferenciaTotal) < 0.01
              ? "tone-good"
              : "tone-bad"
        }">
          ${
            diferenciaTotal === null
              ? "—"
              : eur(diferenciaTotal)
          }
        </strong>
      </div>
    </div>

    <div class="card">
      <div class="section-header">
        <div>
          <span class="section-title">
            Movimientos de caja / CEO
          </span>

          <span class="section-count">
            ${movimientos.length}
          </span>
        </div>

        <button class="btn-add" id="btn-add-movement">
          + Añadir movimiento
        </button>
      </div>

      <div class="config-hint" style="padding:10px 16px 4px;">
        Aquí se registran movimientos que afectan al banco pero que
        <strong>no son ingresos ni gastos de la actividad</strong>.
        Usa importes negativos para salidas y positivos para entradas.
      </div>

      <div class="table-scroll">

        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Tipo</th>
              <th>Cuenta</th>
              <th>Concepto</th>
              <th>Importe</th>
              <th></th>
            </tr>
          </thead>

          <tbody>
            ${
              movementRows ||
              `
                <tr>
                  <td colspan="6"
                      style="padding:16px;color:var(--stone-400);">
                    No hay movimientos de este tipo registrados.
                  </td>
                </tr>
              `
            }
          </tbody>
        </table>

      </div>
    </div>
  `;

  document
    .getElementById("cuentas-month-select")
    .addEventListener("change", (e) => {
      cuentasMonthId = e.target.value;
      render();
    });

  main
    .querySelectorAll("[data-account-field]")
    .forEach((el) => {

      el.addEventListener("change", async (e) => {

        const accountId =
          e.target.dataset.accountId;

        const field =
          e.target.dataset.accountField;

        let value;

        if (field === "saldoReal") {
          value =
            e.target.value === ""
              ? null
              : Number(e.target.value);
        } else if (field === "saldoInicial") {
          value =
            Number(e.target.value) || 0;
        } else {
          value = e.target.value;
        }

        await saveAccountField(
          m.id,
          accountId,
          field,
          value
        );
      });
    });

  main
    .querySelectorAll("[data-mov-field]")
    .forEach((el) => {

      el.addEventListener("change", async (e) => {

        const i =
          Number(e.target.dataset.i);

        const field =
          e.target.dataset.movField;

        const newArr = [
          ...(m.movimientosCuenta || [])
        ];

        let value = e.target.value;

        if (field === "importe") {
          value =
            Number(e.target.value) || 0;
        }

        newArr[i] = {
          ...newArr[i],
          [field]: value
        };

        /*
         * Si el usuario selecciona Retirada CEO
         * y el importe es positivo, lo convertimos
         * automáticamente en negativo.
         *
         * Si selecciona Aportación CEO y el importe
         * es negativo, lo convertimos en positivo.
         */
        if (field === "tipo") {
          if (
            value === "Retirada CEO" &&
            Number(newArr[i].importe) > 0
          ) {
            newArr[i].importe =
              -Math.abs(Number(newArr[i].importe));
          }

          if (
            value === "Aportación CEO" &&
            Number(newArr[i].importe) < 0
          ) {
            newArr[i].importe =
              Math.abs(Number(newArr[i].importe));
          }
        }

        await saveMonthField(
          m.id,
          "movimientosCuenta",
          newArr
        );
      });
    });

  document
    .getElementById("btn-add-movement")
    .addEventListener("click", async () => {

      const newMovement = {
        fecha: "",
        tipo: "Retirada CEO",
        cuenta: "empresa1",
        concepto: "",
        importe: 0
      };

      await saveMonthField(
        m.id,
        "movimientosCuenta",
        [
          ...(m.movimientosCuenta || []),
          newMovement
        ]
      );
    });

  main
    .querySelectorAll("[data-del-mov]")
    .forEach((el) => {

      el.addEventListener("click", async () => {

        const i =
          Number(el.dataset.delMov);

        const newArr =
          (m.movimientosCuenta || [])
            .filter((_, idx) => idx !== i);

        await saveMonthField(
          m.id,
          "movimientosCuenta",
          newArr
        );
      });
    });
}

/* =========================================================
   INFORMES
   ========================================================= */

function renderInformes() {
  const main = document.getElementById("main-content");

  if (!months.length) {
    main.innerHTML =
      `<div class="card card-pad">
        Todavía no hay meses para generar un informe.
      </div>`;

    return;
  }

  if (
    !informesMonthId ||
    !months.find((x) => x.id === informesMonthId)
  ) {
    informesMonthId =
      months[months.length - 1].id;
  }

  const m =
    months.find((x) => x.id === informesMonthId);

  const t = computeTotals(m);

  const objetivo =
    Number(config.margenObjetivo ?? 30);

  const margenActual =
    t.ingCobrados > 0
      ? (t.beneficioNeto / t.ingCobrados) * 100
      : 0;

  const cumple =
    margenActual >= objetivo;

  const porCategoria = {};

  (m.gastos || []).forEach((g) => {
    const cat =
      g.categoria || "Sin categoría";

    porCategoria[cat] =
      (porCategoria[cat] || 0) +
      (Number(g.importe) || 0);
  });

  const catLabels =
    Object.keys(porCategoria);

  const catValues =
    Object.values(porCategoria);

  main.innerHTML = `

    <div class="card card-pad">

      <div style="
        display:flex;
        align-items:center;
        justify-content:space-between;
        margin-bottom:14px;
        flex-wrap:wrap;
        gap:8px;
      ">

        <h3 class="section-title" style="margin:0;">
          Informe de rentabilidad
        </h3>

        <select id="informe-month-select">
          ${months.map((mm) => `
            <option value="${mm.id}"
              ${mm.id === m.id ? "selected" : ""}>
              ${escapeHtml(mm.nombre)}
            </option>
          `).join("")}
        </select>

      </div>

      <div class="margin-card">

        <div>
          <div class="margin-value ${
            cumple ? "tone-good" : "tone-bad"
          }">
            ${margenActual.toFixed(1)}%
          </div>

          <div class="margin-sub">
            Margen de beneficio actual
            (objetivo: ${objetivo}%)
          </div>
        </div>

        <div class="margin-gauge">

          <div class="margin-bar-track">
            <div
              class="margin-bar-fill"
              style="
                width:${Math.max(
                  0,
                  Math.min(100, margenActual)
                )}%;
                background:${
                  cumple
                    ? "#047857"
                    : "#be123c"
                };
              "
            ></div>
          </div>

          <div
            class="margin-sub"
            style="margin-top:6px;"
          >
            ${
              cumple
                ? "✅ Por encima del objetivo — mes rentable"
                : "⚠️ Por debajo del objetivo"
            }
          </div>

        </div>
      </div>
    </div>

    <div class="card card-pad">

      <h3 class="section-title">
        Resultado económico
      </h3>

      <div class="resumen-grid">

        <div class="resumen-item">
          <div class="lbl">Ingresos cobrados</div>
          <div class="val tone-good">
            ${eur(t.ingCobrados)}
          </div>
        </div>

        <div class="resumen-item">
          <div class="lbl">Gastos pagados</div>
          <div class="val tone-bad">
            ${eur(t.gasPagados)}
          </div>
        </div>

        <div class="resumen-item">
          <div class="lbl">Beneficio neto</div>
          <div class="val ${
            t.beneficioNeto >= 0
              ? "tone-good"
              : "tone-bad"
          }">
            <strong>${eur(t.beneficioNeto)}</strong>
          </div>
        </div>

        <div class="resumen-item">
          <div class="lbl">Caja total calculada</div>
          <div class="val">
            <strong>${eur(t.cajaTotalCalculada)}</strong>
          </div>
        </div>

      </div>

      <p class="config-hint">
        Las retiradas y aportaciones del CEO no aparecen en el
        beneficio porque no son ingresos ni gastos de explotación.
        Solo modifican el saldo de las cuentas bancarias.
      </p>

    </div>

    <div class="card card-pad">

      <h3 class="section-title"
          style="margin-bottom:12px;">
        Gastos por categoría — ${escapeHtml(m.nombre)}
      </h3>

      ${
        catLabels.length
          ? `<div class="chart-wrap">
               <canvas id="chartPie"></canvas>
             </div>`
          : `<div class="config-hint">
               Todavía no hay gastos con importe este mes.
             </div>`
      }

    </div>
  `;

  document
    .getElementById("informe-month-select")
    .addEventListener("change", (e) => {
      informesMonthId =
        e.target.value;

      render();
    });

  if (catLabels.length) {

    new Chart(
      document.getElementById("chartPie"),
      {
        type: "doughnut",

        data: {
          labels: catLabels,

          datasets: [
            {
              data: catValues,
              backgroundColor:
                PIE_COLORS.slice(
                  0,
                  catLabels.length
                )
            }
          ]
        },

        options: {
          responsive: true,

          plugins: {
            legend: {
              position: "bottom"
            }
          }
        }
      }
    );
  }
}

/* =========================================================
   BENEFICIARIOS
   ========================================================= */

function renderBeneficiarios() {
  const main =
    document.getElementById("main-content");

  const rows =
    beneficiarios.map((b) => `
      <tr>

        <td>
          <input
            data-bf="nombre"
            data-id="${b.id}"
            value="${escapeHtml(b.nombre)}"
          >
        </td>

        <td>
          <input
            data-bf="iban"
            data-id="${b.id}"
            value="${escapeHtml(b.iban)}"
            style="font-family:var(--mono)"
          >
        </td>

        <td>
          <input
            data-bf="nif"
            data-id="${b.id}"
            value="${escapeHtml(b.nif)}"
          >
        </td>

        <td>
          <input
            data-bf="email"
            data-id="${b.id}"
            value="${escapeHtml(b.email)}"
          >
        </td>

        <td>
          <input
            data-bf="telefono"
            data-id="${b.id}"
            value="${escapeHtml(b.telefono)}"
          >
        </td>

        <td>
          <input
            data-bf="notas"
            data-id="${b.id}"
            value="${escapeHtml(b.notas)}"
          >
        </td>

        <td>
          <button
            class="btn-del"
            data-delbf="${b.id}"
          >
            ✕
          </button>
        </td>

      </tr>
    `).join("");

  main.innerHTML = `

    <div class="card">

      <div class="section-header">

        <div>
          <span class="section-title">
            Fichas de pago
          </span>

          <span class="section-count">
            ${beneficiarios.length}
          </span>
        </div>

        <button
          class="btn-add"
          id="btn-add-beneficiario"
        >
          + Añadir
        </button>

      </div>

      <table>

        <thead>
          <tr>
            <th>Nombre</th>
            <th>IBAN</th>
            <th>NIF/CIF</th>
            <th>Email</th>
            <th>Teléfono</th>
            <th>Notas</th>
            <th></th>
          </tr>
        </thead>

        <tbody>
          ${rows}
        </tbody>

      </table>

      ${
        !beneficiarios.length
          ? `<div class="config-hint"
                 style="padding:12px 16px;">
               Todavía no hay fichas guardadas.
               Añade la primera con el botón de arriba.
             </div>`
          : ""
      }

    </div>
  `;

  document
    .getElementById("btn-add-beneficiario")
    .addEventListener(
      "click",
      () => addBeneficiario({})
    );

  main
    .querySelectorAll("[data-bf]")
    .forEach((el) => {

      el.addEventListener("change", (e) => {

        updateBeneficiarioField(
          e.target.dataset.id,
          e.target.dataset.bf,
          e.target.value
        );
      });
    });

  main
    .querySelectorAll("[data-delbf]")
    .forEach((el) => {

      el.addEventListener("click", () => {

        if (
          confirm(
            "¿Eliminar esta ficha de pago?"
          )
        ) {
          removeBeneficiario(
            el.dataset.delbf
          );
        }
      });
    });
}

/* =========================================================
   CONFIGURACIÓN
   ========================================================= */

function renderConfig() {
  const main =
    document.getElementById("main-content");

  const catList =
    (config.categoriasGastos || [])
      .map((c) => `
        <span class="tag">
          ${escapeHtml(c)}

          <button
            data-cat="${escapeHtml(c)}"
            title="Eliminar categoría"
          >
            ✕
          </button>
        </span>
      `)
      .join("") ||
    `<span class="config-hint">
       Todavía no hay categorías.
     </span>`;

  const pfIngresosRows =
    (config.partidasFijasIngresos || [])
      .map((r, i) => `
        <tr>

          <td>
            <input
              data-pf="ingresos"
              data-i="${i}"
              data-f="cliente"
              value="${escapeHtml(r.cliente)}"
            >
          </td>

          <td>
            <input
              data-pf="ingresos"
              data-i="${i}"
              data-f="concepto"
              value="${escapeHtml(r.concepto)}"
            >
          </td>

          <td>
            <input
              type="number"
              step="0.01"
              data-pf="ingresos"
              data-i="${i}"
              data-f="importe"
              value="${r.importe || 0}"
            >
          </td>

          <td>
            <button
              class="btn-del"
              data-delpf="ingresos"
              data-i="${i}"
            >
              ✕
            </button>
          </td>

        </tr>
      `)
      .join("");

  const pfGastosRows =
    (config.partidasFijasGastos || [])
      .map((r, i) => {

        const opts =
          config.categoriasGastos || [];

        return `
          <tr>

            <td>
              <input
                data-pf="gastos"
                data-i="${i}"
                data-f="concepto"
                value="${escapeHtml(r.concepto)}"
              >
            </td>

            <td>
              <select
                data-pf="gastos"
                data-i="${i}"
                data-f="categoria"
              >
                <option
                  value=""
                  ${!r.categoria ? "selected" : ""}
                >
                  —
                </option>

                ${opts.map((c) => `
                  <option
                    value="${escapeHtml(c)}"
                    ${r.categoria === c ? "selected" : ""}
                  >
                    ${escapeHtml(c)}
                  </option>
                `).join("")}

              </select>
            </td>

            <td>
              <input
                type="number"
                step="0.01"
                data-pf="gastos"
                data-i="${i}"
                data-f="importe"
                value="${r.importe || 0}"
              >
            </td>

            <td>
              <button
                class="btn-del"
                data-delpf="gastos"
                data-i="${i}"
              >
                ✕
              </button>
            </td>

          </tr>
        `;
      })
      .join("");

  main.innerHTML = `

    <div class="card card-pad">

      <h3 class="section-title"
          style="margin-bottom:8px;">
        Cuentas de empresa
      </h3>

      <p class="config-hint"
         style="margin-top:0;margin-bottom:14px;">
        Puedes poner aquí los nombres reales de las dos cuentas.
        No se utiliza la cuenta personal del CEO como tercera cuenta.
      </p>

      <div class="resumen-grid">

        <div class="resumen-item">

          <div class="lbl">
            Cuenta empresa 1
          </div>

          <input
            type="text"
            id="f-account-name-1"
            value="${escapeHtml(
              config.cuentas?.empresa1 ||
              "Cuenta Empresa 1"
            )}"
          >

        </div>

        <div class="resumen-item">

          <div class="lbl">
            Cuenta empresa 2
          </div>

          <input
            type="text"
            id="f-account-name-2"
            value="${escapeHtml(
              config.cuentas?.empresa2 ||
              "Cuenta Empresa 2"
            )}"
          >

        </div>

      </div>

    </div>

    <div class="card card-pad">

      <h3 class="section-title"
          style="margin-bottom:8px;">
        Margen objetivo
      </h3>

      <p class="config-hint"
         style="margin-top:0;margin-bottom:10px;">
        Porcentaje de los ingresos que quieres que quede como
        beneficio neto.
      </p>

      <div class="target-input-row">

        <input
          type="number"
          id="f-margen"
          value="${config.margenObjetivo ?? 30}"
          min="0"
          max="100"
          step="1"
        >

        <span>%</span>

      </div>

    </div>

    <div class="card card-pad">

      <h3 class="section-title"
          style="margin-bottom:4px;">
        Categorías de gastos
      </h3>

      <p class="config-hint"
         style="margin-top:0;margin-bottom:14px;">
        Opciones del desplegable "Categoría".
      </p>

      <div
        class="tag-list"
        id="tag-list"
      >
        ${catList}
      </div>

      <form
        id="add-tag-form"
        class="add-tag-form"
      >

        <input
          id="new-tag-input"
          type="text"
          placeholder="Nueva categoría…"
        >

        <button
          type="submit"
          class="btn-add"
        >
          + Añadir
        </button>

      </form>

      <div class="config-hint">
        Borrar una categoría no afecta a los gastos ya guardados.
      </div>

    </div>

    <div class="card">

      <div class="section-header">

        <div>
          <span class="section-title">
            Partidas fijas de ingresos
          </span>

          <span class="section-count">
            ${(config.partidasFijasIngresos || []).length}
          </span>
        </div>

        <button
          class="btn-add"
          data-addpf="ingresos"
        >
          + Añadir
        </button>

      </div>

      <p class="config-hint"
         style="padding:8px 16px 0;">
        Se precargan como "No cobrado" en cada mes nuevo.
      </p>

      <table>

        <thead>
          <tr>
            <th>Cliente</th>
            <th>Concepto</th>
            <th>Importe</th>
            <th></th>
          </tr>
        </thead>

        <tbody>
          ${pfIngresosRows}
        </tbody>

      </table>

    </div>

    <div class="card">

      <div class="section-header">

        <div>
          <span class="section-title">
            Partidas fijas de gastos
          </span>

          <span class="section-count">
            ${(config.partidasFijasGastos || []).length}
          </span>
        </div>

        <button
          class="btn-add"
          data-addpf="gastos"
        >
          + Añadir
        </button>

      </div>

      <p class="config-hint"
         style="padding:8px 16px 0;">
        Se precargan como "Pendiente" en cada mes nuevo.
      </p>

      <table>

        <thead>
          <tr>
            <th>Concepto</th>
            <th>Categoría</th>
            <th>Importe</th>
            <th></th>
          </tr>
        </thead>

        <tbody>
          ${pfGastosRows}
        </tbody>

      </table>

    </div>
  `;

  document
    .getElementById("f-account-name-1")
    .addEventListener("change", async (e) => {

      await saveConfigField(
        "cuentas",
        {
          ...(config.cuentas || {}),
          empresa1: e.target.value.trim() ||
            "Cuenta Empresa 1"
        }
      );
    });

  document
    .getElementById("f-account-name-2")
    .addEventListener("change", async (e) => {

      await saveConfigField(
        "cuentas",
        {
          ...(config.cuentas || {}),
          empresa2: e.target.value.trim() ||
            "Cuenta Empresa 2"
        }
      );
    });

  document
    .getElementById("f-margen")
    .addEventListener("change", (e) => {

      saveConfigField(
        "margenObjetivo",
        Number(e.target.value) || 0
      );
    });

  document
    .getElementById("tag-list")
    .querySelectorAll("[data-cat]")
    .forEach((btn) => {

      btn.addEventListener("click", () => {

        removeCategoria(
          btn.dataset.cat
        );
      });
    });

  document
    .getElementById("add-tag-form")
    .addEventListener("submit", (e) => {

      e.preventDefault();

      const input =
        document.getElementById(
          "new-tag-input"
        );

      const val =
        input.value.trim();

      if (!val) return;

      if (
        (config.categoriasGastos || [])
          .includes(val)
      ) {
        input.value = "";
        return;
      }

      addCategoria(val);

      input.value = "";
    });

  main
    .querySelectorAll("[data-pf]")
    .forEach((el) => {

      el.addEventListener("change", (e) => {

        const arr =
          e.target.dataset.pf;

        const i =
          Number(e.target.dataset.i);

        const f =
          e.target.dataset.f;

        const field =
          arr === "ingresos"
            ? "partidasFijasIngresos"
            : "partidasFijasGastos";

        const list =
          [...(config[field] || [])];

        list[i] = {
          ...list[i],
          [f]:
            e.target.type === "number"
              ? Number(e.target.value) || 0
              : e.target.value
        };

        saveConfigField(
          field,
          list
        );
      });
    });

  main
    .querySelectorAll("[data-addpf]")
    .forEach((el) => {

      el.addEventListener("click", () => {

        const arr =
          el.dataset.addpf;

        const field =
          arr === "ingresos"
            ? "partidasFijasIngresos"
            : "partidasFijasGastos";

        const blank =
          arr === "ingresos"
            ? {
                cliente: "",
                concepto: "",
                importe: 0
              }
            : {
                concepto: "",
                categoria: "",
                importe: 0
              };

        saveConfigField(
          field,
          [
            ...(config[field] || []),
            blank
          ]
        );
      });
    });

  main
    .querySelectorAll("[data-delpf]")
    .forEach((el) => {

      el.addEventListener("click", () => {

        const arr =
          el.dataset.delpf;

        const i =
          Number(el.dataset.i);

        const field =
          arr === "ingresos"
            ? "partidasFijasIngresos"
            : "partidasFijasGastos";

        const list =
          (config[field] || [])
            .filter(
              (_, idx) => idx !== i
            );

        saveConfigField(
          field,
          list
        );
      });
    });
}

/* =========================================================
   PDF
   ========================================================= */

function printMonth(rawMonth, t) {
  const m = normalizeMonth(rawMonth);

  const fecha =
    new Date().toLocaleDateString(
      "es-ES",
      {
        day: "numeric",
        month: "long",
        year: "numeric"
      }
    );

  const resumenRows = [
    [
      "Ingresos cobrados",
      eur(t.ingCobrados)
    ],

    [
      "Ingresos pendientes",
      eur(t.ingPendientes)
    ],

    [
      "Facturación total",
      eur(t.facturacionTotal)
    ],

    [
      "Gastos pagados",
      eur(t.gasPagados)
    ],

    [
      "Gastos pendientes",
      eur(t.gasPendientes)
    ],

    [
      "Total gastos",
      eur(t.totalGastos)
    ],

    [
      "Beneficio neto",
      eur(t.beneficioNeto),
      true
    ],

    [
      "Caja total calculada",
      eur(t.cajaTotalCalculada),
      true
    ],

    [
      config.cuentas?.empresa1 || "Cuenta Empresa 1",
      eur(t.accounts.empresa1.saldoCalculado)
    ],

    [
      config.cuentas?.empresa2 || "Cuenta Empresa 2",
      eur(t.accounts.empresa2.saldoCalculado)
    ]
  ];

  const ingresosBody =
    (m.ingresos || [])
      .map((r) => `
        <tr>
          <td>${escapeHtml(r.cliente)}</td>
          <td>${escapeHtml(r.concepto)}</td>
          <td>${eur(r.importe)}</td>
          <td>${escapeHtml(r.cobrado)}</td>
          <td>${escapeHtml(
            config.cuentas?.[r.cuenta] ||
            ACCOUNT_NAMES[r.cuenta] ||
            ""
          )}</td>
        </tr>
      `)
      .join("") ||
    `<tr><td colspan="5">Sin datos</td></tr>`;

  const gastosBody =
    (m.gastos || [])
      .map((r) => `
        <tr>
          <td>${escapeHtml(r.concepto)}</td>
          <td>${escapeHtml(r.categoria)}</td>
          <td>${eur(r.importe)}</td>
          <td>${escapeHtml(r.estado)}</td>
          <td>${escapeHtml(
            config.cuentas?.[r.cuenta] ||
            ACCOUNT_NAMES[r.cuenta] ||
            ""
          )}</td>
        </tr>
      `)
      .join("") ||
    `<tr><td colspan="5">Sin datos</td></tr>`;

  const movimientosBody =
    (m.movimientosCuenta || [])
      .map((r) => `
        <tr>
          <td>${escapeHtml(r.fecha)}</td>
          <td>${escapeHtml(r.tipo)}</td>
          <td>${escapeHtml(
            config.cuentas?.[r.cuenta] ||
            ACCOUNT_NAMES[r.cuenta] ||
            ""
          )}</td>
          <td>${escapeHtml(r.concepto)}</td>
          <td>${eur(r.importe)}</td>
        </tr>
      `)
      .join("") ||
    `<tr><td colspan="5">Sin movimientos</td></tr>`;

  const facturasBody =
    (m.facturas || [])
      .map((r) => `
        <tr>
          <td>${escapeHtml(r.factura)}</td>
          <td>${escapeHtml(r.emisor)}</td>
          <td>${escapeHtml(r.concepto)}</td>
          <td>${eur(r.importe)}</td>
        </tr>
      `)
      .join("") ||
    `<tr><td colspan="4">Sin datos</td></tr>`;

  document.getElementById("print-area").innerHTML = `

    <div class="print-title">
      Finanzas — ${escapeHtml(m.nombre)}
    </div>

    <div class="print-sub">
      Informe generado el ${fecha}
    </div>

    <div class="print-section-title">
      Resultado económico
    </div>

    <div class="print-resumen">
      ${resumenRows
        .map(
          ([lbl, val, hl]) => `
            <div class="${hl ? "hl" : ""}">
              <span>${lbl}</span>
              <span>${val}</span>
            </div>
          `
        )
        .join("")}
    </div>

    <div class="print-section-title">
      Ingresos (${(m.ingresos || []).length})
    </div>

    <table class="print-table">

      <thead>
        <tr>
          <th>Cliente</th>
          <th>Concepto</th>
          <th>Importe</th>
          <th>Cobrado</th>
          <th>Cuenta</th>
        </tr>
      </thead>

      <tbody>
        ${ingresosBody}
      </tbody>

    </table>

    <div class="print-section-title">
      Gastos (${(m.gastos || []).length})
    </div>

    <table class="print-table">

      <thead>
        <tr>
          <th>Concepto</th>
          <th>Categoría</th>
          <th>Importe</th>
          <th>Estado</th>
          <th>Cuenta</th>
        </tr>
      </thead>

      <tbody>
        ${gastosBody}
      </tbody>

    </table>

    <div class="print-section-title">
      Movimientos de cuenta / CEO
    </div>

    <table class="print-table">

      <thead>
        <tr>
          <th>Fecha</th>
          <th>Tipo</th>
          <th>Cuenta</th>
          <th>Concepto</th>
          <th>Importe</th>
        </tr>
      </thead>

      <tbody>
        ${movimientosBody}
      </tbody>

    </table>

    <div class="print-section-title">
      Facturas recibidas (${(m.facturas || []).length})
      — total: ${eur(t.totalFacturasRecibidas)}
    </div>

    <table class="print-table">

      <thead>
        <tr>
          <th>Factura</th>
          <th>Emisor</th>
          <th>Concepto</th>
          <th>Importe</th>
        </tr>
      </thead>

      <tbody>
        ${facturasBody}
      </tbody>

    </table>
  `;

  window.print();
}

/* =========================================================
   MES
   ========================================================= */

function renderMonth(rawMonth) {
  const m = normalizeMonth(rawMonth);
  const t = computeTotals(m);

  const main =
    document.getElementById("main-content");

  const accountOptions = (selected) =>
    ACCOUNT_IDS
      .map(
        (id) => `
          <option
            value="${id}"
            ${selected === id ? "selected" : ""}
          >
            ${escapeHtml(
              config.cuentas?.[id] ||
              ACCOUNT_NAMES[id]
            )}
          </option>
        `
      )
      .join("");

  const ingresosRows =
    (m.ingresos || [])
      .map(
        (r, i) => `
          <tr>

            <td>
              <input
                data-arr="ingresos"
                data-i="${i}"
                data-f="cliente"
                value="${escapeHtml(r.cliente)}"
              >
            </td>

            <td>
              <input
                data-arr="ingresos"
                data-i="${i}"
                data-f="concepto"
                value="${escapeHtml(r.concepto)}"
              >
            </td>

            <td>
              <input
                type="number"
                step="0.01"
                data-arr="ingresos"
                data-i="${i}"
                data-f="importe"
                value="${r.importe || 0}"
              >
            </td>

            <td>
              <select
                class="${estadoClass(r.cobrado)}"
                data-arr="ingresos"
                data-i="${i}"
                data-f="cobrado"
              >
                <option
                  value="Sí"
                  ${r.cobrado === "Sí" ? "selected" : ""}
                >
                  Sí
                </option>

                <option
                  value="No"
                  ${r.cobrado === "No" ? "selected" : ""}
                >
                  No
                </option>
              </select>
            </td>

            <td>
              <select
                class="account-select"
                data-arr="ingresos"
                data-i="${i}"
                data-f="cuenta"
              >
                ${accountOptions(r.cuenta)}
              </select>
            </td>

            <td>
              <button
                class="btn-del"
                data-del="ingresos"
                data-i="${i}"
              >
                ✕
              </button>
            </td>

          </tr>
        `
      )
      .join("");

  const gastosRows =
    (m.gastos || [])
      .map((r, i) => {

        const catOptions =
          [
            ...(config.categoriasGastos || []),
            ...(r.categoria
              ? [r.categoria]
              : [])
          ];

        return `
          <tr>

            <td>
              <input
                data-arr="gastos"
                data-i="${i}"
                data-f="concepto"
                value="${escapeHtml(r.concepto)}"
              >
            </td>

            <td>
              <select
                data-arr="gastos"
                data-i="${i}"
                data-f="categoria"
              >

                <option
                  value=""
                  ${!r.categoria ? "selected" : ""}
                >
                  —
                </option>

                ${[
                  ...new Set(catOptions)
                ].map((c) => `
                  <option
                    value="${escapeHtml(c)}"
                    ${r.categoria === c ? "selected" : ""}
                  >
                    ${escapeHtml(c)}
                  </option>
                `).join("")}

              </select>
            </td>

            <td>
              <input
                type="number"
                step="0.01"
                data-arr="gastos"
                data-i="${i}"
                data-f="importe"
                value="${r.importe || 0}"
              >
            </td>

            <td>
              <select
                class="${estadoClass(r.estado)}"
                data-arr="gastos"
                data-i="${i}"
                data-f="estado"
              >

                <option
                  value="Pagado"
                  ${r.estado === "Pagado" ? "selected" : ""}
                >
                  Pagado
                </option>

                <option
                  value="Pendiente"
                  ${r.estado === "Pendiente" ? "selected" : ""}
                >
                  Pendiente
                </option>

              </select>
            </td>

            <td>
              <select
                class="account-select"
                data-arr="gastos"
                data-i="${i}"
                data-f="cuenta"
              >
                ${accountOptions(r.cuenta)}
              </select>
            </td>

            <td>
              <button
                class="btn-del"
                data-del="gastos"
                data-i="${i}"
              >
                ✕
              </button>
            </td>

          </tr>
        `;
      })
      .join("");

  const facturasRows =
    (m.facturas || [])
      .map(
        (r, i) => `
          <tr>

            <td>
              <input
                data-arr="facturas"
                data-i="${i}"
                data-f="factura"
                value="${escapeHtml(r.factura)}"
              >
            </td>

            <td>
              <input
                data-arr="facturas"
                data-i="${i}"
                data-f="emisor"
                value="${escapeHtml(r.emisor)}"
              >
            </td>

            <td>
              <input
                data-arr="facturas"
                data-i="${i}"
                data-f="concepto"
                value="${escapeHtml(r.concepto)}"
              >
            </td>

            <td>
              <input
                type="number"
                step="0.01"
                data-arr="facturas"
                data-i="${i}"
                data-f="importe"
                value="${r.importe || 0}"
              >
            </td>

            <td>
              <input
                data-arr="facturas"
                data-i="${i}"
                data-f="notas"
                value="${escapeHtml(r.notas)}"
              >
            </td>

            <td>
              <button
                class="btn-del"
                data-del="facturas"
                data-i="${i}"
              >
                ✕
              </button>
            </td>

          </tr>
        `
      )
      .join("");

  main.innerHTML = `

    <div class="month-header">

      <h2>${escapeHtml(m.nombre)}</h2>

      ${
        months.length > 1
          ? `
            <button
              class="btn-link-danger"
              id="btn-del-month"
            >
              ✕ Eliminar mes
            </button>
          `
          : ""
      }

    </div>

    <div class="stat-grid">

      ${statCard(
        "Ingresos cobrados",
        t.ingCobrados,
        "good"
      )}

      ${statCard(
        "Gastos pagados",
        t.gasPagados,
        "bad"
      )}

      ${statCard(
        "Gastos pendientes",
        t.gasPendientes,
        "warn"
      )}

      ${statCard(
        "Beneficio neto",
        t.beneficioNeto,
        t.beneficioNeto >= 0
          ? "good"
          : "bad"
      )}

    </div>

    <div class="card card-pad">

      <h3 class="section-title"
          style="margin-bottom:12px;">
        Resultado económico
      </h3>

      <div class="resumen-grid">

        <div class="resumen-item">
          <div class="lbl">Ingresos cobrados</div>
          <div class="val tone-good">
            ${eur(t.ingCobrados)}
          </div>
        </div>

        <div class="resumen-item">
          <div class="lbl">Ingresos pendientes</div>
          <div class="val tone-warn">
            ${eur(t.ingPendientes)}
          </div>
        </div>

        <div class="resumen-item">
          <div class="lbl">Facturación total</div>
          <div class="val">
            ${eur(t.facturacionTotal)}
          </div>
        </div>

        <div class="resumen-item">
          <div class="lbl">Gastos realizados</div>
          <div class="val tone-bad">
            ${eur(t.gasPagados)}
          </div>
        </div>

        <div class="resumen-item">
          <div class="lbl">Gastos pendientes</div>
          <div class="val tone-warn">
            ${eur(t.gasPendientes)}
          </div>
        </div>

        <div class="resumen-item">
          <div class="lbl">Total gastos</div>
          <div class="val">
            ${eur(t.totalGastos)}
          </div>
        </div>

        <div class="resumen-item">
          <div class="lbl">Beneficio neto</div>
          <div class="val ${
            t.beneficioNeto >= 0
              ? "tone-good"
              : "tone-bad"
          }">
            <strong>
              ${eur(t.beneficioNeto)}
            </strong>
          </div>
        </div>

        <div class="resumen-item">
          <div class="lbl">Caja total calculada</div>
          <div class="val">
            <strong>
              ${eur(t.cajaTotalCalculada)}
            </strong>
          </div>
        </div>

      </div>

      <p class="config-hint"
         style="margin-top:12px;">

        <strong>Beneficio neto</strong> =
        ingresos cobrados − gastos pagados.

        <br><br>

        <strong>Caja</strong> =
        saldos iniciales + ingresos cobrados
        − gastos pagados ± movimientos de caja.

        <br><br>

        Las retiradas y aportaciones del CEO
        <strong>no son gastos ni ingresos</strong>.
      </p>

    </div>

    <div class="card card-pad">

      <h3 class="section-title"
          style="margin-bottom:12px;">
        Resumen de cuentas
      </h3>

      <div class="account-grid">

        ${renderAccountCard(
          m,
          t,
          "empresa1"
        )}

        ${renderAccountCard(
          m,
          t,
          "empresa2"
        )}

      </div>

      <div style="margin-top:14px;">
        <button
          class="btn-add"
          id="btn-open-cuentas"
        >
          🏦 Gestionar cuentas y movimientos
        </button>
      </div>

    </div>

    <div class="card">

      <div class="section-header">

        <div>
          <span class="section-title">
            Ingresos
          </span>

          <span class="section-count">
            ${(m.ingresos || []).length}
          </span>
        </div>

        <button
          class="btn-add"
          data-add="ingresos"
        >
          + Añadir
        </button>

      </div>

      <div class="table-scroll">

        <table>

          <thead>
            <tr>
              <th>Cliente</th>
              <th>Concepto</th>
              <th>Importe</th>
              <th>Cobrado</th>
              <th>Cuenta</th>
              <th></th>
            </tr>
          </thead>

          <tbody>
            ${ingresosRows}
          </tbody>

        </table>

      </div>

      <div class="section-footer">
        <button
          class="btn-add"
          data-add="ingresos"
        >
          + Añadir
        </button>
      </div>

    </div>

    <div class="card">

      <div class="section-header">

        <div>
          <span class="section-title">
            Gastos
          </span>

          <span class="section-count">
            ${(m.gastos || []).length}
          </span>
        </div>

        <button
          class="btn-add"
          data-add="gastos"
        >
          + Añadir
        </button>

      </div>

      <div class="table-scroll">

        <table>

          <thead>
            <tr>
              <th>Concepto</th>
              <th>Categoría</th>
              <th>Importe</th>
              <th>Estado</th>
              <th>Cuenta</th>
              <th></th>
            </tr>
          </thead>

          <tbody>
            ${gastosRows}
          </tbody>

        </table>

      </div>

      <div class="section-footer">
        <button
          class="btn-add"
          data-add="gastos"
        >
          + Añadir
        </button>
      </div>

    </div>

    <div class="card">

      <div class="section-header">

        <div>
          <span class="section-title">
            Facturas recibidas
          </span>

          <span class="section-count">
            ${(m.facturas || []).length}
          </span>
        </div>

        <button
          class="btn-add"
          data-add="facturas"
        >
          + Añadir
        </button>

      </div>

      <p class="config-hint"
         style="padding:8px 16px 0;">
        Registro de facturas recibidas.
        No entra directamente en el Resumen del mes.
      </p>

      <div class="table-scroll">

        <table>

          <thead>
            <tr>
              <th>Factura</th>
              <th>Emisor</th>
              <th>Concepto</th>
              <th>Importe</th>
              <th>Notas</th>
              <th></th>
            </tr>
          </thead>

          <tbody>
            ${facturasRows}
          </tbody>

        </table>

      </div>

      <div
        class="section-footer"
        style="justify-content:space-between;"
      >

        <button
          class="btn-add"
          data-add="facturas"
        >
          + Añadir
        </button>

        <span
          class="config-hint"
          style="margin:0;"
        >
          Total facturas:
          <strong>
            ${eur(t.totalFacturasRecibidas)}
          </strong>
        </span>

      </div>

    </div>
  `;

  /* ---------- botones de cuenta ---------- */

  main
    .querySelectorAll("[data-account-field]")
    .forEach((el) => {

      el.addEventListener(
        "change",
        async (e) => {

          const accountId =
            e.target.dataset.accountId;

          const field =
            e.target.dataset.accountField;

          let value;

          if (field === "saldoReal") {
            value =
              e.target.value === ""
                ? null
                : Number(e.target.value);
          } else if (
            field === "saldoInicial"
          ) {
            value =
              Number(e.target.value) || 0;
          } else {
            value = e.target.value;
          }

          await saveAccountField(
            m.id,
            accountId,
            field,
            value
          );
        }
      );
    });

  document
    .getElementById("btn-open-cuentas")
    .addEventListener("click", () => {

      cuentasMonthId = m.id;
      currentView = "cuentas";
      render();
    });

  /* ---------- eliminar mes ---------- */

  const delMonthBtn =
    document.getElementById(
      "btn-del-month"
    );

  if (delMonthBtn) {

    delMonthBtn.addEventListener(
      "click",
      async () => {

        if (
          confirm(
            `¿Eliminar "${m.nombre}"? Esta acción no se puede deshacer.`
          )
        ) {

          await removeMonth(m.id);

          currentView =
            "dashboard";
        }
      }
    );
  }

  /* ---------- edición de ingresos/gastos/facturas ---------- */

  main
    .querySelectorAll("[data-arr]")
    .forEach((el) => {

      el.addEventListener(
        "change",
        async (e) => {

          const arr =
            e.target.dataset.arr;

          const i =
            Number(e.target.dataset.i);

          const f =
            e.target.dataset.f;

          const newArr =
            [...(m[arr] || [])];

          let value =
            e.target.value;

          if (
            e.target.type === "number"
          ) {
            value =
              Number(e.target.value) || 0;
          }

          newArr[i] = {
            ...newArr[i],
            [f]: value
          };

          await saveMonthField(
            m.id,
            arr,
            newArr
          );
        }
      );
    });

  /* ---------- añadir ---------- */

  main
    .querySelectorAll("[data-add]")
    .forEach((el) => {

      el.addEventListener(
        "click",
        async () => {

          const arr =
            el.dataset.add;

          const blank =
            arr === "ingresos"
              ? {
                  cliente: "",
                  concepto: "",
                  importe: 0,
                  cobrado: "No",
                  cuenta: "empresa1"
                }
              : arr === "gastos"
                ? {
                    concepto: "",
                    categoria: "",
                    importe: 0,
                    estado: "Pendiente",
                    cuenta: "empresa1"
                  }
                : {
                    factura: "",
                    emisor: "",
                    concepto: "",
                    importe: 0,
                    notas: ""
                  };

          await saveMonthField(
            m.id,
            arr,
            [
              ...(m[arr] || []),
              blank
            ]
          );
        }
      );
    });

  /* ---------- borrar ---------- */

  main
    .querySelectorAll("[data-del]")
    .forEach((el) => {

      el.addEventListener(
        "click",
        async () => {

          const arr =
            el.dataset.del;

          const i =
            Number(el.dataset.i);

          const newArr =
            (m[arr] || [])
              .filter(
                (_, idx) => idx !== i
              );

          await saveMonthField(
            m.id,
            arr,
            newArr
          );
        }
      );
    });
}

/* =========================================================
   RENDER PRINCIPAL
   ========================================================= */

function render() {
  if (!ready) return;

  renderSidebar();

  if (currentView === "dashboard") {
    renderDashboard();

  } else if (currentView === "informes") {
    renderInformes();

  } else if (currentView === "cuentas") {
    renderCuentas();

  } else if (currentView === "beneficiarios") {
    renderBeneficiarios();

  } else if (currentView === "config") {
    renderConfig();

  } else if (
    months.find(
      (m) => m.id === currentView
    )
  ) {
    renderMonth(
      months.find(
        (m) => m.id === currentView
      )
    );

  } else {
    currentView =
      "dashboard";

    renderDashboard();
  }
}

/* =========================================================
   NAVEGACIÓN
   ========================================================= */

document
  .getElementById("nav-dashboard")
  .addEventListener("click", () => {
    currentView = "dashboard";
    render();
  });

document
  .getElementById("nav-informes")
  .addEventListener("click", () => {
    currentView = "informes";
    render();
  });

document
  .getElementById("nav-cuentas")
  .addEventListener("click", () => {

    if (!cuentasMonthId && months.length) {
      cuentasMonthId =
        months[months.length - 1].id;
    }

    currentView = "cuentas";
    render();
  });

document
  .getElementById("nav-beneficiarios")
  .addEventListener("click", () => {
    currentView =
      "beneficiarios";
    render();
  });

document
  .getElementById("nav-config")
  .addEventListener("click", () => {
    currentView = "config";
    render();
  });

/* =========================================================
   PDF
   ========================================================= */

document
  .getElementById("btn-pdf")
  .addEventListener("click", () => {

    if (!months.length) {
      alert(
        "Todavía no hay ningún mes con datos."
      );

      return;
    }

    const m =
      months.find(
        (x) => x.id === currentView
      ) ||
      months.find(
        (x) => x.id === informesMonthId
      ) ||
      months.find(
        (x) => x.id === cuentasMonthId
      ) ||
      months[months.length - 1];

    printMonth(
      m,
      computeTotals(m)
    );
  });

/* =========================================================
   NUEVO MES
   ========================================================= */

document
  .getElementById("btn-add-month")
  .addEventListener(
    "click",
    async () => {

      const nombre =
        prompt(
          "Nombre del nuevo mes (ej. Agosto 2026):"
        );

      if (!nombre) return;

      const last =
        months[months.length - 1];

      let accountsIniciales = {
        empresa1: 0,
        empresa2: 0
      };

      /*
       * MUY IMPORTANTE:
       *
       * El siguiente mes empieza con el saldo
       * calculado de CADA cuenta por separado.
       */
      if (last) {

        const t =
          computeTotals(last);

        accountsIniciales = {
          empresa1:
            t.accounts.empresa1.saldoCalculado,

          empresa2:
            t.accounts.empresa2.saldoCalculado
        };
      }

      await addMonth(
        nombre,
        accountsIniciales
      );
    }
  );

/* =========================================================
   FIREBASE / BOOTSTRAP
   ========================================================= */

let monthsReady = false;
let configReady = false;
let beneficiariosReady = false;

function maybeReady() {

  if (
    monthsReady &&
    configReady &&
    beneficiariosReady
  ) {
    ready = true;
    render();
  }
}

onAuthStateChanged(
  auth,
  async (user) => {

    if (!user) return;

    const configSnap =
      await getDoc(configRef);

    if (!configSnap.exists()) {

      await setDoc(
        configRef,
        DEFAULT_CONFIG
      );

    } else {

      /*
       * Si ya existe configuración antigua,
       * añadimos únicamente la nueva propiedad
       * "cuentas" sin borrar nada.
       */
      const existing =
        configSnap.data();

      if (!existing.cuentas) {

        await updateDoc(
          configRef,
          {
            cuentas:
              DEFAULT_CONFIG.cuentas
          }
        );
      }
    }

    onSnapshot(
      configRef,
      (snap) => {

        config =
          snap.exists()
            ? {
                ...DEFAULT_CONFIG,
                ...snap.data(),
                cuentas: {
                  ...DEFAULT_CONFIG.cuentas,
                  ...(snap.data().cuentas || {})
                }
              }
            : {
                ...DEFAULT_CONFIG
              };

        configReady = true;

        if (ready) {
          render();
        } else {
          maybeReady();
        }
      }
    );

    const q =
      query(
        mesesRef,
        orderBy("orden", "asc")
      );

    onSnapshot(
      q,
      async (snap) => {

        if (
          snap.empty &&
          !ready
        ) {

          await addDoc(
            mesesRef,
            seedMonth()
          );

          return;
        }

        months =
          snap.docs.map(
            (d) => ({
              id: d.id,
              ...d.data()
            })
          );

        monthsReady = true;

        if (ready) {
          render();
        } else {
          maybeReady();
        }
      }
    );

    const qb =
      query(
        beneficiariosRef,
        orderBy("orden", "asc")
      );

    onSnapshot(
      qb,
      (snap) => {

        beneficiarios =
          snap.docs.map(
            (d) => ({
              id: d.id,
              ...d.data()
            })
          );

        beneficiariosReady = true;

        if (ready) {
          render();
        } else {
          maybeReady();
        }
      }
    );
  }
);

signInAnonymously(auth)
  .catch((err) => {

    document.getElementById(
      "main-content"
    ).innerHTML = `
      <div class="card card-pad">
        Error al conectar con Firebase:
        ${escapeHtml(err.message)}.

        <br><br>

        Revisa
        <code>firebase-config.js</code>
        y que la autenticación anónima esté activada.
      </div>
    `;
  });
