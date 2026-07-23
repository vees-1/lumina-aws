"use client";

import { useEffect } from "react";
import { type UserRole, writeStoredAuthSession, writeStoredUserRole } from "@/lib/user-role";
import { getCognitoAuthUrls, isCognitoConfigured } from "@/lib/cognito-auth";

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
  const cognitoConfigured = isCognitoConfigured();
  const { signInUrl, signUpUrl } = getCognitoAuthUrls();

  function continueWithCognito() {
    writeStoredUserRole(role);
    window.location.assign(mode === "sign-up" ? signUpUrl : signInUrl);
  }

  function continueWithLocalSession() {
    writeStoredUserRole(role);
    writeStoredAuthSession(true);
    window.location.assign(redirectPath);
  }

  return (
    <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      {cognitoConfigured ? (
        <>
          <p className="text-[13px] leading-5 text-slate-500 dark:text-slate-400">
            Sign in securely using Amazon Cognito Hosted UI.
          </p>
          <button
            type="button"
            onClick={continueWithCognito}
            className="h-[48px] rounded-xl bg-cyan-500 text-[15px] font-normal text-white shadow-lg shadow-cyan-500/25 transition-all hover:bg-cyan-400"
          >
            {mode === "sign-up" ? "Sign Up with Cognito" : "Sign In with Cognito"}
          </button>
          <div className="relative my-1 flex items-center justify-center">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200 dark:border-slate-800" /></div>
            <span className="relative bg-white px-2 text-[11px] text-slate-400 dark:bg-slate-950">OR LOCAL DEV</span>
          </div>
        </>
      ) : (
        <p className="text-[13px] leading-5 text-slate-500 dark:text-slate-400">
          Cognito Hosted UI is available when configured. Accessing local dev workspace:
        </p>
      )}
      <button
        type="button"
        onClick={continueWithLocalSession}
        className={cognitoConfigured ? "h-[40px] rounded-lg border border-slate-200 text-[13.5px] font-normal text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-900" : "h-[48px] rounded-xl bg-cyan-500 text-[15px] font-normal text-white shadow-lg shadow-cyan-500/25 transition-all hover:bg-cyan-400"}
      >
        {mode === "sign-up" ? "Continue to local workspace" : "Continue with local dev session"}
      </button>
    </div>
  );
}
