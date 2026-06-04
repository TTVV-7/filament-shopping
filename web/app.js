const DATA_URL = "data/amazon_filament_research.json";

const resultsBodyEl = document.getElementById("resultsBody");
const queryFilterEl = document.getElementById("queryFilter");
const clearQueryBtnEl = document.getElementById("clearQueryBtn");
const metaEl = document.getElementById("meta");

const tabDealsEl = document.getElementById("tabDeals");
const tabStoresEl = document.getElementById("tabStores");
const tabManageEl = document.getElementById("tabManage");
const dealsPanelEl = document.getElementById("dealsPanel");
const storesPanelEl = document.getElementById("storesPanel");
const managePanelEl = document.getElementById("managePanel");

const bambuConnectFormEl = document.getElementById("bambuConnectForm");
const bambuEmailEl = document.getElementById("bambuEmail");
const bambuTokenEl = document.getElementById("bambuToken");
const disconnectBambuBtnEl = document.getElementById("disconnectBambuBtn");
const bambuStatusEl = document.getElementById("bambuStatus");

const inventoryFormEl = document.getElementById("inventoryForm");
const invBrandEl = document.getElementById("invBrand");
const invMaterialEl = document.getElementById("invMaterial");
const invColorEl = document.getElementById("invColor");
const invWeightEl = document.getElementById("invWeight");
const invNotesEl = document.getElementById("invNotes");

const historyFormEl = document.getElementById("historyForm");
const histBrandEl = document.getElementById("histBrand");
const histMaterialEl = document.getElementById("histMaterial");
const histColorEl = document.getElementById("histColor");
const histUsedEl = document.getElementById("histUsed");
const histNameEl = document.getElementById("histName");
const histDateEl = document.getElementById("histDate");

const clearUsageBtnEl = document.getElementById("clearUsageBtn");
const clearInventoryBtnEl = document.getElementById("clearInventoryBtn");
const filamentSummaryBodyEl = document.getElementById("filamentSummaryBody");

const STATE_KEYS = {
  bambu: "filament.bambu.connection",
  inventory: "filament.inventory.records",
  usage: "filament.usage.records",
};

const HARDCODED_BAMBU_ACCOUNT = {
  enabled: true,
  provider: "google",
  email: "your-google-email@gmail.com",
};

let allRows = [];
let bambuConnection = {
  connected: false,
  email: "",
  hasToken: false,
  connectedAt: null,
};
let inventoryRecords = [];
let usageRecords = [];

function safeLoad(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function safeSave(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage failures, app still works in-memory.
  }
}

function normalizeKeyPart(value) {
  return String(value || "").trim().toLowerCase();
}

function displayPart(value) {
  const text = String(value || "").trim();
  return text || "Unknown";
}

function makeFilamentKey(brand, material, color) {
  return [normalizeKeyPart(brand), normalizeKeyPart(material), normalizeKeyPart(color)].join("|");
}

function toPositiveNumber(value) {
  const num = Number(value);
  if (Number.isNaN(num) || num <= 0) return null;
  return num;
}

function loadManagementState() {
  if (HARDCODED_BAMBU_ACCOUNT.enabled) {
    bambuConnection = {
      connected: true,
      email: HARDCODED_BAMBU_ACCOUNT.email,
      hasToken: false,
      connectedAt: "hardcoded",
      provider: HARDCODED_BAMBU_ACCOUNT.provider,
    };
    safeSave(STATE_KEYS.bambu, bambuConnection);
  }

  const loadedConnection = safeLoad(STATE_KEYS.bambu, bambuConnection);
  if (loadedConnection && typeof loadedConnection === "object") {
    bambuConnection = {
      connected: Boolean(loadedConnection.connected),
      email: String(loadedConnection.email || ""),
      hasToken: Boolean(loadedConnection.hasToken),
      connectedAt: loadedConnection.connectedAt || null,
      provider: String(loadedConnection.provider || ""),
    };
  }

  const loadedInventory = safeLoad(STATE_KEYS.inventory, []);
  if (Array.isArray(loadedInventory)) {
    inventoryRecords = loadedInventory;
  }

  const loadedUsage = safeLoad(STATE_KEYS.usage, []);
  if (Array.isArray(loadedUsage)) {
    usageRecords = loadedUsage;
  }
}

