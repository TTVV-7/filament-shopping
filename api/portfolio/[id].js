import { getDb, json, err } from "../db.js";

export default async function handler(req) {
  const sql = getDb();
  const id = req.url.split("/").pop().split("?")[0];

  if (req.method === "PUT") {
    const b = await req.json();
    await sql`
      UPDATE portfolio SET
        title = ${b.title},
        material = ${b.material},
        brand = ${b.brand},
        color = ${b.color},
        weight_g = ${b.weightG},
        price_per_kg = ${b.pricePerKg},
        hours = ${b.hours},
        rate_per_hr = ${b.ratePerHr},
        filament_cost = ${b.filamentCost},
        time_cost = ${b.timeCost},
        total_cost = ${b.totalCost},
        photo_data_url = ${b.photoDataUrl},
        timelapse_url = ${b.timelapseUrl},
        notes = ${b.notes}
      WHERE id = ${id}
    `;
    return json({ ok: true });
  }

  if (req.method === "DELETE") {
    await sql`DELETE FROM portfolio WHERE id = ${id}`;
    return json({ ok: true });
  }

  return err("Method not allowed", 405);
}
