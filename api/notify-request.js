// Emails a new quote request to the shop owner via Resend, with the rough
// price estimate the website works out from the customer's STL / 3MF files.
// (The customer's own confirmation is sent by the website, api/quote-confirm.js.)
//
// Rebuilt to match the live endpoint observed in production runtime logs
// ("POST /api/notify-request 200 -- Resend response: 200 {id:...}").
// Fire-and-forget from the client: a failure here must never lose the request,
// which is already persisted separately by /api/print-requests.

const RESEND_ENDPOINT = "https://api.resend.com/emails";

const TO = process.env.NOTIFY_TO || "thomas.verigin@gmail.com";
// Resend rejects unverified senders. onboarding@resend.dev works without a
// verified domain; override with a real address once the domain is set up.
const FROM = process.env.NOTIFY_FROM || "MAP3D <onboarding@resend.dev>";

const FONT = "font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif";

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function row(label, value) {
  if (value === null || value === undefined || value === "") return "";
  return `<tr>
    <td style="padding:6px 14px 6px 0;color:#64748b;font-size:13px;vertical-align:top;white-space:nowrap">${esc(label)}</td>
    <td style="padding:6px 0;color:#0f172a;font-size:14px">${esc(value)}</td>
  </tr>`;
}

// Only images we stored ourselves get embedded; anything else stays a link.
// The website keeps uploads private and serves them at
// printyours.ca/api/sticker-file; older ones are public Blob URLs.
function isOurImage(url) {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return false;
    if (u.hostname.endsWith(".public.blob.vercel-storage.com")) return true;
    return /^(www\.)?printyours\.ca$/.test(u.hostname) && u.pathname === "/api/sticker-file";
  } catch {
    return false;
  }
}

const isPhoto = (name) => /\.(jpe?g|png)$/i.test(name || "");

function pair(value) {
  if (!Array.isArray(value) || value.length !== 2) return null;
  const [low, high] = value.map(Number);
  return Number.isFinite(low) && Number.isFinite(high) ? [low, high] : null;
}

function money(value) {
  const p = pair(value);
  if (!p) return "";
  return p[0] === p[1] ? `$${p[0]}` : `$${p[0]}–$${p[1]}`;
}

// A single number or a [low, high] pair, with its unit.
function span(value, unit) {
  if (Number.isFinite(Number(value)) && !Array.isArray(value)) return `${Number(value)} ${unit}`;
  const p = pair(value);
  if (!p) return "";
  return p[0] === p[1] ? `${p[0]} ${unit}` : `${p[0]}–${p[1]} ${unit}`;
}

