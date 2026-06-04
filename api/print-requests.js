import { getDb, json, err } from "./db.js";

export default async function handler(req) {
  const sql = getDb();

  if (req.method === "GET") {
    const rows = await sql`
      SELECT * FROM print_requests ORDER BY submitted_at DESC
    `;
    return json(rows);
  }

  if (req.method === "POST") {
    const b = await req.json();
    await sql`
      INSERT INTO print_requests (
        id, mode, url, stl_name, title, thumbnail_url,
        weight_g, print_time_hrs,
        filament_cost, time_cost, total_cost, submitted_at
      ) VALUES (
        ${b.id}, ${b.mode}, ${b.url}, ${b.stlName}, ${b.title}, ${b.thumbnailUrl},
        ${b.weightG}, ${b.printTimeHrs},
        ${b.filamentCost}, ${b.timeCost}, ${b.totalCost},
        ${b.submittedAt}
      )
    `;
    return json({ ok: true });
  }

  return err("Method not allowed", 405);
}
