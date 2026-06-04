import { useState, useEffect } from "react";
import { ShoppingBag, Package, Store, LogOut, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { DealsTable } from "./components/DealsTable.jsx";
import { MetricsBar } from "./components/MetricsBar.jsx";
import { StoreLinks } from "./components/StoreLinks.jsx";
import { FilamentManagement } from "./components/FilamentManagement.jsx";
import { PinGate, usePinGate } from "./components/PinGate.jsx";
import { cn } from "./lib/utils.js";

const TABS = [
  { id: "deals", label: "Deals", icon: ShoppingBag },
  { id: "stores", label: "Stores", icon: Store },
  { id: "manage", label: "Inventory", icon: Package },
];

export function AdminApp() {
  const { unlocked, unlock, lock } = usePinGate();
  const [tab, setTab] = useState("deals");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!unlocked) return;
    fetch("/data/amazon_filament_research.json", { cache: "no-store" })
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((p) => setRows(p.records || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [unlocked]);

  if (!unlocked) return <PinGate onUnlock={unlock} />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-slate-50 to-teal-50">
      <div className="max-w-screen-xl mx-auto px-4 py-6 pb-16">
        {/* Header */}
        <div className="backdrop-blur-sm bg-white/80 border border-white/60 rounded-2xl shadow-sm px-6 py-5 mb-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <Link to="/" className="p-2 rounded-lg text-slate-400 hover:text-teal-600 hover:bg-teal-50 transition-colors" title="Back to public site">
                <ArrowLeft size={16} />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-slate-800 tracking-tight">⚙️ Filament Intel — Admin</h1>
                <p className="text-sm text-slate-500 mt-0.5">
                  {loading ? "Loading…" : error ? `Error: ${error}` : `${rows.length} listings`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <nav className="flex gap-1 bg-slate-100 rounded-xl p-1">
                {TABS.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => setTab(id)}
                    className={cn(
                      "flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-all",
                      tab === id
                        ? "bg-white text-teal-700 shadow-sm"
                        : "text-slate-500 hover:text-slate-700",
                    )}
                  >
                    <Icon size={15} />
                    {label}
                  </button>
                ))}
              </nav>

              <button
                onClick={lock}
                className="p-2 rounded-lg text-slate-300 hover:text-red-400 hover:bg-red-50 transition-colors"
                title="Lock admin"
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </div>

        {tab === "deals" && !loading && !error && <MetricsBar rows={rows} />}

        <div className="mt-3">
          {tab === "deals" && <DealsTable rows={rows} loading={loading} />}
          {tab === "stores" && <StoreLinks />}
          {tab === "manage" && <FilamentManagement />}
        </div>
      </div>
    </div>
  );
}
