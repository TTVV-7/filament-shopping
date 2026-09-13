// The store is served under /3Dprintingstore via a Next.js rewrite, so every
// request must carry the prefix -- a bare /api/... would hit the parent site.
const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function req(url, options = {}) {
  const res = await fetch(API_BASE + url, {
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
  // Fire-and-forget: the request is already saved, so a failed email is logged
  // server-side rather than surfaced to the customer.
  notify: (entry) =>
    fetch(`${API_BASE}/api/notify-request`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entry),
    }).catch(() => {}),
};

// ── Inventory ──────────────────────────────────────────────────────────────
export const inventory = {
  list: () => req("/api/inventory"),
  addSpool: (spool) => req("/api/inventory", { method: "POST", body: JSON.stringify({ type: "spool", ...spool }) }),
  addUsage: (usage) => req("/api/inventory", { method: "POST", body: JSON.stringify({ type: "usage", ...usage }) }),
  clearUsage: () => req("/api/inventory?type=usage", { method: "DELETE" }),
  clearAll: () => req("/api/inventory?type=inventory", { method: "DELETE" }),
};
