"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { DashboardNav } from "@/components/nav";
import { RoleGuard } from "@/components/lumina/role-guard";
import { getCaseSummaries, getCasesRemote, getPatientSubmissions, getPatientSubmissionsRemote, summarizeCases } from "@/lib/api";
import { useApiActor } from "@/lib/use-api-actor";
import type { CaseSummary, PatientSubmission } from "@/types/lumina";
import { FileText, Plus, ClipboardList, Users } from "lucide-react";

export default function DashboardPage() {
  const locale = useLocale();
  const t = useTranslations("doctorDashboard");
  const tCommon = useTranslations("common");
  const actor = useApiActor();
  const [fallbackCases] = useState<CaseSummary[]>(() => getCaseSummaries());
  const [fallbackSubmissions] = useState<PatientSubmission[]>(() => getPatientSubmissions());
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [submissions, setSubmissions] = useState<PatientSubmission[]>([]);
  useEffect(() => {
    if (!actor || actor.role !== "doctor") return;
    getCasesRemote(actor).then((items) => setCases(summarizeCases(items))).catch(() => setCases(fallbackCases));
    getPatientSubmissionsRemote(actor).then(setSubmissions).catch(() => setSubmissions(fallbackSubmissions));
  }, [actor]);
  const today = new Date().toDateString();
  const activeToday = cases.filter((item) => new Date(item.timestamp).toDateString() === today).length;
  const lettersReady = cases.filter((item) => item.status === "confirmed").length;
  const pendingQueue = submissions.filter((s) => s.status === "doctor_review_pending" || s.status === "needs_more_data").length;

  const stats = [
    { label: t("totalCases"), value: cases.length, icon: <ClipboardList className="h-4 w-4" /> },
    { label: t("activeToday"), value: activeToday, icon: <FileText className="h-4 w-4" /> },
    { label: t("patientSubmissions"), value: submissions.length, icon: <Users className="h-4 w-4" /> },
    { label: t("lettersReady"), value: lettersReady, icon: <FileText className="h-4 w-4" /> },
  ];

  const quickActions = [
    {
      title: t("quickActionCases"),
      text: t("quickActionCasesDesc"),
      href: `/${locale}/cases`,
      icon: <ClipboardList className="h-5 w-5 text-[#0AAFCE]" />,
    },
    {
      title: t("quickActionNewCase"),
      text: t("quickActionNewCaseDesc"),
      href: `/${locale}/new-case`,
      icon: <Plus className="h-5 w-5 text-[#0AAFCE]" />,
    },
    {
      title: t("quickActionScorecards"),
      text: t("quickActionScorecardsDesc"),
      href: `/${locale}/cases`,
      icon: <FileText className="h-5 w-5 text-[#0AAFCE]" />,
    },
  ];

  return (
    <RoleGuard allowed={["doctor"]} redirectTo="/patient">
      <div className="min-h-screen bg-[#F7F8FA] text-[#0D1B2A]">
        <DashboardNav />
        <main className="mx-auto max-w-[1200px] px-6 pb-24 pt-28">

          {/* Header */}
          <section className="grid items-center gap-10 lg:grid-cols-[1fr_auto]">
            <div>
              <p className="section-label mb-3">{t("title")}</p>
              <h1 className="text-[36px] font-normal leading-tight tracking-[-0.02em] sm:text-[42px]" dangerouslySetInnerHTML={{ __html: t("runWorkflow", { brandName: tCommon("brandName") }) }}></h1>
              <p className="mt-4 max-w-xl text-[15px] leading-7 text-[#4A5568]">
                {t("desc")}
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link
                  href={`/${locale}/new-case`}
                  className="inline-flex h-10 items-center rounded bg-[#0AAFCE] px-6 text-[13.5px] font-normal text-white transition-colors hover:bg-[#0997B3]"
                >
                  {t("startNewCase")}
                </Link>
                <Link
                  href={`/${locale}/cases`}
                  className="inline-flex h-10 items-center rounded border border-[#DDE3ED] bg-white px-6 text-[13.5px] font-normal text-[#0D1B2A] transition-colors hover:border-[#0D1B2A]"
                >
                  {t("viewCases")}
                </Link>
              </div>
            </div>

            {/* Stat cards */}
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              {stats.map((stat) => (
                <div key={stat.label} className="rounded border border-[#DDE3ED] bg-white p-5 shadow-[0_2px_8px_rgba(13,27,42,0.04)]">
                  <div className="mb-2 flex items-center gap-2 text-[#8A94A6]">
                    {stat.icon}
                    <p className="text-[11px] font-normal uppercase tracking-[0.08em]">{stat.label}</p>
                  </div>
                  <p className="text-[34px] font-normal tracking-[-0.04em] text-[#0D1B2A]">{stat.value}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Quick action cards */}
          <section className="mt-14 grid gap-4 lg:grid-cols-3">
            {quickActions.map((action) => (
              <Link
                key={action.title}
                href={action.href}
                className="group rounded border border-[#DDE3ED] bg-white p-6 transition-all hover:border-[#0AAFCE] hover:shadow-[0_6px_20px_rgba(10,175,206,0.10)]"
              >
                <div className="mb-4 flex h-9 w-9 items-center justify-center rounded bg-[#E5F8FC]">
                  {action.icon}
                </div>
                <h2 className="text-[18px] font-normal tracking-[-0.02em]">{action.title}</h2>
                <p className="mt-2 text-[13.5px] leading-6 text-[#4A5568]">{action.text}</p>
                <span className="mt-5 inline-flex items-center gap-1 text-[13px] font-normal text-[#0AAFCE]">
                  {t("open")}
                  <svg className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 16 16" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8h10m-4-4 4 4-4 4" />
                  </svg>
                </span>
              </Link>
            ))}
          </section>

          {/* Patient queue panel */}
          <section className="mt-8 rounded border border-[#DDE3ED] bg-white p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-[18px] font-normal tracking-[-0.02em]">{t("patientReviewQueue")}</h2>
                  {pendingQueue > 0 && (
                    <span className="badge badge-amber">
                      {pendingQueue} {t("pending")}
                    </span>
                  )}
                </div>
                <p className="mt-1.5 text-[13.5px] leading-6 text-[#4A5568]">
                  {t("queueDesc")}
                </p>
              </div>
              <Link
                href={`/${locale}/patient-queue`}
                className="shrink-0 inline-flex h-10 items-center rounded bg-[#0D1B2A] px-6 text-[13.5px] font-normal text-white transition-colors hover:bg-[#1C3352]"
              >
                {t("openQueue")}
              </Link>
            </div>
          </section>
        </main>
      </div>
    </RoleGuard>
  );
}
