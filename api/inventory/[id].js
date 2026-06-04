import { getDb, json, err } from "../db.js";

export default async function handler(req) {
  const sql = getDb();
  const { searchParams } = new URL(req.url, "http://localhost");
  const id = req.url.split("/").pop().split("?")[0];
  const table = searchParams.get("table") || "inventory";

  if (req.method === "DELETE") {
    if (table === "usage") {
      await sql`DELETE FROM usage_records WHERE id = ${id}`;
    } else {
      await sql`DELETE FROM inventory WHERE id = ${id}`;
    }
    return json({ ok: true });
  }

  return err("Method not allowed", 405);
}
