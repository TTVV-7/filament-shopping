import { cn } from "@/lib/utils";

const variants = {
  default: "bg-teal-100 text-teal-800 border-teal-200",
  secondary: "bg-slate-100 text-slate-700 border-slate-200",
  success: "bg-emerald-100 text-emerald-800 border-emerald-200",
  warning: "bg-amber-100 text-amber-800 border-amber-200",
  destructive: "bg-red-100 text-red-700 border-red-200",
};

export function Badge({ className, variant = "default", ...props }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
