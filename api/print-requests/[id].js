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

// These handlers use the Web fetch signature (Request in, Response out),
// which requires the edge runtime -- under the Node runtime the default
// export is called as (req, res) and a returned Response is ignored,
// leaving the request to hang until it times out.
export const config = { runtime: "edge" };
