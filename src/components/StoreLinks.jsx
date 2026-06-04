import { ExternalLink } from "lucide-react";

const STORES = [
  { name: "Amazon Canada", meta: "Search filament deals", href: "https://www.amazon.ca/s?k=pla+filament+1.75mm" },
  { name: "Bambu Lab", meta: "Bulk-sale collection", href: "https://ca.store.bambulab.com/collections/bambu-lab-3d-printer-filament" },
  { name: "Overture", meta: "Brand storefront", href: "https://overture3d.com/collections/filaments" },
  { name: "Creality", meta: "Official store", href: "https://store.creality.com/collections/filament" },
  { name: "Prusa / Prusament", meta: "Direct filament shop", href: "https://www.prusa3d.com/category/prusament/" },
];

export function StoreLinks() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {STORES.map((store) => (
        <a
          key={store.name}
          href={store.href}
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white/80 backdrop-blur-sm p-4 shadow-sm hover:border-teal-300 hover:shadow-md transition-all"
        >
          <div>
            <p className="font-semibold text-slate-800 group-hover:text-teal-700 transition-colors">
              {store.name}
            </p>
            <p className="text-sm text-slate-400 mt-0.5">{store.meta}</p>
          </div>
          <ExternalLink size={16} className="text-slate-300 group-hover:text-teal-500 transition-colors flex-shrink-0 mt-0.5" />
        </a>
      ))}
    </div>
  );
}
