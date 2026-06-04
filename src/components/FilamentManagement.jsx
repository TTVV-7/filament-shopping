import { useState, useEffect } from "react";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { Button } from "./ui/button.jsx";
import { Input } from "./ui/input.jsx";
import { Card, CardHeader, CardTitle, CardContent } from "./ui/card.jsx";
import { Badge } from "./ui/badge.jsx";
import { inventory as api } from "@/lib/api.js";
import { fmt } from "@/lib/utils.js";

function makeKey(brand, material, color) {
  return [brand, material, color].map((v) => String(v || "").trim().toLowerCase()).join("|");
}

export function FilamentManagement() {
  const [inventory, setInventory] = useState([]);
  const [usage, setUsage] = useState([]);
  const [loadingInv, setLoadingInv] = useState(true);

  useEffect(() => {
    api.list()
      .then(({ inventory: inv, usage: usg }) => {
        setInventory(inv.map((r) => ({ id: r.id, brand: r.brand, material: r.material, color: r.color, startG: Number(r.start_g), notes: r.notes, createdAt: r.created_at })));
        setUsage(usg.map((r) => ({ id: r.id, brand: r.brand, material: r.material, color: r.color, usedG: Number(r.used_g), printName: r.print_name, printDate: r.print_date, createdAt: r.created_at })));
      })
      .catch(console.error)
      .finally(() => setLoadingInv(false));
  }, []);

  const [inv, setInv] = useState({ brand: "", material: "", color: "", startG: "", notes: "" });
  const [hist, setHist] = useState({
    brand: "", material: "", color: "", usedG: "",
    printName: "", printDate: new Date().toISOString().slice(0, 10),
  });

  async function addSpool(e) {
    e.preventDefault();
    const startG = parseFloat(inv.startG);
    if (!startG || startG <= 0) return;
    const spool = { id: `${Date.now()}`, ...inv, startG, createdAt: new Date().toISOString() };
    await api.addSpool(spool).catch(console.error);
    setInventory((prev) => [...prev, spool]);
    setInv({ brand: "", material: "", color: "", startG: "", notes: "" });
  }

  async function addUsage(e) {
    e.preventDefault();
    const usedG = parseFloat(hist.usedG);
    if (!usedG || usedG <= 0) return;
    const entry = { id: `${Date.now()}`, ...hist, usedG, createdAt: new Date().toISOString() };
    await api.addUsage(entry).catch(console.error);
    setUsage((prev) => [...prev, entry]);
    setHist({ brand: "", material: "", color: "", usedG: "", printName: "", printDate: new Date().toISOString().slice(0, 10) });
  }

  // Aggregate inventory + usage into summary rows
  const grouped = new Map();
  for (const spool of inventory) {
    const key = makeKey(spool.brand, spool.material, spool.color);
    if (!grouped.has(key)) {
      grouped.set(key, { brand: spool.brand || "Unknown", material: spool.material || "Unknown", color: spool.color || "Unknown", spools: 0, startG: 0, usedG: 0 });
    }
    const b = grouped.get(key);
    b.spools++;
    b.startG += Number(spool.startG) || 0;
  }
  for (const u of usage) {
    const key = makeKey(u.brand, u.material, u.color);
    if (grouped.has(key)) grouped.get(key).usedG += Number(u.usedG) || 0;
  }
  const summaryRows = [...grouped.values()].sort((a, b) => a.material.localeCompare(b.material) || a.brand.localeCompare(b.brand));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Add spool */}
        <Card>
          <CardHeader><CardTitle>Add Spool</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={addSpool} className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                {[["Brand", "brand", "Bambu Lab"], ["Material", "material", "PLA"], ["Color", "color", "Black"]].map(([label, key, ph]) => (
                  <label key={key} className="text-xs text-slate-500 space-y-1">
                    <span>{label}</span>
                    <Input placeholder={ph} value={inv[key]} onChange={(e) => setInv({ ...inv, [key]: e.target.value })} required />
                  </label>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs text-slate-500 space-y-1">
                  <span>Starting weight (g)</span>
                  <Input type="number" min="1" placeholder="1000" value={inv.startG} onChange={(e) => setInv({ ...inv, startG: e.target.value })} required />
                </label>
                <label className="text-xs text-slate-500 space-y-1">
                  <span>Notes</span>
                  <Input placeholder="AMS slot A1" value={inv.notes} onChange={(e) => setInv({ ...inv, notes: e.target.value })} />
                </label>
              </div>
              <Button type="submit" className="w-full" size="sm"><Plus size={14} /> Add Spool</Button>
            </form>
          </CardContent>
        </Card>

        {/* Add usage */}
        <Card>
          <CardHeader><CardTitle>Log Print Usage</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={addUsage} className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                {[["Brand", "brand", "Bambu Lab"], ["Material", "material", "PLA"], ["Color", "color", "Black"]].map(([label, key, ph]) => (
                  <label key={key} className="text-xs text-slate-500 space-y-1">
                    <span>{label}</span>
                    <Input placeholder={ph} value={hist[key]} onChange={(e) => setHist({ ...hist, [key]: e.target.value })} required />
                  </label>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-2">
                <label className="text-xs text-slate-500 space-y-1">
                  <span>Used (g)</span>
                  <Input type="number" min="1" placeholder="42" value={hist.usedG} onChange={(e) => setHist({ ...hist, usedG: e.target.value })} required />
                </label>
                <label className="text-xs text-slate-500 space-y-1">
                  <span>Print name</span>
                  <Input placeholder="Benchy" value={hist.printName} onChange={(e) => setHist({ ...hist, printName: e.target.value })} />
                </label>
                <label className="text-xs text-slate-500 space-y-1">
                  <span>Date</span>
                  <Input type="date" value={hist.printDate} onChange={(e) => setHist({ ...hist, printDate: e.target.value })} />
                </label>
              </div>
              <Button type="submit" className="w-full" size="sm"><Plus size={14} /> Add Entry</Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Summary table */}
      {loadingInv ? (
        <div className="flex items-center justify-center py-10 text-slate-400 gap-2">
          <Loader2 size={16} className="animate-spin" /> Loading inventory…
        </div>
      ) : summaryRows.length > 0 ? (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Inventory Summary</CardTitle>
              <Button variant="destructive" size="sm" onClick={async () => { await api.clearAll().catch(console.error); setInventory([]); setUsage([]); }}>
                <Trash2 size={13} /> Clear all
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    {["Brand", "Material", "Color", "Spools", "Start (g)", "Used (g)", "Remaining", "%"].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-slate-400">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {summaryRows.map((row) => {
                    const remaining = Math.max(row.startG - row.usedG, 0);
                    const pct = row.startG > 0 ? (remaining / row.startG) * 100 : 0;
                    const variant = pct > 50 ? "success" : pct > 20 ? "warning" : "destructive";
                    return (
                      <tr key={`${row.brand}|${row.material}|${row.color}`} className="border-b border-slate-50 hover:bg-slate-50">
                        <td className="px-4 py-2.5 font-medium">{row.brand}</td>
                        <td className="px-4 py-2.5"><Badge variant="secondary" className="font-mono text-xs">{row.material}</Badge></td>
                        <td className="px-4 py-2.5">{row.color}</td>
                        <td className="px-4 py-2.5 text-slate-500">{row.spools}</td>
                        <td className="px-4 py-2.5 text-slate-500">{fmt(row.startG, 0)}</td>
                        <td className="px-4 py-2.5 text-slate-500">{fmt(row.usedG, 0)}</td>
                        <td className="px-4 py-2.5 font-semibold">{fmt(remaining, 0)}g</td>
                        <td className="px-4 py-2.5"><Badge variant={variant}>{fmt(pct, 1)}%</Badge></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : !loadingInv && (
        <div className="text-center py-12 text-slate-400 text-sm">
          No spools added yet. Add your first spool above to start tracking.
        </div>
      )}
    </div>
  );
}
