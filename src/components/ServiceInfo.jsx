import { Layers, Ruler, Clock, MapPin, MessageSquare, Receipt, PackageCheck } from "lucide-react";

// ---------------------------------------------------------------------------
// CONFIRM BEFORE LAUNCH — these are customer-facing claims, not decoration.
// Build volume assumes a Bambu Lab X1C / P1S (256 mm cube). Adjust turnaround
// and delivery to whatever you can actually commit to.
// ---------------------------------------------------------------------------
export const SPECS = [
  { icon: Layers, label: "Materials", value: "PLA, PETG, Nylon, TPU" },
  { icon: Ruler,  label: "Max size",  value: "256 × 256 × 256 mm" },
  { icon: Clock,  label: "Turnaround", value: "Most jobs in 3–5 days" },
  { icon: MapPin, label: "Delivery",  value: "Vancouver pickup or shipped" },
];

const STEPS = [
  {
    icon: MessageSquare,
    title: "Send your idea",
    body: "A link, an STL, a sketch, or just a description of the part. If you don't have a model yet, I can design one.",
  },
  {
    icon: Receipt,
    title: "Get a quote",
    body: "I reply within one business day with a fixed price, the material I'd recommend, and a realistic turnaround.",
  },
  {
    icon: PackageCheck,
    title: "Printed and delivered",
    body: "You approve, I print. Parts are cleaned up and checked before they go out — reprinted free if something's off.",
  },
];

export function SpecStrip() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-slate-200/70 rounded-xl overflow-hidden border border-slate-200/70">
      {SPECS.map(({ icon: Icon, label, value }) => (
        <div key={label} className="bg-white/80 backdrop-blur-sm px-4 py-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
            <Icon size={12} />
            {label}
          </div>
          <p className="text-sm font-semibold text-slate-700 leading-snug">{value}</p>
        </div>
      ))}
    </div>
  );
}

export function HowItWorks() {
  return (
    <section>
      <h2 className="text-sm font-semibold tracking-wide uppercase text-slate-400 mb-3">
        How it works
      </h2>
      <ol className="grid md:grid-cols-3 gap-3">
        {STEPS.map(({ icon: Icon, title, body }, i) => (
          <li
            key={title}
            className="relative bg-white/80 backdrop-blur-sm border border-slate-200 rounded-xl p-5 shadow-sm"
          >
            <span className="absolute top-4 right-4 text-2xl font-bold text-slate-100 select-none">
              {i + 1}
            </span>
            <Icon size={18} className="text-teal-600 mb-2.5" />
            <h3 className="font-semibold text-slate-800 text-sm mb-1">{title}</h3>
            <p className="text-sm text-slate-500 leading-relaxed">{body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
