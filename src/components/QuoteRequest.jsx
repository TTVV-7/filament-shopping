import { useState } from "react";
import { Printer, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "./ui/button.jsx";
import { Input } from "./ui/input.jsx";
import { Select } from "./ui/select.jsx";
import { Textarea } from "./ui/textarea.jsx";
import { Card, CardHeader, CardTitle, CardContent } from "./ui/card.jsx";
import { FileDrop } from "./FileDrop.jsx";
import { printRequests as api } from "@/lib/api.js";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const MATERIALS = [
  { value: "", label: "Not sure — recommend one" },
  { value: "PLA", label: "PLA — general purpose, best detail" },
  { value: "PETG", label: "PETG — tougher, water resistant" },
  { value: "Nylon", label: "Nylon — tough, high wear resistance" },
  { value: "TPU", label: "TPU — flexible" },
];

const QUALITIES = [
  { value: "", label: "Not sure — standard is fine" },
  { value: "Draft 0.28mm", label: "Draft — 0.28 mm, fastest" },
  { value: "Standard 0.20mm", label: "Standard — 0.20 mm" },
  { value: "Fine 0.12mm", label: "Fine — 0.12 mm, best finish" },
];

const EMPTY = {
  name: "", email: "", details: "", url: "",
  material: "", quality: "", quantity: "1", deadline: "", budget: "",
};

function Field({ label, required, hint, children }) {
  return (
    <label className="block space-y-1">
      <span className="text-sm text-slate-600">
        {label}
        {required && <span className="text-red-400"> *</span>}
        {hint && <span className="text-slate-400 font-normal"> {hint}</span>}
      </span>
      {children}
    </label>
  );
}

function Submitted({ entry, onReset }) {
  return (
    <div className="text-center py-6">
      <CheckCircle2 size={40} className="text-teal-600 mx-auto mb-3" />
      <h3 className="text-lg font-semibold text-slate-800">Request received</h3>
      <p className="text-sm text-slate-500 mt-1.5 max-w-sm mx-auto leading-relaxed">
        Thanks {entry.name.split(" ")[0]} — I've got the details and I'll reply to{" "}
        <span className="text-slate-700 font-medium">{entry.email}</span> within one
        business day with a quote and a realistic turnaround.
      </p>
      <p className="text-xs text-slate-400 mt-3">
        Reference {entry.id.slice(0, 8).toUpperCase()}
      </p>
      <Button variant="outline" className="mt-5" onClick={onReset}>
        Send another request
      </Button>
    </div>
  );
}

export function QuoteRequest() {
  const [form, setForm] = useState(EMPTY);
  const [files, setFiles] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState(null);
  const [submitted, setSubmitted] = useState(null);
  const [error, setError] = useState(null);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    let uploaded = [];
    try {
      // ~100 KB of client SDK, only needed when something is actually attached.
      const { upload } = files.length
        ? await import("@vercel/blob/client")
        : { upload: null };

      for (const [i, file] of files.entries()) {
        setProgress(`Uploading ${i + 1} of ${files.length} — ${file.name}`);
        const blob = await upload(`requests/${id}/${file.name}`, file, {
          access: "public",
          handleUploadUrl: `${API_BASE}/api/upload`,
        });
        uploaded.push({ name: file.name, size: file.size, url: blob.url });
      }
    } catch (uploadError) {
      setProgress(null);
      setSubmitting(false);
      setError(
        `Couldn't upload ${uploaded.length + 1 <= files.length ? files[uploaded.length].name : "your files"}. ` +
        "You can remove the file and send the request with a link instead.",
      );
      return;
    }

    setProgress(null);

    const entry = {
      id,
      mode: form.url.trim() ? "url" : "description",
      name: form.name.trim(),
      email: form.email.trim(),
      details: form.details.trim(),
      url: form.url.trim() || null,
      material: form.material || null,
      quality: form.quality || null,
      quantity: Number(form.quantity) || 1,
      deadline: form.deadline || null,
      budget: form.budget.trim() || null,
      files: uploaded,
      title: form.details.trim().slice(0, 120) || form.url.trim(),
      stlName: null,
      thumbnailUrl: null,
      weightG: null,
      printTimeHrs: null,
      filamentCost: null,
      timeCost: null,
      totalCost: null,
      submittedAt: new Date().toISOString(),
    };

    try {
      await api.create(entry);
      api.notify(entry); // fire-and-forget; request is already saved
      setSubmitted(entry);
      setForm(EMPTY);
      setFiles([]);
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setProgress(null);
      setSubmitting(false);
    }
  }

  return (
    <Card id="quote">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Printer size={16} className="text-teal-600" />
          {submitted ? "Request received" : "Request a quote"}
        </CardTitle>
        {!submitted && (
          <p className="text-sm text-slate-500 mt-1">
            Tell me what you need and I'll come back with a price and a timeline.
            No obligation.
          </p>
        )}
      </CardHeader>

      <CardContent>
        {submitted ? (
          <Submitted entry={submitted} onReset={() => setSubmitted(null)} />
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Name" required>
                <Input value={form.name} onChange={set("name")} placeholder="Your name" required />
              </Field>
              <Field label="Email" required>
                <Input type="email" value={form.email} onChange={set("email")} placeholder="you@example.com" required />
              </Field>
            </div>

            <Field label="What do you need printed?" required>
              <Textarea
                value={form.details}
                onChange={set("details")}
                rows={4}
                required
                placeholder="Describe the part, its rough size, and what it needs to do — e.g. a replacement bracket for a shelf, about 8 cm wide, needs to hold ~2 kg."
              />
            </Field>

            <Field label="Reference link" hint="(MakerWorld, Thingiverse, an STL, or a photo)">
              <Input
                type="url"
                value={form.url}
                onChange={set("url")}
                placeholder="https://makerworld.com/en/models/…"
              />
            </Field>

            <Field label="Files" hint="(STL, 3MF, STEP, or a photo of the part)">
              <FileDrop files={files} onChange={setFiles} disabled={submitting} />
            </Field>

            <div className="grid sm:grid-cols-3 gap-3">
              <Field label="Material">
                <Select value={form.material} onChange={set("material")}>
                  {MATERIALS.map((m) => <option key={m.label} value={m.value}>{m.label}</option>)}
                </Select>
              </Field>
              <Field label="Quality">
                <Select value={form.quality} onChange={set("quality")}>
                  {QUALITIES.map((q) => <option key={q.label} value={q.value}>{q.label}</option>)}
                </Select>
              </Field>
              <Field label="Quantity">
                <Input type="number" min="1" value={form.quantity} onChange={set("quantity")} />
              </Field>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Needed by" hint="(optional)">
                <Input type="date" value={form.deadline} onChange={set("deadline")} />
              </Field>
              <Field label="Budget" hint="(optional)">
                <Input value={form.budget} onChange={set("budget")} placeholder="e.g. under $40" />
              </Field>
            </div>

            {error && (
              <p className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
                {error}
              </p>
            )}

            <Button type="submit" size="lg" disabled={submitting} className="w-full">
              {submitting
                ? <><Loader2 size={16} className="animate-spin" /> {progress || "Sending…"}</>
                : <><Printer size={16} /> Request a quote</>}
            </Button>

            <p className="text-xs text-slate-400 text-center">
              Your details are only used to reply to this request.
            </p>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
