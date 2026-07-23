"use client";

import { useEffect } from "react";
import { SignIn, SignUp } from "@clerk/nextjs";
import { type UserRole, writeStoredUserRole } from "@/lib/user-role";

const authAppearance = {
  elements: {
    rootBox: "w-full",
    cardBox: "shadow-none border-0 w-full bg-transparent",
    card: "shadow-none border-0 p-0 bg-transparent",
    headerTitle: "hidden",
    headerSubtitle: "hidden",
    formFieldLabel: "text-[14px] font-normal text-slate-700 dark:text-slate-300",
    formFieldInput:
      "h-[48px] rounded-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-[15px] text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition-all",
    formButtonPrimary:
      "h-[48px] rounded-xl bg-cyan-500 hover:bg-cyan-400 text-[15px] font-normal shadow-lg shadow-cyan-500/25 transition-all text-white",
    socialButtonsBlockButton:
      "h-[48px] rounded-xl border-slate-200 dark:border-slate-800 text-[14px] font-normal text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors",
    dividerText: "text-[13px] text-slate-400",
    dividerLine: "bg-slate-200 dark:bg-slate-800",
    footer: "hidden",
    identityPreviewEditButton: "text-cyan-500",
    alternativeMethodsBlockButton: "text-[14px] text-cyan-500 hover:text-cyan-400 font-normal",
  },
};

export function ClerkAuthForm({
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

  if (mode === "sign-up") {
    return (
      <SignUp
        path={`/${locale}/sign-up`}
        routing="path"
        forceRedirectUrl={redirectPath}
        signInUrl={`/${locale}/sign-in`}
        appearance={authAppearance}
      />
    );
  }

  return (
    <SignIn
      path={`/${locale}/sign-in`}
      routing="path"
      forceRedirectUrl={redirectPath}
      signUpUrl={`/${locale}/sign-up`}
      appearance={authAppearance}
    />
  );
}
