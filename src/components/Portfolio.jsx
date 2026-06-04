import { useState, useEffect } from "react";
import { Plus, Trash2, ExternalLink, Image, DollarSign, Pencil, Loader2 } from "lucide-react";
import { Button } from "./ui/button.jsx";
import { Input } from "./ui/input.jsx";
import { Card, CardHeader, CardTitle, CardContent } from "./ui/card.jsx";
import { Badge } from "./ui/badge.jsx";
import { compressImage } from "@/lib/storage.js";
import { portfolio as api } from "@/lib/api.js";
import { fmt } from "@/lib/utils.js";

const EMPTY_FORM = {
  title: "", material: "", brand: "", color: "",
  weightG: "", pricePerKg: "", hours: "", ratePerHr: "",
  timelapseUrl: "", notes: "",
};

function youtubeId(url) {
  const m = url.match(/(?:v=|youtu\.be\/|shorts\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

function YouTubeFacade({ url }) {
  const [playing, setPlaying] = useState(false);
  const id = youtubeId(url);
  if (!id) return null;

  if (playing) {
    return (
      <div className="mt-1 aspect-video rounded-lg overflow-hidden border border-slate-100">
        <iframe
          src={`https://www.youtube.com/embed/${id}?autoplay=1`}
          className="w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          title="timelapse"
        />
      </div>
    );
  }

  return (
    <button
      onClick={() => setPlaying(true)}
      className="mt-1 relative w-full aspect-video rounded-lg overflow-hidden border border-slate-100 group"
    >
      <img
        src={`https://img.youtube.com/vi/${id}/hqdefault.jpg`}
        alt="Timelapse thumbnail"
        className="w-full h-full object-cover"
      />
      <div className="absolute inset-0 bg-black/30 flex items-center justify-center group-hover:bg-black/40 transition-colors">
        <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
          <svg viewBox="0 0 24 24" className="w-5 h-5 text-teal-700 fill-current ml-0.5">
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
      </div>
    </button>
  );
}

function CostLine({ label, value }) {
  if (value == null) return null;
  return (
    <span className="text-xs text-slate-500">
      {label}: <strong className="text-slate-700">${fmt(value)}</strong>
    </span>
  );
}

// Map snake_case DB row → camelCase entry used by UI
function dbToEntry(row) {
  return {
    id: row.id,
    title: row.title,
    material: row.material,
    brand: row.brand,
    color: row.color,
    weightG: row.weight_g != null ? Number(row.weight_g) : null,
    pricePerKg: row.price_per_kg != null ? Number(row.price_per_kg) : null,
    hours: row.hours != null ? Number(row.hours) : null,
    ratePerHr: row.rate_per_hr != null ? Number(row.rate_per_hr) : null,
    filamentCost: row.filament_cost != null ? Number(row.filament_cost) : null,
    timeCost: row.time_cost != null ? Number(row.time_cost) : null,
    totalCost: row.total_cost != null ? Number(row.total_cost) : null,
    photoDataUrl: row.photo_data_url,
    timelapseUrl: row.timelapse_url,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

function entryToForm(entry) {
  return {
    title: entry.title || "",
    material: entry.material || "",
    brand: entry.brand || "",
    color: entry.color || "",
    weightG: entry.weightG != null ? String(entry.weightG) : "",
    pricePerKg: entry.pricePerKg != null ? String(entry.pricePerKg) : "",
    hours: entry.hours != null ? String(entry.hours) : "",
    ratePerHr: entry.ratePerHr != null ? String(entry.ratePerHr) : "",
    timelapseUrl: entry.timelapseUrl || "",
    notes: entry.notes || "",
  };
}

export function Portfolio() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [photoDataUrl, setPhotoDataUrl] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    api.list()
      .then((rows) => setEntries(rows.map(dbToEntry)))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  function setField(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  function openAdd() {
    setForm(EMPTY_FORM);
    setPhotoDataUrl(null);
    setEditingId(null);
    setFormOpen(true);
  }

  function openEdit(entry) {
    setForm(entryToForm(entry));
    setPhotoDataUrl(entry.photoDataUrl || null);
    setEditingId(entry.id);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setPhotoDataUrl(null);
  }

  async function handlePhoto(e) {
    const file = e.target.files[0];
    if (!file) return;
    setPhotoDataUrl(await compressImage(file));
  }

  function computeCosts() {
    const w = parseFloat(form.weightG);
    const p = parseFloat(form.pricePerKg);
    const h = parseFloat(form.hours);
    const r = parseFloat(form.ratePerHr);
    const filament = w > 0 && p > 0 ? (w / 1000) * p : null;
    const time = h > 0 && r > 0 ? h * r : null;
    const total = filament !== null || time !== null ? (filament || 0) + (time || 0) : null;
    return { filament, time, total };
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);
    const costs = computeCosts();
    const entry = {
      ...form,
      weightG: parseFloat(form.weightG) || null,
      pricePerKg: parseFloat(form.pricePerKg) || null,
      hours: parseFloat(form.hours) || null,
      ratePerHr: parseFloat(form.ratePerHr) || null,
      filamentCost: costs.filament,
      timeCost: costs.time,
      totalCost: costs.total,
      photoDataUrl,
    };

    try {
      if (editingId) {
        await api.update(editingId, entry);
        setEntries((prev) => prev.map((e) => e.id === editingId ? { ...e, ...entry } : e));
      } else {
        const newEntry = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, ...entry, createdAt: new Date().toISOString() };
        await api.create(newEntry);
        setEntries((prev) => [newEntry, ...prev]);
      }
      closeForm();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  async function removeEntry(id) {
    try {
      await api.remove(id);
      setEntries((prev) => prev.filter((e) => e.id !== id));
    } catch (err) {
      console.error(err);
    }
  }

  const costs = computeCosts();
  const isEditing = editingId !== null;

  return (
    <div className="space-y-4">
      {/* Form */}
      {formOpen ? (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{isEditing ? "Edit Print" : "Add Print to Portfolio"}</CardTitle>
              <Button variant="ghost" size="sm" onClick={closeForm}>Cancel</Button>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <label className="text-sm text-slate-600 space-y-1 block">
                <span>Print name <span className="text-red-400">*</span></span>
                <Input placeholder="Flexi dragon, cable clip, etc." value={form.title}
                  onChange={(e) => setField("title", e.target.value)} required />
              </label>

              <div className="grid grid-cols-3 gap-3">
                {[["Material", "material", "PLA"], ["Brand", "brand", "Bambu Lab"], ["Color", "color", "Black"]].map(([label, key, ph]) => (
                  <label key={key} className="text-sm text-slate-600 space-y-1">
                    <span>{label}</span>
                    <Input placeholder={ph} value={form[key]} onChange={(e) => setField(key, e.target.value)} />
                  </label>
                ))}
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Cost breakdown</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    ["Filament (g)", "weightG", "1", "42"],
                    ["Price / kg ($)", "pricePerKg", "0.5", "20"],
                    ["Print time (hrs)", "hours", "0.25", "2.5"],
                    ["Rate / hr ($)", "ratePerHr", "0.1", "2"],
                  ].map(([label, key, step, ph]) => (
                    <label key={key} className="text-sm text-slate-600 space-y-1">
                      <span>{label}</span>
                      <Input type="number" min="0" step={step} placeholder={ph}
                        value={form[key]} onChange={(e) => setField(key, e.target.value)} />
                    </label>
                  ))}
                </div>
                {costs.total !== null && (
                  <div className="flex items-center justify-between bg-white rounded-lg border border-slate-200 px-4 py-2.5">
                    <div className="flex gap-3">
                      <CostLine label="Filament" value={costs.filament} />
                      <CostLine label="Time" value={costs.time} />
                    </div>
                    <span className="text-lg font-bold text-teal-700">${fmt(costs.total)}</span>
                  </div>
                )}
              </div>

              {/* Photo */}
              <div className="space-y-2">
                <p className="text-sm text-slate-600">Photo</p>
                {photoDataUrl ? (
                  <div className="relative w-32">
                    <img src={photoDataUrl} alt="" className="w-32 h-32 object-cover rounded-xl border border-slate-200" />
                    <button type="button" onClick={() => setPhotoDataUrl(null)}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">×</button>
                  </div>
                ) : (
                  <label className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-dashed border-slate-300 cursor-pointer hover:border-teal-400 hover:bg-teal-50/30 transition-colors w-fit text-sm text-slate-500">
                    <Image size={14} /> {isEditing ? "Replace photo" : "Upload photo"}
                    <input type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
                  </label>
                )}
              </div>

              <label className="text-sm text-slate-600 space-y-1 block">
                <span>Timelapse video URL</span>
                <Input placeholder="https://youtu.be/… or any video link"
                  value={form.timelapseUrl} onChange={(e) => setField("timelapseUrl", e.target.value)} />
              </label>

              <label className="text-sm text-slate-600 space-y-1 block">
                <span>Notes</span>
                <Input placeholder="Settings, issues, next time…" value={form.notes} onChange={(e) => setField("notes", e.target.value)} />
              </label>

              <Button type="submit" className="w-full" disabled={!form.title.trim() || saving}>
                {saving ? <><Loader2 size={15} className="animate-spin" /> Saving…</> : isEditing ? <><Pencil size={15} /> Save changes</> : <><Plus size={15} /> Add to Portfolio</>}
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : (
        <div className="flex justify-end">
          <Button onClick={openAdd}><Plus size={15} /> Add Print</Button>
        </div>
      )}

      {/* Gallery */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-400 gap-2">
          <Loader2 size={18} className="animate-spin" /> Loading portfolio…
        </div>
      ) : entries.length === 0 && !formOpen ? (
        <div className="text-center py-16 text-slate-400">
          <Image size={40} className="mx-auto mb-3 text-slate-200" />
          <p className="font-medium text-slate-500">No prints yet</p>
          <p className="text-sm mt-1">Add your first completed print to start your portfolio.</p>
        </div>
      ) : !loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {entries.map((entry) => {
            const ytId = entry.timelapseUrl ? youtubeId(entry.timelapseUrl) : null;

            return (
              <Card key={entry.id} className="overflow-hidden flex flex-col">
                {entry.photoDataUrl ? (
                  <img src={entry.photoDataUrl} alt={entry.title}
                    className="w-full h-44 object-cover border-b border-slate-100" />
                ) : (
                  <div className="w-full h-44 bg-gradient-to-br from-teal-50 to-slate-100 flex items-center justify-center border-b border-slate-100">
                    <Image size={36} className="text-slate-300" />
                  </div>
                )}

                <div className="p-4 flex flex-col gap-2 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-slate-800 text-sm leading-snug">{entry.title}</h3>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={() => openEdit(entry)}
                        className="text-slate-300 hover:text-teal-500 transition-colors p-0.5">
                        <Pencil size={13} />
                      </button>
                      <button onClick={() => removeEntry(entry.id)}
                        className="text-slate-300 hover:text-red-400 transition-colors p-0.5">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1">
                    {entry.material && <Badge variant="secondary" className="font-mono text-xs">{entry.material}</Badge>}
                    {entry.brand && <Badge variant="default" className="text-xs">{entry.brand}</Badge>}
                    {entry.color && <span className="text-xs text-slate-400">{entry.color}</span>}
                  </div>

                  {entry.totalCost != null && (
                    <div className="flex items-center gap-2 text-xs text-slate-500 bg-teal-50 rounded-lg px-3 py-1.5">
                      <DollarSign size={11} className="text-teal-600" />
                      <CostLine label="Filament" value={entry.filamentCost} />
                      <CostLine label="Time" value={entry.timeCost} />
                      <span className="ml-auto font-bold text-teal-700 text-sm">${fmt(entry.totalCost)}</span>
                    </div>
                  )}

                  {entry.weightG && (
                    <p className="text-xs text-slate-400">{entry.weightG}g{entry.hours ? ` · ${entry.hours}h` : ""}</p>
                  )}

                  {entry.notes && <p className="text-xs text-slate-500 italic">{entry.notes}</p>}

                  {entry.timelapseUrl && (
                    ytId
                      ? <YouTubeFacade url={entry.timelapseUrl} />
                      : <a href={entry.timelapseUrl} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1.5 text-xs text-teal-600 hover:underline mt-auto">
                          <ExternalLink size={11} /> Watch timelapse
                        </a>
                  )}

                  <p className="text-xs text-slate-300 mt-auto pt-1">
                    {new Date(entry.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
