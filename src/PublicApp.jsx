import { useState } from "react";
import { Printer, GalleryHorizontalEnd, Settings } from "lucide-react";
import { Link } from "react-router-dom";
import { PrintRequests } from "./components/PrintRequests.jsx";
import { Portfolio } from "./components/Portfolio.jsx";
import { BackgroundOrbs } from "./components/BackgroundOrbs.jsx";
import { cn } from "./lib/utils.js";

const TABS = [
  { id: "portfolio", label: "Portfolio", icon: GalleryHorizontalEnd },
  { id: "requests", label: "Print Requests", icon: Printer },
];

export function PublicApp() {
  const [tab, setTab] = useState("portfolio");

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-sky-100 relative">
      <BackgroundOrbs />
      <div className="relative max-w-screen-xl mx-auto px-4 py-6 pb-16" style={{ zIndex: 1 }}>
        {/* Header */}
        <div className="backdrop-blur-sm bg-white/75 border border-white/60 rounded-2xl shadow-sm px-6 py-5 mb-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <img src="/logo-circle.png" alt="MAP3D logo" className="w-12 h-12 rounded-full shadow-sm" />
              <div>
                <h1 className="text-2xl font-bold text-slate-800 tracking-tight">MAP3D</h1>
                <p className="text-sm text-slate-500 mt-0.5">Topographical Maps &amp; 3D Prints</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
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

              <Link
                to="/admin"
                className="p-2 rounded-lg text-slate-300 hover:text-slate-500 hover:bg-slate-100 transition-colors"
                title="Admin"
              >
                <Settings size={16} />
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-3">
          {tab === "portfolio" && <Portfolio />}
          {tab === "requests" && <PrintRequests />}
        </div>
      </div>
    </div>
  );
}
