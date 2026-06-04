import { neon } from "@neondatabase/serverless";

let _sql = null;

export function getDb() {
  if (!_sql) _sql = neon(process.env.DATABASE_URL);
  return _sql;
}

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function err(message, status = 500) {
  return json({ error: message }, status);
}
