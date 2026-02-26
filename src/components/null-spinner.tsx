"use client";

interface NullSpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZES = { sm: "h-5 w-5", md: "h-8 w-8", lg: "h-10 w-10" } as const;

export default function NullSpinner({ size = "md", className = "" }: NullSpinnerProps) {
  return (
    <div
      className={`${SIZES[size]} animate-spin rounded-full border-2 border-neutral-200 border-t-neutral-900 ${className}`}
      aria-hidden
    />
  );
}

export function NullLoadingScreen({ label }: { label?: string }) {
  return (
    <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 py-16">
      <NullSpinner size="md" />
      {label ? <p className="text-xs text-neutral-400">{label}</p> : null}
    </div>
  );
}
