import { getDb, json, err } from "../db.js";

export default async function handler(req) {
  const sql = getDb();
  const id = req.url.split("/").pop().split("?")[0];

  if (req.method === "DELETE") {
    await sql`DELETE FROM print_requests WHERE id = ${id}`;
    return json({ ok: true });
  }

  return err("Method not allowed", 405);
}
