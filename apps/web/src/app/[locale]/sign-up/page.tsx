"use client";

import Link from "next/link";
import { Stethoscope, User } from "lucide-react";
import { Suspense } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { StaticAuthForm } from "@/components/auth/static-auth-form";
import { type UserRole } from "@/lib/user-role";

function Logo() {
  return (
    <span className="inline-flex items-center gap-2 select-none" aria-label="Lumina">
      <span className="text-[20px] font-normal tracking-tight leading-none text-slate-900 dark:text-white">Lumina</span>
    </span>
  );
}

function normalizeRole(role: unknown): UserRole | null {
  return role === "doctor" || role === "patient" ? role : null;
}

function SignUpContent() {
  const locale = useLocale();
  const searchParams = useSearchParams();
  const roleParam = searchParams.get("role");
  const role = normalizeRole(roleParam);
  const t = useTranslations("auth");
  const tc = useTranslations("common");

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background/95 backdrop-blur-sm sticky top-0 z-50">
        <nav className="mx-auto flex h-[72px] max-w-[1400px] items-center justify-between px-6 sm:px-8">
          <Link href={`/${locale}`}>
            <Logo />
          </Link>
          <div className="flex items-center gap-4 text-[14px] text-muted-foreground">
            <span>{t("alreadyHaveAccount")}</span>
            <Link href={`/${locale}/sign-in`} className="font-normal text-cyan-500 dark:text-cyan-400 transition-colors hover:text-cyan-600">
              {t("logIn")}
            </Link>
            <div className="h-4 w-[1px] bg-border mx-2" />
          </div>
        </nav>
      </header>

      <main className="mx-auto flex max-w-[1400px] flex-col lg:flex-row min-h-[calc(100vh-72px)]">
        <div className="flex w-full flex-col items-center justify-center p-6 sm:p-12">
          <div className="w-full max-w-[440px]">
            {!role ? (
              <div className="w-full">
                <p className="text-[12px] font-normal uppercase tracking-[0.16em] text-cyan-500">{t("beforeRegistration")}</p>
                <h2 className="mt-2 text-[28px] font-normal tracking-[-0.03em] text-slate-900 dark:text-white sm:text-[36px]">
                  {t("areYouADoctor")}
                </h2>
                <p className="mt-3 text-[15px] leading-6 text-slate-500 dark:text-slate-400">
                  {t("registrationRoleDesc", { brandName: tc("brandName") })}
                </p>

                <div className="mt-8 grid gap-4">
                  <Link
                    href={`/${locale}/sign-up?role=doctor`}
                    className="group flex items-start gap-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-5 text-left transition-all hover:border-cyan-400 hover:shadow-[0_8px_30px_rgba(34,211,238,0.15)]"
                  >
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-cyan-50 text-cyan-500 transition-colors group-hover:bg-cyan-500 group-hover:text-white dark:bg-cyan-950/30">
                      <Stethoscope className="h-6 w-6" />
                    </span>
                    <span>
                      <span className="block text-[17px] font-normal text-slate-900 dark:text-white">{t("yesIAmADoctor")}</span>
                      <span className="mt-1 block text-[13.5px] leading-5 text-slate-500 dark:text-slate-400">{t("doctorSignUpDesc")}</span>
                    </span>
                  </Link>

                  <Link
                    href={`/${locale}/sign-up?role=patient`}
                    className="group flex items-start gap-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-5 text-left transition-all hover:border-cyan-400 hover:shadow-[0_8px_30px_rgba(34,211,238,0.15)]"
                  >
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-50 dark:bg-slate-900 text-slate-400 transition-colors group-hover:bg-cyan-500 group-hover:text-white">
                      <User className="h-6 w-6" />
                    </span>
                    <span>
                      <span className="block text-[17px] font-normal text-slate-900 dark:text-white">{t("noIAmAPatient")}</span>
                      <span className="mt-1 block text-[13.5px] leading-5 text-slate-500 dark:text-slate-400">{t("patientSignUpDesc")}</span>
                    </span>
                  </Link>
                </div>
              </div>
            ) : (
              <div className="w-full">
                <div className="mb-8 flex items-center justify-between rounded-xl border border-cyan-100 dark:border-cyan-900/30 bg-cyan-50 dark:bg-cyan-950/20 px-4 py-3">
                  <p className="text-[14px] text-slate-600 dark:text-slate-300">
                    {t("registeringAs")} <span className="font-normal text-cyan-600 dark:text-cyan-400">{role === "doctor" ? t("doctor") : t("patient")}</span>
                  </p>
                  <Link href={`/${locale}/sign-up`} className="text-[13px] font-normal text-cyan-600 dark:text-cyan-400 transition-colors hover:text-cyan-500">
                    {t("changeRole")}
                  </Link>
                </div>
                <StaticAuthForm mode="sign-up" locale={locale} role={role} />
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default function SignUpPage() {
  return (
    <Suspense fallback={null}>
      <SignUpContent />
    </Suspense>
  );
}
