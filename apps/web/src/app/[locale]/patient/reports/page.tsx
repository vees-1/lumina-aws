"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { DashboardNav } from "@/components/nav";
import {
  ReferralLetterSheet,
  downloadLetterPdf,
  printWithTitle,
  renderLetterSheetHtml,
  useDoctorLetterProfile,
} from "@/components/lumina/referral-letter-sheet";
import { RoleGuard } from "@/components/lumina/role-guard";
import { getPatientSubmissions, getPatientSubmissionsRemote } from "@/lib/api";
import { useApiActor } from "@/lib/use-api-actor";
import type { PatientSubmission } from "@/types/lumina";
import { Download, FileText, Printer } from "lucide-react";

export default function PatientReportsPage() {
  const locale = useLocale();
  const t = useTranslations("patientReports");
  const actor = useApiActor();
  const doctorProfile = useDoctorLetterProfile();
  const [fallbackReports] = useState<PatientSubmission[]>(() =>
    getPatientSubmissions().filter((item) => item.status === "released_to_patient")
  );
  const [reports, setReports] = useState<PatientSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!actor) return;
    getPatientSubmissionsRemote(actor)
      .then((items) => setReports(items.filter((item) => item.status === "released_to_patient")))
      .catch(() => setReports(fallbackReports))
      .finally(() => setLoading(false));
  }, [actor]);

  return (
    <RoleGuard allowed={["patient"]} redirectTo="/dashboard">
      <div className="min-h-screen bg-[#F7F8FA] text-[#0D1B2A]">
        <DashboardNav />
        <main className="mx-auto max-w-[1200px] px-6 pb-24 pt-28">
          <div className="mb-8">
            <p className="section-label mb-2">{t("title")}</p>
            <h1 className="text-[36px] font-normal tracking-[-0.03em]">{t("headline")}</h1>
            <p className="mt-1.5 max-w-2xl text-[14px] leading-6 text-[#4A5568]">{t("subtitle")}</p>
          </div>

          {loading ? (
            <div className="rounded-sm border border-[#DDE3ED] bg-white p-12 text-center shadow-[0_2px_8px_rgba(13,27,42,0.04)]">
              <p className="text-[14px] text-[#4A5568]">{t("loading")}</p>
            </div>
          ) : reports.length ? (
            <div className="grid gap-4">
              {reports.map((report) => (
                <div key={report.id} className="rounded-sm border border-[#DDE3ED] bg-white p-6 shadow-[0_2px_8px_rgba(13,27,42,0.04)]">
                  <div className="flex items-start gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm bg-[#EDFAF3]">
                      <FileText className="h-5 w-5 text-[#1A7F4B]" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h2 className="text-[16px] font-normal">{report.patientName ?? t("defaultReportName")}</h2>
                        <span className="badge badge-accepted">{t("statusApproved")}</span>
                      </div>
                      <p className="mt-1 text-[13px] text-[#8A94A6]">
                        {new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(report.timestamp))}
                      </p>
                      <div className="mt-4 rounded-sm border border-[#E7ECF3] bg-[#FBFCFE] p-4">
                        <p className="text-[13px] font-normal text-[#0D1B2A]">
                          {report.patientSummary?.headline ?? t("summaryHeadlineFallback")}
                        </p>
                        <p className="mt-2 text-[13px] leading-6 text-[#4A5568]">
                          {report.patientSummary?.recommended_next_step ?? report.patientSummary?.body ?? t("recommendedNextStepFallback")}
                        </p>
                        {report.patientSummary?.safety_note && report.patientSummary.safety_note.trim() && (
                          <p className="mt-2 text-[12px] leading-5 text-[#6B7280]">{report.patientSummary.safety_note}</p>
                        )}
                      </div>
                      {report.releasedLetterMarkdown && (
                        <div className="mt-5">
                          <div className="mb-3 flex flex-wrap items-center justify-between gap-3 print:hidden">
                            <h3 className="text-[12px] font-normal uppercase tracking-wider text-[#8A94A6]">
                              {t("referralLetter")}
                            </h3>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  printWithTitle(
                                    report.id,
                                    renderLetterSheetHtml({ letter: report.releasedLetterMarkdown ?? "", submission: report, doctorProfile }),
                                  )
                                }
                                className="inline-flex h-8 items-center gap-1.5 rounded-sm border border-[#DDE3ED] px-3 text-[12px] text-[#0D1B2A] hover:border-[#0AAFCE]"
                              >
                                <Printer className="h-3.5 w-3.5" />
                                {t("print")}
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  downloadLetterPdf(`${report.id}.pdf`, {
                                    letter: report.releasedLetterMarkdown ?? "",
                                    doctorProfile,
                                    submissionId: report.id,
                                  }).catch(() => toast.error(t("downloadFailed")))
                                }
                                className="inline-flex h-8 items-center gap-1.5 rounded-sm border border-[#DDE3ED] px-3 text-[12px] text-[#0D1B2A] hover:border-[#0AAFCE]"
                              >
                                <Download className="h-3.5 w-3.5" />
                                {t("downloadPdf")}
                              </button>
                            </div>
                          </div>
                          <ReferralLetterSheet letter={report.releasedLetterMarkdown} submission={report} doctorProfile={doctorProfile} />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-sm border border-[#DDE3ED] bg-white p-12 text-center shadow-[0_2px_8px_rgba(13,27,42,0.04)]">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-sm bg-[#F0F2F5]">
                <FileText className="h-6 w-6 text-[#8A94A6]" />
              </div>
              <h2 className="mt-4 text-[20px] font-normal">{t("noReports")}</h2>
              <p className="mx-auto mt-1.5 max-w-sm text-[14px] leading-6 text-[#4A5568]">
                {t("noReportsDesc")}
              </p>
              <Link
                href={`/${locale}/patient/new`}
                className="mt-6 inline-flex h-10 items-center rounded-none bg-[#0AAFCE] px-6 text-[13.5px] font-normal text-white transition-colors hover:bg-[#0997B3]"
              >
                {t("submitEvidence")}
              </Link>
            </div>
          )}
        </main>
      </div>
    </RoleGuard>
  );
}
