"use client";

import { useEffect } from "react";
import { type UserRole, writeStoredAuthSession, writeStoredUserRole } from "@/lib/user-role";

export function StaticAuthForm({
  mode,
  locale,
  role,
}: {
  mode: "sign-in" | "sign-up";
  locale: string;
  role: UserRole;
}) {
  useEffect(() => {
    writeStoredUserRole(role);
  }, [role]);

  const redirectPath = `/${locale}/${role === "patient" ? "patient" : "dashboard"}`;

  function continueWithLocalSession() {
    writeStoredUserRole(role);
    writeStoredAuthSession(true);
    window.location.assign(redirectPath);
  }

  return (
    <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <p className="text-[13px] leading-5 text-slate-500 dark:text-slate-400">
        Temporary static demo access. Cognito authentication replaces this in phase 3.
      </p>
      <button
        type="button"
        onClick={continueWithLocalSession}
        className="h-[48px] rounded-xl bg-cyan-500 text-[15px] font-normal text-white shadow-lg shadow-cyan-500/25 transition-all hover:bg-cyan-400"
      >
        {mode === "sign-up" ? "Continue to workspace" : "Continue"}
      </button>
    </div>
  );
}
