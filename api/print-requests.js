import { getDb, json, err } from "./db.js";

// Columns that identify a customer. This endpoint has no authentication, so
// they are never returned over GET -- the full details go out by email instead.
const PRIVATE_COLUMNS = ["customer_name", "customer_email", "details", "budget", "files"];

function redact(row) {
  const out = { ...row };
  for (const col of PRIVATE_COLUMNS) delete out[col];
  return out;
}

export default async function handler(req) {
  const sql = getDb();

  if (req.method === "GET") {
    const rows = await sql`
      SELECT * FROM print_requests ORDER BY submitted_at DESC
    `;
    return json(rows.map(redact));
  }

  if (req.method === "POST") {
    const b = await req.json();

    if (!b.id) return err("Missing request id", 400);
    if (!b.name?.trim() || !b.email?.trim()) {
      return err("Name and email are required", 400);
    }

    await sql`
      INSERT INTO print_requests (
        id, mode, url, stl_name, title, thumbnail_url,
        customer_name, customer_email,
        material, quality, quantity, deadline, budget, details, files,
        weight_g, print_time_hrs,
        filament_cost, time_cost, total_cost, status, submitted_at
      ) VALUES (
        ${b.id}, ${b.mode}, ${b.url}, ${b.stlName}, ${b.title}, ${b.thumbnailUrl},
        ${b.name}, ${b.email},
        ${b.material}, ${b.quality}, ${b.quantity}, ${b.deadline}, ${b.budget}, ${b.details},
        ${b.files?.length ? JSON.stringify(b.files) : null},
        ${b.weightG}, ${b.printTimeHrs},
        ${b.filamentCost}, ${b.timeCost}, ${b.totalCost}, 'new', ${b.submittedAt}
      )
    `;
    return json({ ok: true });
  }

  return err("Method not allowed", 405);
}

// These handlers use the Web fetch signature (Request in, Response out),
// which requires the edge runtime -- under the Node runtime the default
// export is called as (req, res) and a returned Response is ignored,
// leaving the request to hang until it times out.
export const config = { runtime: "edge" };
