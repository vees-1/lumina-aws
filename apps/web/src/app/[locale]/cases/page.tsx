"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { DashboardNav } from "@/components/nav";
import { RoleGuard } from "@/components/lumina/role-guard";
import {
  deleteCaseFromStorage,
  deleteCaseRemote,
  exportAllCases,
  getCaseSummaries,
  getCasesRemote,
  summarizeCases,
} from "@/lib/api";
import { useApiActor } from "@/lib/use-api-actor";
import { formatDateTime, formatNumber } from "@/lib/formatters";
import type { CaseSummary } from "@/types/lumina";
import { Download, Plus, ClipboardList, Search, Trash2 } from "lucide-react";

function confidenceColor(pct: number) {
  if (pct >= 70) return "bg-[#1A7F4B]";
  if (pct >= 40) return "bg-[#D4860A]";
  return "bg-[#C0392B]";
}

export default function CasesPage() {
  const locale = useLocale();
  const t = useTranslations("casesPage");
  const actor = useApiActor();
  const [fallbackCases] = useState<CaseSummary[]>(() => getCaseSummaries());
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!actor || actor.role !== "doctor") return;
    getCasesRemote(actor)
      .then((items) => setCases(summarizeCases(items)))
      .catch(() => {
        setCases(fallbackCases);
        toast.error(t("loadFailed"));
      })
      .finally(() => setLoading(false));
  }, [actor]);

  const normalizedQuery = query.trim().toLowerCase();
  const filteredCases = cases.filter((item) => {
    if (!normalizedQuery) return true;
    const dateText = new Date(item.timestamp).toLocaleDateString(locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
    return [
      item.id,
      item.patientName,
      item.topDiagnosis,
      dateText,
    ]
      .filter(Boolean)
      .some((value) => value!.toLowerCase().includes(normalizedQuery));
  });

  const pending = cases.filter((item) => item.status === "pending").length;
  const confirmed = cases.filter((item) => item.status === "confirmed").length;

  async function handleDelete(caseId: string) {
    if (!actor) return;
    if (!window.confirm(t("deleteConfirm"))) return;
    try {
      await deleteCaseRemote(caseId, actor);
      deleteCaseFromStorage(caseId);
      setCases((current) => current.filter((item) => item.id !== caseId));
      toast.success(t("deleteSuccess"));
    } catch {
      toast.error(t("deleteFailed"));
    }
  }

  return (
    <RoleGuard allowed={["doctor"]} redirectTo="/patient">
      <div className="min-h-screen bg-[#F7F8FA] text-[#0D1B2A]">
        <DashboardNav />
        <main className="mx-auto max-w-[1200px] px-6 pb-24 pt-28">

          {/* Header */}
          <div className="mb-8 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="section-label mb-2">{t("cases")}</p>
              <h1 className="text-[36px] font-normal tracking-[-0.03em]">{t("myCases")}</h1>
              <p className="mt-1.5 text-[14px] text-[#4A5568]">{t("desc")}</p>
            </div>
            <div className="flex flex-wrap gap-2.5">
              <button
                type="button"
                onClick={exportAllCases}
                className="inline-flex h-10 items-center gap-2 rounded-none border border-[#DDE3ED] bg-white px-5 text-[13px] font-normal text-[#4A5568] transition-colors hover:border-[#0D1B2A] hover:text-[#0D1B2A]"
              >
                <Download className="h-3.5 w-3.5" />
                {t("exportAll")}
              </button>
              <Link
                href={`/${locale}/new-case`}
                className="inline-flex h-10 items-center gap-2 rounded-none bg-[#0AAFCE] px-5 text-[13px] font-normal text-white transition-colors hover:bg-[#0997B3]"
              >
                <Plus className="h-3.5 w-3.5" />
                {t("newCase")}
              </Link>
            </div>
          </div>

          {/* Summary metrics */}
          <div className="mb-6 grid gap-3 sm:grid-cols-3">
            {[
              { label: t("totalCases"), value: cases.length },
              { label: t("statusPending"), value: pending },
              { label: t("confirmed"), value: confirmed },
            ].map((m) => (
              <div key={m.label} className="rounded-sm border border-[#DDE3ED] bg-white p-5 shadow-[0_2px_8px_rgba(13,27,42,0.04)]">
                <p className="text-[30px] font-normal tracking-[-0.04em] text-[#0D1B2A]">{formatNumber(locale, m.value)}</p>
                <p className="mt-0.5 text-[12.5px] font-normal text-[#8A94A6]">{m.label}</p>
              </div>
            ))}
          </div>

          <div className="mb-4 relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8A94A6]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("searchPlaceholder")}
              className="h-11 w-full rounded-sm border border-[#DDE3ED] bg-white pl-10 pr-3 text-[13.5px] text-[#0D1B2A] outline-none transition-colors focus:border-[#0AAFCE]"
            />
          </div>

          {/* Cases table */}
          <div className="overflow-hidden rounded-sm border border-[#DDE3ED] bg-white">
            {loading ? (
              <div className="p-10 text-center text-[14px] text-[#4A5568]">{t("loading")}</div>
            ) : filteredCases.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[780px] text-left">
                  <thead className="border-b border-[#DDE3ED] bg-[#F7F8FA]">
                    <tr>
                      {[t("caseId"), t("patient"), t("topResult"), t("confidence"), t("hpoCount"), t("updated"), t("actions")].map((h) => (
                        <th key={h} className="px-5 py-3 text-[11px] font-normal uppercase tracking-[0.08em] text-[#8A94A6]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F0F2F5]">
                    {filteredCases.map((item) => {
                      const pct = Math.round(item.confidence);
                      return (
                        <tr key={item.id} className="transition-colors hover:bg-[#F7F8FA]">
                          <td className="px-5 py-4">
                            <Link href={`/${locale}/case/${item.id}`} className="font-normal text-[#0AAFCE] hover:underline">
                              {item.id.slice(0, 8)}
                            </Link>
                          </td>
                          <td className="px-5 py-4 text-[13.5px] text-[#0D1B2A]">{item.patientName ?? t("unnamedPatient")}</td>
                          <td className="px-5 py-4 text-[13.5px] text-[#0D1B2A]">{item.topDiagnosis}</td>
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-2.5">
                              <div className="h-1.5 w-20 overflow-hidden rounded-none bg-[#F0F2F5]">
                                <div
                                  className={`h-full bar-fill ${confidenceColor(pct)}`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <span className="text-[12.5px] font-normal text-[#0D1B2A]">{formatNumber(locale, pct)}%</span>
                            </div>
                          </td>
                          <td className="px-5 py-4 text-[13.5px] text-[#0D1B2A]">{formatNumber(locale, item.hpoCount)}</td>
                          <td className="px-5 py-4 text-[12.5px] text-[#8A94A6]">
                            {formatDateTime(locale, item.timestamp, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                          </td>
                          <td className="px-5 py-4">
                            <button
                              type="button"
                              onClick={() => handleDelete(item.id)}
                              className="inline-flex items-center gap-1.5 rounded-sm border border-[#E7C5C5] px-3 py-1.5 text-[12px] text-[#B42318] transition-colors hover:border-[#B42318]"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              {t("delete")}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex flex-col items-center py-16 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-sm bg-[#F0F2F5]">
                  <ClipboardList className="h-6 w-6 text-[#8A94A6]" />
                </div>
                <h2 className="mt-4 text-[20px] font-normal">{cases.length ? t("noSearchResults") : t("noCases")}</h2>
                <p className="mt-1.5 text-[14px] text-[#4A5568]">{cases.length ? t("clearSearch") : t("emptyStateDesc")}</p>
                <Link
                  href={`/${locale}/new-case`}
                  className="mt-6 inline-flex h-10 items-center rounded-none bg-[#0AAFCE] px-6 text-[13.5px] font-normal text-white transition-colors hover:bg-[#0997B3]"
                >
                  {t("startFirst")}
                </Link>
              </div>
            )}
          </div>
        </main>
      </div>
    </RoleGuard>
  );
}
