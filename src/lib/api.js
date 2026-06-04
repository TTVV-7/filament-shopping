async function req(url, options = {}) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

// ── Portfolio ──────────────────────────────────────────────────────────────
export const portfolio = {
  list: () => req("/api/portfolio"),
  create: (entry) => req("/api/portfolio", { method: "POST", body: JSON.stringify(entry) }),
  update: (id, entry) => req(`/api/portfolio/${id}`, { method: "PUT", body: JSON.stringify(entry) }),
  remove: (id) => req(`/api/portfolio/${id}`, { method: "DELETE" }),
};

// ── Print Requests ─────────────────────────────────────────────────────────
export const printRequests = {
  list: () => req("/api/print-requests"),
  create: (entry) => req("/api/print-requests", { method: "POST", body: JSON.stringify(entry) }),
  remove: (id) => req(`/api/print-requests/${id}`, { method: "DELETE" }),
};

// ── Inventory ──────────────────────────────────────────────────────────────
export const inventory = {
  list: () => req("/api/inventory"),
  addSpool: (spool) => req("/api/inventory", { method: "POST", body: JSON.stringify({ type: "spool", ...spool }) }),
  addUsage: (usage) => req("/api/inventory", { method: "POST", body: JSON.stringify({ type: "usage", ...usage }) }),
  clearUsage: () => req("/api/inventory?type=usage", { method: "DELETE" }),
  clearAll: () => req("/api/inventory?type=inventory", { method: "DELETE" }),
};
