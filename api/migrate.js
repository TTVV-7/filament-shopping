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

  // Quote-request fields added with the service redesign. ADD COLUMN IF NOT
  // EXISTS keeps this safe against the production table, which already carries
  // some contact columns from an earlier deploy.
  await sql`ALTER TABLE print_requests ADD COLUMN IF NOT EXISTS customer_name  TEXT`;
  await sql`ALTER TABLE print_requests ADD COLUMN IF NOT EXISTS customer_email TEXT`;
  await sql`ALTER TABLE print_requests ADD COLUMN IF NOT EXISTS material       TEXT`;
  await sql`ALTER TABLE print_requests ADD COLUMN IF NOT EXISTS quality        TEXT`;
  await sql`ALTER TABLE print_requests ADD COLUMN IF NOT EXISTS quantity       INTEGER`;
  await sql`ALTER TABLE print_requests ADD COLUMN IF NOT EXISTS deadline       TEXT`;
  await sql`ALTER TABLE print_requests ADD COLUMN IF NOT EXISTS budget         TEXT`;
  await sql`ALTER TABLE print_requests ADD COLUMN IF NOT EXISTS details        TEXT`;
  await sql`ALTER TABLE print_requests ADD COLUMN IF NOT EXISTS status         TEXT DEFAULT 'new'`;
  await sql`ALTER TABLE print_requests ADD COLUMN IF NOT EXISTS files          TEXT`;

  return json({ ok: true, message: "All tables created" });
}

// These handlers use the Web fetch signature (Request in, Response out),
// which requires the edge runtime -- under the Node runtime the default
// export is called as (req, res) and a returned Response is ignored,
// leaving the request to hang until it times out.
export const config = { runtime: "edge" };
