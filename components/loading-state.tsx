"use client";

/**
 * previously, the app had at least 4 different loading patterns:
 *   - chick + "warming up the nest..." (auth/trips)
 *   - lock + "securing your nest..." (callback)
 *   - receipt + "pulling up the receipt..." (expense detail)
 *   - plain spinner (quick-split fetch, suspense fallbacks)
 *
 * the chick is nest's identity. inline spinners feel generic and break the
 * mood. this component owns the brand loading look, with size + emoji
 * variants for situations where a slightly different emoji makes sense
 * (lock during auth callback, receipt on expense pages).
 *
 * default usage:
 *   <LoadingState />
 *
 * with custom emoji + label:
 *   <LoadingState emoji="🔐" label="securing your nest..." />
 *
 * inline (small, no full-screen wrapper):
 *   <LoadingState size="sm" inline />
 */

interface LoadingStateProps {
  emoji?: string;
  label?: string | null;
  size?: "sm" | "md" | "lg";
  inline?: boolean;
  className?: string;
}

const sizeClasses = {
  sm: {
    wrapper: "w-7 h-7",
    border: "border-2",
    emoji: "text-xs",
    label: "text-[10px]",
  },
  md: {
    wrapper: "w-10 h-10",
    border: "border-3",
    emoji: "text-base",
    label: "text-xs",
  },
  lg: {
    wrapper: "w-16 h-16",
    border: "border-4",
    emoji: "text-xl",
    label: "text-sm",
  },
};

export default function LoadingState({
  emoji = "🐣",
  label = "warming up the nest...",
  size = "lg",
  inline = false,
  className = "",
}: LoadingStateProps) {
  const sizes = sizeClasses[size];

  const spinner = (
    <>
      <div
        className={`relative ${sizes.wrapper} flex items-center justify-center mx-auto ${label ? "mb-6" : ""}`}
      >
        <div
          className={`absolute inset-0 ${sizes.border} border-emerald-100 rounded-full`}
          aria-hidden="true"
        ></div>
        <div
          className={`absolute inset-0 ${sizes.border} border-emerald-500 border-t-transparent rounded-full animate-spin`}
          aria-hidden="true"
        ></div>
        <span className={`${sizes.emoji} animate-pulse`} aria-hidden="true">
          {emoji}
        </span>
      </div>
      {label && (
        <p
          className={`${sizes.label} text-stone-500 font-bold tracking-wide text-center`}
        >
          {label}
        </p>
      )}
    </>
  );

  if (inline) {
    return (
      <div
        className={`flex flex-col items-center ${className}`}
        role="status"
        aria-live="polite"
        aria-label={label || "loading"}
      >
        {spinner}
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col items-center justify-center ${className}`}
      role="status"
      aria-live="polite"
      aria-label={label || "loading"}
    >
      {spinner}
    </div>
  );
}

export function FullPageLoading({
  emoji,
  label,
}: Pick<LoadingStateProps, "emoji" | "label">) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-[#fdfbf7] selection:bg-emerald-200 selection:text-emerald-900">
      <LoadingState emoji={emoji} label={label} inline />
    </main>
  );
}