function updateBambuStatus() {
  if (!bambuStatusEl) return;
  if (!bambuConnection.connected) {
    bambuStatusEl.textContent = "Not connected";
    bambuStatusEl.classList.remove("connected");
    return;
  }

  const tokenState = bambuConnection.hasToken ? "token saved" : "no token";
  const provider = bambuConnection.provider ? ` via ${bambuConnection.provider}` : "";
  const when = bambuConnection.connectedAt && bambuConnection.connectedAt !== "hardcoded"
    ? ` | Connected: ${new Date(bambuConnection.connectedAt).toLocaleString()}`
    : " | Connected: hardcoded";
  bambuStatusEl.textContent = `Connected as ${bambuConnection.email || "unknown"}${provider} (${tokenState})${when}`;
  bambuStatusEl.classList.add("connected");
}

function setDefaultHistoryDate() {
  if (!histDateEl) return;
  if (histDateEl.value) return;
  const now = new Date();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  histDateEl.value = `${now.getFullYear()}-${month}-${day}`;
}

function renderManagementSummary() {
  if (!filamentSummaryBodyEl) return;

  if (!inventoryRecords.length) {
    filamentSummaryBodyEl.innerHTML = '<tr><td colspan="8">No inventory yet. Add your spools to start tracking.</td></tr>';
    return;
  }

  const grouped = new Map();

  for (const spool of inventoryRecords) {
    const key = makeFilamentKey(spool.brand, spool.material, spool.color);
    if (!grouped.has(key)) {
      grouped.set(key, {
        brand: displayPart(spool.brand),
        material: displayPart(spool.material),
        color: displayPart(spool.color),
        spools: 0,
        startG: 0,
        usedG: 0,
      });
    }
    const bucket = grouped.get(key);
    bucket.spools += 1;
    bucket.startG += Number(spool.startG) || 0;
  }

  for (const usage of usageRecords) {
    const key = makeFilamentKey(usage.brand, usage.material, usage.color);
    if (!grouped.has(key)) continue;
    const bucket = grouped.get(key);
    bucket.usedG += Number(usage.usedG) || 0;
  }

  const rows = [...grouped.values()].sort((a, b) => {
    if (a.material !== b.material) return a.material.localeCompare(b.material);
    if (a.brand !== b.brand) return a.brand.localeCompare(b.brand);
    return a.color.localeCompare(b.color);
  });

  filamentSummaryBodyEl.innerHTML = rows
    .map((row) => {
      const remainingG = Math.max(row.startG - row.usedG, 0);
      const percent = row.startG > 0 ? (remainingG / row.startG) * 100 : 0;
      return `
        <tr>
          <td>${row.brand}</td>
          <td>${row.material}</td>
          <td>${row.color}</td>
          <td>${row.spools}</td>
          <td>${fmt(row.startG, 0)}</td>
          <td>${fmt(row.usedG, 0)}</td>
          <td>${fmt(remainingG, 0)}</td>
          <td>${fmt(percent, 1)}%</td>
        </tr>
      `;
    })
    .join("");
}

function fmt(value, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "-";
  }
  return Number(value).toFixed(digits);
}

function tokenizeQuery(query) {
  const tokens = [];
  for (const part of query.trim().split(/\s+/)) {
    if (!part) continue;
    const idx = part.indexOf(":");
    if (idx > 0) {
      const key = part.slice(0, idx).toLowerCase();
      const value = part.slice(idx + 1).trim();
      tokens.push({ type: "kv", key, value });
    } else {
      tokens.push({ type: "text", value: part.toLowerCase() });
    }
  }
  return tokens;
}

function rowText(row) {
  return [
    row.material,
    row.brand,
    row.source,
    row.color,
    row.color_options,
    row.spec_tags,
    row.title,
  ]
    .join(" ")
    .toLowerCase();
}

