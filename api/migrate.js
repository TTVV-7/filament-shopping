import { getDb, json, err } from "./db.js";

export default async function handler(req) {
  if (req.method !== "POST") return err("Method not allowed", 405);

  const sql = getDb();

  await sql`
    CREATE TABLE IF NOT EXISTS portfolio (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      material TEXT,
      brand TEXT,
      color TEXT,
      weight_g NUMERIC,
      price_per_kg NUMERIC,
      hours NUMERIC,
      rate_per_hr NUMERIC,
      filament_cost NUMERIC,
      time_cost NUMERIC,
      total_cost NUMERIC,
      photo_data_url TEXT,
      timelapse_url TEXT,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS print_requests (
      id TEXT PRIMARY KEY,
      mode TEXT,
      url TEXT,
      stl_name TEXT,
      title TEXT,
      thumbnail_url TEXT,
      weight_g NUMERIC,
      print_time_hrs NUMERIC,
      filament_cost NUMERIC,
      time_cost NUMERIC,
      total_cost NUMERIC,
      submitted_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS inventory (
      id TEXT PRIMARY KEY,
      brand TEXT,
      material TEXT,
      color TEXT,
      start_g NUMERIC,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS usage_records (
      id TEXT PRIMARY KEY,
      brand TEXT,
      material TEXT,
      color TEXT,
      used_g NUMERIC,
      print_name TEXT,
      print_date DATE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  return json({ ok: true, message: "All tables created" });
}
