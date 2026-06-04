import { getDb, json, err } from "./db.js";

export default async function handler(req) {
  const sql = getDb();

  if (req.method === "GET") {
    const rows = await sql`
      SELECT * FROM portfolio ORDER BY created_at DESC
    `;
    return json(rows);
  }

  if (req.method === "POST") {
    const b = await req.json();
    await sql`
      INSERT INTO portfolio (
        id, title, material, brand, color,
        weight_g, price_per_kg, hours, rate_per_hr,
        filament_cost, time_cost, total_cost,
        photo_data_url, timelapse_url, notes, created_at
      ) VALUES (
        ${b.id}, ${b.title}, ${b.material}, ${b.brand}, ${b.color},
        ${b.weightG}, ${b.pricePerKg}, ${b.hours}, ${b.ratePerHr},
        ${b.filamentCost}, ${b.timeCost}, ${b.totalCost},
        ${b.photoDataUrl}, ${b.timelapseUrl}, ${b.notes},
        ${b.createdAt}
      )
    `;
    return json({ ok: true });
  }

  return err("Method not allowed", 405);
}
