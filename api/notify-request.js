// Emails a new quote request to the shop owner via Resend.
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

  const summary = [b.material, b.quality, b.quantity ? `x${b.quantity}` : null]
    .filter(Boolean)
    .join(" / ");

  const html = `<div style="font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px">
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
    ${Array.isArray(b.files) && b.files.length ? `<p style="margin:18px 0 6px;color:#64748b;font-size:13px">Files</p>
    <ul style="margin:0;padding-left:18px;color:#0f172a;font-size:14px;line-height:1.7">
      ${b.files.map((f) => `<li><a href="${esc(f.url)}" style="color:#0d9488">${esc(f.name)}</a> <span style="color:#94a3b8">(${Math.round((f.size || 0) / 1024)} KB)</span></li>`).join("")}
    </ul>` : ""}
    ${b.details ? `<p style="margin:18px 0 6px;color:#64748b;font-size:13px">Details</p>
    <div style="white-space:pre-wrap;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px 14px;color:#0f172a;font-size:14px;line-height:1.5">${esc(b.details)}</div>` : ""}
    <p style="margin:20px 0 0;color:#94a3b8;font-size:12px">Request ${esc(b.id)} &middot; ${esc(b.submittedAt)}</p>
  </div>`;

  const res = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM,
      to: [TO],
      reply_to: b.email || undefined,
      subject: `New print request from ${b.name || "the store"}${summary ? ` (${summary})` : ""}`,
      html,
    }),
  });

  const text = await res.text();
  console.log(`Resend response: ${res.status} ${text}`);

  return new Response(JSON.stringify({ ok: res.ok }), {
    status: res.ok ? 200 : 502,
    headers: { "Content-Type": "application/json" },
  });
}

// These handlers use the Web fetch signature (Request in, Response out),
// which requires the edge runtime -- under the Node runtime the default
// export is called as (req, res) and a returned Response is ignored,
// leaving the request to hang until it times out.
export const config = { runtime: "edge" };
