import { Settings, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { QuoteRequest } from "./components/QuoteRequest.jsx";
import { Portfolio } from "./components/Portfolio.jsx";
import { SpecStrip, HowItWorks } from "./components/ServiceInfo.jsx";
import { BackgroundOrbs } from "./components/BackgroundOrbs.jsx";

function Header() {
  return (
    <header className="backdrop-blur-sm bg-white/75 border border-white/60 rounded-2xl shadow-sm px-6 py-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <img src={`${import.meta.env.BASE_URL}logo-circle.png`} alt="" className="w-10 h-10 rounded-full shadow-sm" />
          <div>
            <p className="text-lg font-bold text-slate-800 tracking-tight leading-none">MAP3D</p>
            <p className="text-xs text-slate-500 mt-1">3D printing service · Vancouver</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <a
            href="#quote"
            className="hidden sm:inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-teal-700 text-white text-sm font-medium hover:bg-teal-800 transition-colors shadow-sm"
          >
            Request a quote
          </a>
          <Link
            to="/admin"
            className="p-2 rounded-lg text-slate-300 hover:text-slate-500 hover:bg-slate-100 transition-colors"
            title="Admin"
            aria-label="Admin"
          >
            <Settings size={16} />
          </Link>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="text-center px-4 py-10 sm:py-14">
      <h1 className="text-3xl sm:text-4xl font-bold text-slate-800 tracking-tight max-w-2xl mx-auto leading-tight">
        Custom 3D printing, from a one-off part to a small batch
      </h1>
      <p className="text-slate-500 mt-4 max-w-xl mx-auto leading-relaxed">
        Send a model or just describe what you need. I'll quote it, print it on
        calibrated hardware, and check every part before it ships — replacement
        parts, prototypes, topographic maps, and custom designs.
      </p>
      <a
        href="#quote"
        className="inline-flex items-center gap-2 mt-6 h-11 px-6 rounded-lg bg-teal-700 text-white font-medium hover:bg-teal-800 transition-colors shadow-sm"
      >
        Request a quote <ArrowRight size={16} />
      </a>
      <p className="text-xs text-slate-400 mt-3">Free quotes · Reply within one business day</p>
    </section>
  );
}

export function PublicApp() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-sky-100 relative">
      <BackgroundOrbs />

      <div className="relative max-w-4xl mx-auto px-4 py-6 pb-20 space-y-10" style={{ zIndex: 1 }}>
        <Header />
        <Hero />

        <SpecStrip />

        <HowItWorks />

        <section>
          <h2 className="text-sm font-semibold tracking-wide uppercase text-slate-400 mb-3">
            Start a request
          </h2>
          <QuoteRequest />
        </section>

        <section>
          <h2 className="text-sm font-semibold tracking-wide uppercase text-slate-400 mb-1">
            Recent work
          </h2>
          <p className="text-sm text-slate-500 mb-3">
            A sample of prints and topographic maps I've made.
          </p>
          <Portfolio readOnly />
        </section>

        <footer className="text-center text-xs text-slate-400 pt-4 border-t border-slate-200/70">
          MAP3D · 3D printing service · Vancouver, BC
        </footer>
      </div>
    </div>
  );
}
