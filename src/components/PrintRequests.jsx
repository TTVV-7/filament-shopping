import { useState, useEffect } from "react";
import { Printer, Trash2, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "./ui/button.jsx";
import { Input } from "./ui/input.jsx";
import { Card, CardHeader, CardTitle, CardContent } from "./ui/card.jsx";
import { printRequests as api } from "@/lib/api.js";
import { cn } from "@/lib/utils.js";

export function PrintRequests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.list()
      .then((rows) => setRequests(rows.map((r) => ({
        id: r.id,
        url: r.url,
        title: r.title,
        thumbnailUrl: r.thumbnail_url,
        submittedAt: r.submitted_at,
      }))))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const canSubmit = url.trim() || description.trim();

  async function handleSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);

    const entry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      mode: url.trim() ? "url" : "description",
      url: url.trim() || null,
      stlName: null,
      title: description.trim() || url.trim(),
      thumbnailUrl: null,
      weightG: null,
      printTimeHrs: null,
      filamentCost: null,
      timeCost: null,
      totalCost: null,
      submittedAt: new Date().toISOString(),
    };

    // Try to send email notification if URL provided
    if (url.trim()) {
      fetch("/api/print-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entry),
      }).catch(() => {});
    }

    try {
      await api.create(entry);
      setRequests((prev) => [entry, ...prev]);
      setUrl("");
      setDescription("");
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  }

  async function removeRequest(id) {
    await api.remove(id).catch(console.error);
    setRequests((prev) => prev.filter((r) => r.id !== id));
  }

  async function clearAll() {
    await Promise.all(requests.map((r) => api.remove(r.id).catch(() => {})));
    setRequests([]);
  }

  return (
    <div className="space-y-4">
      {/* Submit form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Printer size={16} className="text-teal-600" /> New Print Request
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-3">
            <label className="text-sm text-slate-600 space-y-1 block">
              <span>Link <span className="text-slate-400 font-normal">(MakerWorld, Thingiverse, etc.)</span></span>
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://makerworld.com/en/models/…"
              />
            </label>

            <div className="flex items-center gap-3 text-xs text-slate-400">
              <div className="flex-1 border-t border-slate-100" />
              or
              <div className="flex-1 border-t border-slate-100" />
            </div>

            <label className="text-sm text-slate-600 space-y-1 block">
              <span>Description <span className="text-slate-400 font-normal">(what you want printed)</span></span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. A small wall hook for headphones, about 5cm wide…"
                rows={3}
                className={cn(
                  "flex w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm transition-colors",
                  "placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500",
                  "resize-none"
                )}
              />
            </label>

            <Button type="submit" disabled={!canSubmit || submitting} className="w-full">
              {submitting
                ? <><Loader2 size={15} className="animate-spin" /> Submitting…</>
                : <><Printer size={15} /> Submit Request</>}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Request log */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Requests</CardTitle>
            {requests.length > 0 && (
              <Button variant="destructive" size="sm" onClick={clearAll}>
                <Trash2 size={13} /> Clear all
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-slate-400 gap-2">
              <Loader2 size={16} className="animate-spin" /> Loading…
            </div>
          ) : requests.length === 0 ? (
            <p className="text-center py-10 text-sm text-slate-400">No requests yet.</p>
          ) : (
            <ul className="divide-y divide-slate-50">
              {requests.map((req) => (
                <li key={req.id} className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50 transition-colors">
                  {req.thumbnailUrl && (
                    <img src={req.thumbnailUrl} alt="" className="w-10 h-10 rounded-lg object-cover border border-slate-100 flex-shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-700 leading-snug">{req.title || "—"}</p>
                    {req.url && (
                      <a href={req.url} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-teal-600 hover:underline flex items-center gap-1 mt-0.5 truncate">
                        <ExternalLink size={10} /> {req.url}
                      </a>
                    )}
                    <p className="text-xs text-slate-300 mt-0.5">
                      {new Date(req.submittedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <button onClick={() => removeRequest(req.id)}
                    className="text-slate-300 hover:text-red-400 transition-colors flex-shrink-0 mt-0.5">
                    <Trash2 size={13} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
