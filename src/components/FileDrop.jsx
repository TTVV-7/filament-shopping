import { useRef, useState } from "react";
import { UploadCloud, File as FileIcon, X, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils.js";

export const ACCEPTED = [
  ".stl", ".3mf", ".obj", ".step", ".stp", ".gcode", ".zip",
  ".jpg", ".jpeg", ".png", ".heic", ".pdf",
];

export const MAX_FILE_MB = 25;
export const MAX_FILES = 5;

export function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function extensionOf(name) {
  const i = name.lastIndexOf(".");
  return i === -1 ? "" : name.slice(i).toLowerCase();
}

export function FileDrop({ files, onChange, disabled }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [rejected, setRejected] = useState([]);

  function accept(incoming) {
    const problems = [];
    const next = [...files];

    for (const file of incoming) {
      if (next.length >= MAX_FILES) {
        problems.push(`${file.name} — limit is ${MAX_FILES} files`);
        continue;
      }
      if (!ACCEPTED.includes(extensionOf(file.name))) {
        problems.push(`${file.name} — unsupported file type`);
        continue;
      }
      if (file.size > MAX_FILE_MB * 1024 * 1024) {
        problems.push(`${file.name} — over ${MAX_FILE_MB} MB`);
        continue;
      }
      if (next.some((f) => f.name === file.name && f.size === file.size)) continue;
      next.push(file);
    }

    setRejected(problems);
    onChange(next);
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragging(false);
    if (disabled) return;
    accept(Array.from(e.dataTransfer.files || []));
  }

  return (
    <div className="space-y-2">
      <div
        onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => !disabled && inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (!disabled) inputRef.current?.click();
          }
        }}
        className={cn(
          "rounded-xl border-2 border-dashed px-4 py-7 text-center cursor-pointer transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500",
          dragging
            ? "border-teal-400 bg-teal-50/70"
            : "border-slate-200 bg-slate-50/60 hover:border-teal-300 hover:bg-teal-50/40",
          disabled && "opacity-50 pointer-events-none",
        )}
      >
        <UploadCloud size={22} className={cn("mx-auto mb-2", dragging ? "text-teal-600" : "text-slate-400")} />
        <p className="text-sm text-slate-600">
          <span className="font-medium text-teal-700">Choose files</span> or drag them here
        </p>
        <p className="text-xs text-slate-400 mt-1">
          STL, 3MF, STEP, OBJ, ZIP or photos · up to {MAX_FILE_MB} MB each
        </p>

        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPTED.join(",")}
          className="hidden"
          onChange={(e) => {
            accept(Array.from(e.target.files || []));
            e.target.value = "";
          }}
        />
      </div>

      {files.length > 0 && (
        <ul className="space-y-1.5">
          {files.map((file) => (
            <li
              key={`${file.name}-${file.size}`}
              className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-white px-3 py-2"
            >
              <FileIcon size={14} className="text-teal-600 flex-shrink-0" />
              <span className="text-sm text-slate-700 truncate flex-1">{file.name}</span>
              <span className="text-xs text-slate-400 flex-shrink-0">{formatSize(file.size)}</span>
              <button
                type="button"
                onClick={() => onChange(files.filter((f) => f !== file))}
                className="text-slate-300 hover:text-red-400 transition-colors flex-shrink-0"
                aria-label={`Remove ${file.name}`}
              >
                <X size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {rejected.length > 0 && (
        <ul className="space-y-1">
          {rejected.map((problem) => (
            <li key={problem} className="flex items-start gap-1.5 text-xs text-amber-700">
              <AlertCircle size={12} className="flex-shrink-0 mt-0.5" />
              {problem}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
