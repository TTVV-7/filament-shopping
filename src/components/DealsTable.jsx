import { useState } from "react";
import { Search, X, Cpu, AlertCircle, ExternalLink } from "lucide-react";
import { Badge } from "./ui/badge.jsx";
import { Button } from "./ui/button.jsx";
import { Input } from "./ui/input.jsx";
import { fmt } from "@/lib/utils";

// Brands known to have Bambu AMS RFID chips
const AMS_CHIP_BRANDS = new Set(["BAMBU", "BAMBU LAB"]);

function AmsChipBadge({ brand }) {
  const upper = (brand || "").toUpperCase().trim();
  if (AMS_CHIP_BRANDS.has(upper)) {
    return (
      <Badge variant="success" className="gap-1 whitespace-nowrap">
        <Cpu size={10} /> AMS chip
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="gap-1 whitespace-nowrap">
      <AlertCircle size={10} /> Manual
    </Badge>
  );
}

function tokenizeQuery(query) {
  const tokens = [];
  for (const part of query.trim().split(/\s+/)) {
    if (!part) continue;
    const idx = part.indexOf(":");
    if (idx > 0) {
      tokens.push({ type: "kv", key: part.slice(0, idx).toLowerCase(), value: part.slice(idx + 1).toLowerCase() });
    } else {
      tokens.push({ type: "text", value: part.toLowerCase() });
    }
  }
  return tokens;
}

function rowMatchesToken(row, token) {
  const rowText = [row.material, row.brand, row.source, row.color, row.color_options, row.spec_tags, row.title]
    .join(" ")
    .toLowerCase();

  if (token.type === "text") return rowText.includes(token.value);

  const v = token.value;
  if (!v) return true;
  switch (token.key) {
    case "brand":     return (row.brand || "").toLowerCase().includes(v);
    case "material":  return (row.material || "").toLowerCase().includes(v);
    case "source":    return (row.source || "").toLowerCase().includes(v);
    case "color":     return ((row.color || "") + " " + (row.color_options || "")).toLowerCase().includes(v);
    case "spec":      return (row.spec_tags || "").toLowerCase().includes(v);
    case "maxppk":    return row.price_per_kg !== null && Number(row.price_per_kg) <= Number(v);
    case "minppk":    return row.price_per_kg !== null && Number(row.price_per_kg) >= Number(v);
    case "maxprice":  return Number(row.price) <= Number(v);
    case "minprice":  return Number(row.price) >= Number(v);
    case "weight":    return row.weight_kg !== null && Math.abs(Number(row.weight_kg) - Number(v)) <= 0.05;
    case "maxweight": return row.weight_kg !== null && Number(row.weight_kg) <= Number(v);
    case "minweight": return row.weight_kg !== null && Number(row.weight_kg) >= Number(v);
    default:          return rowText.includes(`${token.key}:${v}`);
  }
}

const MATERIAL_PILLS = ["PLA", "PETG", "TPU"];

export function DealsTable({ rows, loading }) {
  const [query, setQuery] = useState("");

  function applyPill(mat) {
    const base = query.replace(/material:\S+/gi, "").trim();
    setQuery(base ? `${base} material:${mat}` : `material:${mat}`);
  }

  function clearMaterial() {
    setQuery(query.replace(/material:\S+/gi, "").trim());
  }

  const tokens = tokenizeQuery(query);
  const filtered = tokens.length
    ? rows.filter((r) => tokens.every((t) => rowMatchesToken(r, t)))
    : rows;

  const sorted = [...filtered].sort((a, b) => {
    const ap = a.price_per_kg === null ? 1e9 : Number(a.price_per_kg);
    const bp = b.price_per_kg === null ? 1e9 : Number(b.price_per_kg);
    return ap !== bp ? ap - bp : Number(a.price) - Number(b.price);
  });

  const activeMat = query.match(/material:(\S+)/i)?.[1]?.toUpperCase();

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-slate-200 shadow-sm">
      {/* Filter bar */}
      <div className="px-4 pt-4 pb-3 border-b border-slate-100 space-y-2">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="brand:jayo material:petg spec:high-speed maxppk:25"
              className="pl-8"
            />
          </div>
          {query && (
            <Button variant="outline" size="icon" onClick={() => setQuery("")}>
              <X size={14} />
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-slate-400">Quick filter:</span>
          {MATERIAL_PILLS.map((mat) => (
            <button
              key={mat}
              onClick={() => activeMat === mat ? clearMaterial() : applyPill(mat)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                activeMat === mat
                  ? "bg-teal-700 text-white border-teal-700"
                  : "bg-white text-teal-700 border-teal-300 hover:bg-teal-50"
              }`}
            >
              {mat}
            </button>
          ))}
          <span className="ml-auto text-xs text-slate-400">
            {loading ? "Loading…" : `${sorted.length} / ${rows.length} listings`}
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100">
              {["Material", "Brand", "AMS", "Colors", "Specs", "Price", "kg", "CAD/kg", "Title", ""].map((h) => (
                <th key={h} className="px-3 py-2.5 text-left text-xs font-medium text-slate-400 whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-slate-400">
                  Loading listings…
                </td>
              </tr>
            )}
            {!loading && sorted.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-slate-400">
                  No listings match your filter.
                </td>
              </tr>
            )}
            {!loading &&
              sorted.slice(0, 220).map((row) => {
                const colorChips = (row.color_options || "")
                  .split("|")
                  .map((x) => x.trim())
                  .filter(Boolean)
                  .slice(0, 5);
                const specChips = (row.spec_tags || "")
                  .split("|")
                  .map((x) => x.trim())
                  .filter(Boolean)
                  .slice(0, 4);

                return (
                  <tr
                    key={row.asin}
                    className="border-b border-slate-50 hover:bg-teal-50/40 transition-colors"
                  >
                    <td className="px-3 py-2.5">
                      <Badge variant="secondary" className="font-mono text-xs">
                        {row.material}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5 font-medium text-slate-700 whitespace-nowrap">
                      {row.brand || "—"}
                    </td>
                    <td className="px-3 py-2.5">
                      <AmsChipBadge brand={row.brand} />
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1 flex-wrap">
                        <span
                          className="w-3.5 h-3.5 rounded-full border border-black/10 flex-shrink-0"
                          style={{ background: row.color_hex || "#94a3b8" }}
                        />
                        {colorChips.map((c) => (
                          <span
                            key={c}
                            className="px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs"
                          >
                            {c}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {specChips.map((s) => (
                          <span
                            key={s}
                            className="px-1.5 py-0.5 rounded-full bg-teal-50 text-teal-700 text-xs border border-teal-100"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap font-medium">
                      ${fmt(row.price)}{" "}
                      <span className="text-xs text-slate-400">{row.currency}</span>
                    </td>
                    <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">
                      {row.weight_kg === null ? "—" : fmt(row.weight_kg, 2)}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {row.price_per_kg === null ? (
                        "—"
                      ) : (
                        <span className="font-semibold text-teal-700">
                          ${fmt(row.price_per_kg)}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-slate-600 max-w-[220px]">
                      <span className="line-clamp-2 text-xs leading-relaxed">{row.title}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <a
                        href={row.product_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-teal-600 hover:text-teal-800 transition-colors"
                      >
                        <ExternalLink size={14} />
                      </a>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
