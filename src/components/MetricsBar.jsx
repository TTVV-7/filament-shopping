import { TrendingDown, BarChart3, Package } from "lucide-react";
import { fmt } from "@/lib/utils";

const MATERIALS = ["PLA", "PETG", "TPU"];

const MATERIAL_COLORS = {
  PLA: "from-emerald-500 to-teal-600",
  PETG: "from-teal-500 to-cyan-600",
  TPU: "from-cyan-500 to-sky-600",
};

function computeStats(rows, material) {
  const subset = rows.filter((r) => r.material === material && r.price_per_kg !== null);
  if (!subset.length) return null;

  const ppkValues = subset.map((r) => Number(r.price_per_kg));
  const min = Math.min(...ppkValues);
  const avg = ppkValues.reduce((a, b) => a + b, 0) / ppkValues.length;
  const best = subset.find((r) => Number(r.price_per_kg) === min);

  return { min, avg, count: subset.length, best };
}

export function MetricsBar({ rows }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
      {MATERIALS.map((mat) => {
        const stats = computeStats(rows, mat);
        if (!stats) return null;

        return (
          <div
            key={mat}
            className="rounded-xl overflow-hidden border border-white/60 shadow-sm bg-white/80 backdrop-blur-sm"
          >
            <div className={`bg-gradient-to-r ${MATERIAL_COLORS[mat]} px-4 py-2.5 flex items-center justify-between`}>
              <span className="text-white font-bold text-sm tracking-wide">{mat}</span>
              <span className="text-white/80 text-xs">{stats.count} listings</span>
            </div>
            <div className="px-4 py-3 grid grid-cols-2 gap-3">
              <div>
                <div className="flex items-center gap-1 text-xs text-slate-500 mb-0.5">
                  <TrendingDown size={11} />
                  Best price
                </div>
                <div className="text-lg font-bold text-teal-700">
                  ${fmt(stats.min, 2)}
                  <span className="text-xs font-normal text-slate-500 ml-1">/kg</span>
                </div>
                {stats.best && (
                  <a
                    href={stats.best.product_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-teal-600 hover:underline truncate block max-w-[140px]"
                  >
                    {stats.best.brand || "View deal"} →
                  </a>
                )}
              </div>
              <div>
                <div className="flex items-center gap-1 text-xs text-slate-500 mb-0.5">
                  <BarChart3 size={11} />
                  Avg price
                </div>
                <div className="text-lg font-bold text-slate-600">
                  ${fmt(stats.avg, 2)}
                  <span className="text-xs font-normal text-slate-500 ml-1">/kg</span>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
