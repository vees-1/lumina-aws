"use client";

import Image from "next/image";

export function LoadingScreen({ text }: { text?: string }) {
  return (
    <div className="flex min-h-[50vh] w-full flex-col items-center justify-center p-8 text-center">
      <div className="relative flex flex-col items-center">
        {/* Pulsing subtle glow backdrop */}
        <div className="absolute -inset-4 rounded-3xl bg-cyan-500/10 blur-xl animate-pulse" />

        {/* Official Brand Logo */}
        <div className="relative mb-6 h-16 w-auto max-w-[280px] sm:h-20 sm:max-w-[340px]">
          <Image
            src="/lumina-brand-logo.png"
            alt="Lumina Differential Diagnosis"
            width={340}
            height={185}
            className="h-full w-auto object-contain"
            priority
          />
        </div>

        {/* Loader bar */}
        <div className="h-1 w-32 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div className="h-full w-full bg-gradient-to-r from-[#0AAFCE] via-[#0D1B2A] to-[#0AAFCE] animate-[shimmer_1.5s_infinite] bg-[length:200%_100%]" />
        </div>

        {text && (
          <p className="mt-4 text-[13px] font-medium tracking-wide text-slate-500 dark:text-slate-400">
            {text}
          </p>
        )}
      </div>
    </div>
  );
}
