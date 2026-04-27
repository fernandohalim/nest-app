"use client";

interface NestLoaderProps {
  message?: string;
  size?: "sm" | "md" | "lg";
  fullScreen?: boolean;
}

export default function NestLoader({
  message = "warming up the nest...",
  size = "md",
  fullScreen = false,
}: NestLoaderProps) {
  const dims = {
    sm: { ring: "w-10 h-10", text: "text-xl", border: "border-3" },
    md: { ring: "w-16 h-16", text: "text-xl", border: "border-4" },
    lg: { ring: "w-20 h-20", text: "text-2xl", border: "border-4" },
  }[size];

  const inner = (
    <>
      <div
        role="status"
        aria-live="polite"
        aria-label={message}
        className={`relative ${dims.ring} flex items-center justify-center mx-auto mb-6`}
      >
        <div
          className={`absolute inset-0 ${dims.border} border-emerald-100 rounded-full`}
        ></div>
        <div
          className={`absolute inset-0 ${dims.border} border-emerald-500 border-t-transparent rounded-full animate-spin`}
        ></div>
        <span className={`${dims.text} animate-pulse`} aria-hidden="true">
          🐣
        </span>
      </div>
      <p className="text-sm text-stone-500 font-bold tracking-wide text-center">
        {message}
      </p>
    </>
  );

  if (fullScreen) {
    return (
      <div className="min-h-screen bg-[#fdfbf7] flex flex-col items-center justify-center p-6 selection:bg-emerald-200 selection:text-emerald-900">
        {inner}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-16">
      {inner}
    </div>
  );
}
