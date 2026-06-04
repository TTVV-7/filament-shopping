import { getDb, json, err } from "./db.js";

export default async function handler(req) {
  const sql = getDb();

  if (req.method === "GET") {
    const inventory = await sql`SELECT * FROM inventory ORDER BY created_at DESC`;
    const usage = await sql`SELECT * FROM usage_records ORDER BY created_at DESC`;
    return json({ inventory, usage });
  }

  if (req.method === "POST") {
    const b = await req.json();

    if (b.type === "spool") {
      await sql`
        INSERT INTO inventory (id, brand, material, color, start_g, notes, created_at)
        VALUES (${b.id}, ${b.brand}, ${b.material}, ${b.color}, ${b.startG}, ${b.notes}, ${b.createdAt})
      `;
    } else if (b.type === "usage") {
      await sql`
        INSERT INTO usage_records (id, brand, material, color, used_g, print_name, print_date, created_at)
        VALUES (${b.id}, ${b.brand}, ${b.material}, ${b.color}, ${b.usedG}, ${b.printName}, ${b.printDate || null}, ${b.createdAt})
      `;
    } else {
      return err("Unknown type", 400);
    }
    return json({ ok: true });
  }

  if (req.method === "DELETE") {
    const { searchParams } = new URL(req.url, "http://localhost");
    const type = searchParams.get("type");
    if (type === "usage") await sql`DELETE FROM usage_records`;
    else if (type === "inventory") { await sql`DELETE FROM inventory`; await sql`DELETE FROM usage_records`; }
    else return err("Unknown type", 400);
    return json({ ok: true });
  }

  return err("Method not allowed", 405);
}