// One row per 3D model: preview, size, weight, time, price range.
function modelRow(file, quantity) {
  const e = file.estimate || {};
  const preview = isOurImage(file.previewUrl)
    ? `<img src="${esc(file.previewUrl)}" width="160" height="120" alt="" style="display:block;width:160px;height:120px;border-radius:8px;border:1px solid #e2e8f0">`
    : "";
  const name = file.url
    ? `<a href="${esc(file.url)}" style="color:#0d9488;font-weight:600">${esc(file.name)}</a>`
    : `<span style="font-weight:600">${esc(file.name)}</span>`;

  let body;
  if (e.error) {
    body = `<div style="color:#64748b;font-size:13px;margin-top:4px">${
      `Couldn't measure this file (${esc(e.error)}). Price it by hand.`
    }</div>`;
  } else {
    const size = Array.isArray(e.sizeMm) ? e.sizeMm.map(Number).join(" × ") + " mm" : "";
    const each = quantity > 1 && pair(e.each)
      ? ` <span style="color:#64748b;font-weight:400;font-size:13px">(${quantity} × ${esc(money(e.each))})</span>`
      : "";
    body = `<div style="color:#475569;font-size:13px;line-height:1.6;margin-top:4px">
        ${size ? `${esc(size)}<br>` : ""}${[span(e.grams, "g"), span(e.hours, "h of printing")].filter(Boolean).map(esc).join(" &middot; ")}
      </div>
      <div style="margin-top:6px;font-size:16px;font-weight:600;color:#0f172a">${esc(money(e.price))}${each}</div>
      ${e.tooBig ? `<div style="color:#b45309;font-size:12px;margin-top:4px">Bigger than the print bed, may need to be split into parts.</div>` : ""}`;
  }

  return `<tr>
    <td style="padding:10px 14px 10px 0;vertical-align:top;width:160px">${preview}</td>
    <td style="padding:10px 0;vertical-align:top;font-size:14px;color:#0f172a">${name}${body}</td>
  </tr>`;
}

function estimateSection(files, estimate, quantity) {
  const models = files.filter((f) => f && f.estimate);
  if (!models.length) return "";
  const total = estimate && pair(estimate.price)
    ? `<div style="margin-top:12px;background:#f0fdfa;border:1px solid #99f6e4;border-radius:10px;padding:12px 14px">
        <div style="font-size:13px;color:#0f766e">Rough total${estimate.partial ? " (measured files only)" : ""}</div>
        <div style="font-size:22px;font-weight:700;color:#0f172a">${esc(money(estimate.price))}</div>
        <div style="font-size:12px;color:#64748b;margin-top:2px">Automatic estimate from the files; orders start at $${esc(Number(estimate.minimumOrder) || 0)}. CAD, before tax and shipping.</div>
      </div>`
    : "";
  return `<p style="margin:18px 0 2px;color:#64748b;font-size:13px">Automatic estimate</p>
    <table style="border-collapse:collapse;width:100%">${models.map((f) => modelRow(f, quantity)).join("")}</table>
    ${total}`;
}

function ownerEmail(b) {
  const files = Array.isArray(b.files) ? b.files : [];
  const others = files.filter((f) => !f.estimate);
  const photos = others.filter((f) => isPhoto(f.name) && isOurImage(f.url));
  const links = others.filter((f) => !photos.includes(f));

  const summary = [b.material, b.quality, b.quantity ? `x${b.quantity}` : null]
    .filter(Boolean)
    .join(" / ");
  const totalText = b.estimate ? money(b.estimate.price) : "";

  const html = `<div style="${FONT};max-width:560px">
    <p style="margin:0 0 4px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#0d9488;font-weight:600">New quote request</p>
    <h2 style="margin:0 0 16px;font-size:20px;color:#0f172a">${esc(b.name || "Someone")}${summary ? ` &middot; <span style="font-weight:400;color:#475569">${esc(summary)}</span>` : ""}</h2>
    <table style="border-collapse:collapse;width:100%">
      ${row("Name", b.name)}
      ${row("Email", b.email)}
      ${row("Material", b.material)}
      ${row("Quality", b.quality)}
      ${row("Quantity", b.quantity)}
      ${row("Deadline", b.deadline)}
      ${row("Budget", b.budget)}
      ${row("Reference", b.url)}
    </table>
    ${estimateSection(files, b.estimate, Number(b.quantity) || 1)}
    ${photos.length ? `<p style="margin:18px 0 6px;color:#64748b;font-size:13px">Images</p>
    ${photos.map((f) => `<a href="${esc(f.url)}"><img src="${esc(f.url)}" alt="${esc(f.name)}" width="260" style="display:inline-block;width:260px;max-width:100%;border-radius:8px;border:1px solid #e2e8f0;margin:0 8px 8px 0"></a>`).join("")}` : ""}
    ${links.length ? `<p style="margin:18px 0 6px;color:#64748b;font-size:13px">${links.length < files.length ? "Other files" : "Files"}</p>
    <ul style="margin:0;padding-left:18px;color:#0f172a;font-size:14px;line-height:1.7">
      ${links.map((f) => `<li><a href="${esc(f.url)}" style="color:#0d9488">${esc(f.name)}</a> <span style="color:#94a3b8">(${Math.round((f.size || 0) / 1024)} KB)</span></li>`).join("")}
    </ul>` : ""}
    ${b.details ? `<p style="margin:18px 0 6px;color:#64748b;font-size:13px">Details</p>
    <div style="white-space:pre-wrap;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px 14px;color:#0f172a;font-size:14px;line-height:1.5">${esc(b.details)}</div>` : ""}
    <p style="margin:20px 0 0;color:#94a3b8;font-size:12px">Request ${esc(b.id)} &middot; ${esc(b.submittedAt)}</p>
  </div>`;

  return {
    from: FROM,
    to: [TO],
    reply_to: b.email || undefined,
    subject: `New print request from ${b.name || "the store"}${summary ? ` (${summary})` : ""}${totalText ? ` ~${totalText}` : ""}`,
    html,
  };
}

async function send(apiKey, payload, label) {
  const res = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  console.log(`Resend response (${label}): ${res.status} ${text}`);
  return res.ok;
}

export default async function handler(req) {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("notify-request: RESEND_API_KEY is not set");
    return new Response(JSON.stringify({ error: "Email not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const b = await req.json();

  const ok = await send(apiKey, ownerEmail(b), "owner");

  return new Response(JSON.stringify({ ok }), {
    status: ok ? 200 : 502,
    headers: { "Content-Type": "application/json" },
  });
}

// These handlers use the Web fetch signature (Request in, Response out),
// which requires the edge runtime -- under the Node runtime the default
// export is called as (req, res) and a returned Response is ignored,
// leaving the request to hang until it times out.
export const config = { runtime: "edge" };