function matchToken(row, token) {
  if (token.type === "text") {
    return rowText(row).includes(token.value);
  }

  const value = token.value.toLowerCase();
  if (!value) return true;

  switch (token.key) {
    case "brand":
      return (row.brand || "").toLowerCase().includes(value);
    case "material":
      return (row.material || "").toLowerCase().includes(value);
    case "source":
      return (row.source || "").toLowerCase().includes(value);
    case "color":
      return ((row.color || "") + " " + (row.color_options || "")).toLowerCase().includes(value);
    case "spec":
      return (row.spec_tags || "").toLowerCase().includes(value);
    case "maxppk": {
      const limit = Number(value);
      if (Number.isNaN(limit)) return true;
      return row.price_per_kg !== null && Number(row.price_per_kg) <= limit;
    }
    case "minppk": {
      const limit = Number(value);
      if (Number.isNaN(limit)) return true;
      return row.price_per_kg !== null && Number(row.price_per_kg) >= limit;
    }
    case "maxprice": {
      const limit = Number(value);
      if (Number.isNaN(limit)) return true;
      return Number(row.price) <= limit;
    }
    case "minprice": {
      const limit = Number(value);
      if (Number.isNaN(limit)) return true;
      return Number(row.price) >= limit;
    }
    case "maxweight": {
      const limit = Number(value);
      if (Number.isNaN(limit)) return true;
      return row.weight_kg !== null && Number(row.weight_kg) <= limit;
    }
    case "minweight": {
      const limit = Number(value);
      if (Number.isNaN(limit)) return true;
      return row.weight_kg !== null && Number(row.weight_kg) >= limit;
    }
    case "weight": {
      const target = Number(value);
      if (Number.isNaN(target)) return true;
      if (row.weight_kg === null) return false;
      return Math.abs(Number(row.weight_kg) - target) <= 0.05;
    }
    default:
      return rowText(row).includes(`${token.key}:${value}`);
  }
}

function filterRows(query) {
  const tokens = tokenizeQuery(query);
  if (!tokens.length) {
    return [...allRows];
  }

  return allRows.filter((row) => tokens.every((token) => matchToken(row, token)));
}

function renderRows(rows) {
  if (!rows.length) {
    resultsBodyEl.innerHTML = '<tr><td colspan="10">No rows match the query string.</td></tr>';
    return;
  }

  const sorted = [...rows].sort((a, b) => {
    const ap = a.price_per_kg === null ? 1e9 : Number(a.price_per_kg);
    const bp = b.price_per_kg === null ? 1e9 : Number(b.price_per_kg);
    if (ap !== bp) return ap - bp;
    return Number(a.price) - Number(b.price);
  });

  resultsBodyEl.innerHTML = sorted
    .slice(0, 220)
    .map((row) => {
      const swatch = `<span class="swatch" style="display:inline-block;vertical-align:middle;margin-right:4px;background:${row.color_hex || "#475569"}"></span>`;
      const colorChips = (row.color_options || "")
        .split("|")
        .map((x) => x.trim())
        .filter(Boolean)
        .slice(0, 6)
        .map((c) => `<span class="chip">${c}</span>`)
        .join("");
      const specs = (row.spec_tags || "")
        .split("|")
        .map((x) => x.trim())
        .filter(Boolean)
        .slice(0, 6)
        .map((s) => `<span class="chip">${s}</span>`)
        .join("");

      return `
        <tr>
          <td>${row.material}</td>
          <td>${row.brand || "UNKNOWN"}</td>
          <td>${row.source || "-"}</td>
          <td>${swatch}${colorChips || (row.color || "-")}</td>
          <td>${specs || "-"}</td>
          <td>${fmt(row.price)} ${row.currency}</td>
          <td>${row.weight_kg === null ? "-" : fmt(row.weight_kg, 3)}</td>
          <td>${row.price_per_kg === null ? "-" : fmt(row.price_per_kg)}</td>
          <td>${row.title}</td>
          <td><a href="${row.product_url}" target="_blank" rel="noopener noreferrer">Open</a></td>
        </tr>
      `;
    })
    .join("");
}

function refreshFromQuery() {
  const query = queryFilterEl.value || "";
  const filtered = filterRows(query);
  renderRows(filtered);
  metaEl.textContent = `Rows: ${filtered.length} / ${allRows.length} | Query: ${query || "none"}`;
}

function setActiveTab(tab) {
  const dealsActive = tab === "deals";
  const storesActive = tab === "stores";
  const manageActive = tab === "manage";

  tabDealsEl.classList.toggle("active", dealsActive);
  tabStoresEl.classList.toggle("active", storesActive);
  tabManageEl.classList.toggle("active", manageActive);

  dealsPanelEl.classList.toggle("activeTabPanel", dealsActive);
  dealsPanelEl.classList.toggle("hiddenTabPanel", !dealsActive);
  storesPanelEl.classList.toggle("activeTabPanel", storesActive);
  storesPanelEl.classList.toggle("hiddenTabPanel", !storesActive);
  managePanelEl.classList.toggle("activeTabPanel", manageActive);
  managePanelEl.classList.toggle("hiddenTabPanel", !manageActive);
}

