import { cn } from "@/lib/utils";

export function Card({ className, ...props }) {
  return (
    <div
      className={cn("rounded-xl border border-slate-200 bg-white shadow-sm", className)}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }) {
  return <div className={cn("px-5 pt-5 pb-3", className)} {...props} />;
}

export function CardTitle({ className, ...props }) {
  return <h3 className={cn("font-semibold text-slate-800 leading-tight", className)} {...props} />;
}

export function CardContent({ className, ...props }) {
  return <div className={cn("px-5 pb-5", className)} {...props} />;
}
