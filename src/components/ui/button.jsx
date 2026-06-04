import { cn } from "@/lib/utils";

const variants = {
  default: "bg-teal-700 text-white hover:bg-teal-800 shadow-sm",
  outline: "border border-teal-300 text-teal-700 bg-white hover:bg-teal-50",
  ghost: "text-teal-700 hover:bg-teal-50",
  destructive: "border border-red-200 text-red-600 bg-white hover:bg-red-50",
};

const sizes = {
  default: "h-9 px-4 py-2 text-sm",
  sm: "h-7 px-3 text-xs",
  lg: "h-11 px-6 text-base",
  icon: "h-9 w-9",
};

export function Button({ className, variant = "default", size = "default", ...props }) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 disabled:pointer-events-none disabled:opacity-50 cursor-pointer",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
}
