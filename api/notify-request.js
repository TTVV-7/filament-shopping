// Emails a new quote request to the shop owner via Resend, and sends the
// customer a confirmation with the rough price estimate.
//
// Rebuilt to match the live endpoint observed in production runtime logs
// ("POST /api/notify-request 200 -- Resend response: 200 {id:...}").
// Fire-and-forget from the client: a failure here must never lose the request,
// which is already persisted separately by /api/print-requests.
import { getDb } from "./db.js";

const RESEND_ENDPOINT = "https://api.resend.com/emails";

const TO = process.env.NOTIFY_TO || "thomas.verigin@gmail.com";
// Resend rejects unverified senders. onboarding@resend.dev works without a
// verified domain; override with a real address once the domain is set up.
// Customer confirmations need that: onboarding@resend.dev can only send to
// the Resend account's own address.
const FROM = process.env.NOTIFY_FROM || "MAP3D <onboarding@resend.dev>";
const BUSINESS = process.env.BUSINESS_NAME || "Print Yours";

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
function isOurImage(url) {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.hostname.endsWith(".public.blob.vercel-storage.com");
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

function span(value, unit) {
  const p = pair(value);
  if (!p) return "";
  return p[0] === p[1] ? `${p[0]} ${unit}` : `${p[0]}–${p[1]} ${unit}`;
}

// One row per 3D model: preview, size, weight, time, price range.
function modelRow(file, quantity, { forOwner }) {
  const e = file.estimate || {};
  const preview = isOurImage(file.previewUrl)
    ? `<img src="${esc(file.previewUrl)}" width="160" height="120" alt="" style="display:block;width:160px;height:120px;border-radius:8px;border:1px solid #e2e8f0">`
    : "";
  const name = forOwner && file.url
    ? `<a href="${esc(file.url)}" style="color:#0d9488;font-weight:600">${esc(file.name)}</a>`
    : `<span style="font-weight:600">${esc(file.name)}</span>`;

  let body;
  if (e.error) {
    body = `<div style="color:#64748b;font-size:13px;margin-top:4px">${
      forOwner ? `Couldn't measure this file (${esc(e.error)}). Price it by hand.` : "I'll price this one by hand."
    }</div>`;
  } else {
    const size = Array.isArray(e.sizeMm) ? e.sizeMm.map(Number).join(" × ") + " mm" : "";
    const each = quantity > 1 && pair(e.each)
      ? ` <span style="color:#64748b;font-weight:400;font-size:13px">(${quantity} × ${esc(money(e.each))})</span>`
      : "";
    body = `<div style="color:#475569;font-size:13px;line-height:1.6;margin-top:4px">
        ${size ? `${esc(size)}<br>` : ""}${esc(span(e.grams, "g"))} &middot; ${esc(span(e.hours, "h"))} of printing
      </div>
      <div style="margin-top:6px;font-size:16px;font-weight:600;color:#0f172a">${esc(money(e.price))}${each}</div>
      ${e.tooBig ? `<div style="color:#b45309;font-size:12px;margin-top:4px">Bigger than the print bed, may need to be split into parts.</div>` : ""}`;
  }

  return `<tr>
    <td style="padding:10px 14px 10px 0;vertical-align:top;width:160px">${preview}</td>
    <td style="padding:10px 0;vertical-align:top;font-size:14px;color:#0f172a">${name}${body}</td>
  </tr>`;
}

function estimateSection(files, estimate, quantity, { forOwner }) {
  const models = files.filter((f) => f && f.estimate);
  if (!models.length) return "";
  const total = estimate && pair(estimate.price)
    ? `<div style="margin-top:12px;background:#f0fdfa;border:1px solid #99f6e4;border-radius:10px;padding:12px 14px">
        <div style="font-size:13px;color:#0f766e">Rough total${estimate.partial ? " (measured files only)" : ""}</div>
        <div style="font-size:22px;font-weight:700;color:#0f172a">${esc(money(estimate.price))}</div>
        <div style="font-size:12px;color:#64748b;margin-top:2px">Includes a $${esc(Number(estimate.setupFee) || 0)} setup fee; orders start at $${esc(Number(estimate.minimumOrder) || 0)}. CAD, before tax and shipping.</div>
      </div>`
    : "";
  return `<p style="margin:18px 0 2px;color:#64748b;font-size:13px">${forOwner ? "Automatic estimate" : "Your parts"}</p>
    <table style="border-collapse:collapse;width:100%">${models.map((f) => modelRow(f, quantity, { forOwner })).join("")}</table>
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
    ${estimateSection(files, b.estimate, Number(b.quantity) || 1, { forOwner: true })}
    ${photos.length ? `<p style="margin:18px 0 6px;color:#64748b;font-size:13px">Photos</p>
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

function parseJson(text) {
  try {
    return typeof text === "string" ? JSON.parse(text) : text;
  } catch {
    return null;
  }
}

// Built from the saved row, not the request body, and sent at most once per
// request, so this endpoint can't be used to mail arbitrary content around.
function customerEmail(r) {
  const files = parseJson(r.files) || [];
  const estimate = parseJson(r.estimate);
  const firstName = String(r.customer_name || "").trim().split(/\s+/)[0].slice(0, 40);
  const ref = String(r.id).slice(0, 8).toUpperCase();
  const choices = [r.material, r.quality].filter(Boolean).join(", ");
  const section = estimateSection(files, estimate, Number(r.quantity) || 1, { forOwner: false });

  const html = `<div style="${FONT};max-width:560px;color:#0f172a">
    <p style="margin:0 0 4px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#0d9488;font-weight:600">${esc(BUSINESS)}</p>
    <h2 style="margin:0 0 12px;font-size:20px">Thanks${firstName ? ` ${esc(firstName)}` : ""}, I got your request</h2>
    <p style="margin:0;font-size:14px;line-height:1.6;color:#334155">
      I'll look it over and reply within one business day with a firm quote and a realistic turnaround.
    </p>
    ${section ? `${section}
    <p style="margin:14px 0 0;font-size:12px;line-height:1.6;color:#64748b">
      This is an automatic rough estimate worked out from the size of your files${choices ? ` (${esc(choices)})` : ""}.
      The final price can change once I've checked supports, finish and how the parts sit on the printer.
    </p>` : ""}
    <p style="margin:18px 0 0;font-size:14px;line-height:1.6;color:#334155">Questions or changes? Just reply to this email.</p>
    <p style="margin:20px 0 0;color:#94a3b8;font-size:12px">Ref ${esc(ref)}</p>
  </div>`;

  return {
    from: FROM,
    to: [r.customer_email],
    reply_to: TO,
    subject: `${BUSINESS}: request received (Ref ${ref})`,
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

// Claims the saved request for its one confirmation email. The id and email
// must match the row, and the flag means repeat calls send nothing.
async function claimForCustomer(b) {
  if (!b.id || !b.email) return null;
  try {
    const sql = getDb();
    const rows = await sql`
      UPDATE print_requests SET customer_notified_at = NOW()
      WHERE id = ${b.id} AND customer_email = ${b.email} AND customer_notified_at IS NULL
      RETURNING id, customer_name, customer_email, material, quality, quantity, files, estimate
    `;
    return rows[0] || null;
  } catch (error) {
    // Most likely the new columns don't exist yet: POST /api/migrate once.
    console.error("notify-request: customer confirmation skipped:", error.message);
    return null;
  }
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

  // The confirmation is a bonus: if it fails, the request and the owner
  // email above still stand.
  const saved = await claimForCustomer(b);
  if (saved) await send(apiKey, customerEmail(saved), "customer").catch(() => {});

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