function wireEvents() {
  queryFilterEl.addEventListener("input", refreshFromQuery);
  clearQueryBtnEl.addEventListener("click", () => {
    queryFilterEl.value = "";
    refreshFromQuery();
    queryFilterEl.focus();
  });

  tabDealsEl.addEventListener("click", () => setActiveTab("deals"));
  tabStoresEl.addEventListener("click", () => setActiveTab("stores"));
  tabManageEl.addEventListener("click", () => setActiveTab("manage"));

  bambuConnectFormEl.addEventListener("submit", (event) => {
    event.preventDefault();
    if (HARDCODED_BAMBU_ACCOUNT.enabled) {
      updateBambuStatus();
      return;
    }

    const email = (bambuEmailEl.value || "").trim();
    if (!email) {
      bambuStatusEl.textContent = "Enter an email before connecting.";
      bambuStatusEl.classList.remove("connected");
      return;
    }

    bambuConnection = {
      connected: true,
      email,
      hasToken: Boolean((bambuTokenEl.value || "").trim()),
      connectedAt: new Date().toISOString(),
      provider: "manual",
    };
    safeSave(STATE_KEYS.bambu, bambuConnection);
    updateBambuStatus();
  });

  disconnectBambuBtnEl.addEventListener("click", () => {
    if (HARDCODED_BAMBU_ACCOUNT.enabled) {
      updateBambuStatus();
      return;
    }

    bambuConnection = {
      connected: false,
      email: "",
      hasToken: false,
      connectedAt: null,
      provider: "",
    };
    bambuEmailEl.value = "";
    bambuTokenEl.value = "";
    safeSave(STATE_KEYS.bambu, bambuConnection);
    updateBambuStatus();
  });

  inventoryFormEl.addEventListener("submit", (event) => {
    event.preventDefault();

    const startG = toPositiveNumber(invWeightEl.value);
    if (!startG) {
      return;
    }

    inventoryRecords.push({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      brand: (invBrandEl.value || "").trim(),
      material: (invMaterialEl.value || "").trim(),
      color: (invColorEl.value || "").trim(),
      startG,
      notes: (invNotesEl.value || "").trim(),
      createdAt: new Date().toISOString(),
    });

    safeSave(STATE_KEYS.inventory, inventoryRecords);
    renderManagementSummary();
    inventoryFormEl.reset();
  });

  historyFormEl.addEventListener("submit", (event) => {
    event.preventDefault();

    const usedG = toPositiveNumber(histUsedEl.value);
    if (!usedG) {
      return;
    }

    usageRecords.push({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      brand: (histBrandEl.value || "").trim(),
      material: (histMaterialEl.value || "").trim(),
      color: (histColorEl.value || "").trim(),
      usedG,
      printName: (histNameEl.value || "").trim(),
      printDate: histDateEl.value || null,
      createdAt: new Date().toISOString(),
    });

    safeSave(STATE_KEYS.usage, usageRecords);
    renderManagementSummary();
    historyFormEl.reset();
    setDefaultHistoryDate();
  });

  clearUsageBtnEl.addEventListener("click", () => {
    usageRecords = [];
    safeSave(STATE_KEYS.usage, usageRecords);
    renderManagementSummary();
  });

  clearInventoryBtnEl.addEventListener("click", () => {
    inventoryRecords = [];
    safeSave(STATE_KEYS.inventory, inventoryRecords);
    renderManagementSummary();
  });
}

async function loadData() {
  const response = await fetch(DATA_URL, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to load dashboard data (${response.status})`);
  }

  const payload = await response.json();
  allRows = payload.records || [];
  refreshFromQuery();
}

wireEvents();
loadManagementState();
updateBambuStatus();
setDefaultHistoryDate();
renderManagementSummary();
loadData().catch((err) => {
  resultsBodyEl.innerHTML = `<tr><td colspan="11">${err.message}</td></tr>`;
});
