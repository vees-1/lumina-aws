"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { DashboardNav } from "@/components/nav";
import { RoleGuard } from "@/components/lumina/role-guard";
import {
  deletePatientSubmissionRemote,
  getPatientSubmissionsRemote,
  requestMoreSubmissionData,
} from "@/lib/api";
import { useApiActor } from "@/lib/use-api-actor";
import type { PatientSubmission } from "@/types/lumina";
import { cn } from "@/lib/utils";
import { Inbox, MessageSquare, RefreshCw, Search, Trash2 } from "lucide-react";

export default function PatientQueuePage() {
  const locale = useLocale();
  const t = useTranslations("patientQueue");
  const actor = useApiActor();
  const [submissions, setSubmissions] = useState<PatientSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [messageFor, setMessageFor] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");

  function statusLabel(status: string) {
    if (status === "released_to_patient") return t("statusReleased");
    if (status === "doctor_completed") return t("statusDoctorCompleted");
    if (status === "scorecard_ready") return t("statusLegacyScorecardReady");
    if (status === "needs_more_data") return t("statusNeedsMoreData");
    if (status === "in_review") return t("statusInReview");
    if (status === "doctor_review_pending") return t("statusPending");
    return t("statusSubmitted");
  }

  const load = useCallback(async () => {
    if (!actor || actor.role !== "doctor") return;
    setLoading(true);
    try {
      setSubmissions(await getPatientSubmissionsRemote(actor));
    } catch {
      toast.error(t("loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [actor, t]);

  useEffect(() => {
    if (!actor || actor.role !== "doctor") return;
    let cancelled = false;
    getPatientSubmissionsRemote(actor)
      .then((items) => {
        if (!cancelled) setSubmissions(items);
      })
      .catch(() => {
        if (!cancelled) toast.error(t("loadFailed"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [actor]);

  async function requestMoreData(id: string) {
    if (!actor || !message.trim()) return;
    try {
      await requestMoreSubmissionData(id, message.trim(), actor);
      setMessage("");
      setMessageFor(null);
      await load();
      toast.success(t("requestSuccess"));
    } catch {
      toast.error(t("requestFailed"));
    }
  }

  async function handleDelete(submissionId: string) {
    if (!actor) return;
    if (!window.confirm(t("deleteConfirm"))) return;
    try {
      await deletePatientSubmissionRemote(submissionId, actor);
      setSubmissions((current) => current.filter((item) => item.id !== submissionId));
      toast.success(t("deleteSuccess"));
    } catch {
      toast.error(t("deleteFailed"));
    }
  }

  const normalizedQuery = query.trim().toLowerCase();
  const filteredSubmissions = submissions.filter((item) => {
    if (!normalizedQuery) return true;
    const dateText = new Date(item.updatedAt ?? item.timestamp).toLocaleDateString(locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
    const evidence = [
      item.notes && t("notes"),
      item.photoFileName && t("photo"),
      item.labFileName && t("lab"),
      item.geneticEvidence && t("genetic"),
      statusLabel(item.status),
    ]
      .filter(Boolean)
      .join(" ");
    return [
      item.id,
      item.patientName,
      item.age,
      item.sex,
      dateText,
      evidence,
    ]
      .filter(Boolean)
      .some((value) => value!.toLowerCase().includes(normalizedQuery));
  });

  return (
    <RoleGuard allowed={["doctor"]} redirectTo="/patient">
      <div className="min-h-screen bg-[#F7F8FA] text-[#0D1B2A]">
        <DashboardNav />
        <main className="mx-auto max-w-[1200px] px-6 pb-24 pt-28">
          <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="section-label mb-2">{t("title")}</p>
              <h1 className="text-[36px] font-normal tracking-[-0.03em]">{t("headline")}</h1>
              <p className="mt-1.5 max-w-2xl text-[14px] leading-6 text-[#4A5568]">
                {t("subtitle")}
              </p>
            </div>
            <button
              type="button"
              onClick={load}
              className="inline-flex h-10 items-center gap-2 rounded border border-[#DDE3ED] bg-white px-5 text-[13px] font-normal text-[#0D1B2A] hover:border-[#0AAFCE]"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              {t("refresh")}
            </button>
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

          <div className="overflow-hidden rounded border border-[#DDE3ED] bg-white">
            {loading ? (
              <div className="p-10 text-center text-[14px] text-[#4A5568]">{t("loading")}</div>
            ) : filteredSubmissions.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px] text-left">
                  <thead className="border-b border-[#DDE3ED] bg-[#F7F8FA]">
                    <tr>
                      {[t("colSubmission"), t("colPatient"), t("colEvidence"), t("colStatus"), t("colUpdated"), t("colAction")].map((header) => (
                        <th key={header} className="px-5 py-3 text-[11px] font-normal uppercase tracking-[0.08em] text-[#8A94A6]">{header}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F0F2F5]">
                    {filteredSubmissions.map((item) => (
                      <tr key={item.id} className={cn("align-top transition-colors hover:bg-[#F7F8FA]")}>
                        <td className="px-5 py-4 font-mono text-[13px] text-[#0AAFCE]">{item.id.slice(0, 8)}</td>
                        <td className="px-5 py-4 text-[13.5px] text-[#0D1B2A]">
                          {item.patientName ?? t("unnamedPatient")}
                          <p className="mt-1 text-[12px] text-[#8A94A6]">{[item.age, item.sex].filter(Boolean).join(" · ") || t("noDemographics")}</p>
                        </td>
                        <td className="px-5 py-4 text-[13px] text-[#4A5568]">
                          {[item.notes && t("notes"), item.photoFileName && t("photo"), item.labFileName && t("lab"), item.geneticEvidence && t("genetic")].filter(Boolean).join(", ") || "-"}
                          {item.doctorMessage && <p className="mt-1 text-[12px] text-[#D4860A]">{item.doctorMessage}</p>}
                        </td>
                        <td className="px-5 py-4"><span className="badge badge-amber">{statusLabel(item.status)}</span></td>
                        <td className="px-5 py-4 text-[12.5px] text-[#8A94A6]">
                          {new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(item.updatedAt ?? item.timestamp))}
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex flex-wrap gap-2">
                            <Link
                              href={`/${locale}/new-case?submission=${item.id}`}
                              className="rounded bg-[#0D1B2A] px-3 py-1.5 text-[12px] font-normal text-white hover:bg-[#1C3352]"
                            >
                              {t("review")}
                            </Link>
                            <button
                              type="button"
                              onClick={() => setMessageFor(messageFor === item.id ? null : item.id)}
                              className="inline-flex items-center gap-1 rounded border border-[#DDE3ED] px-3 py-1.5 text-[12px] font-normal text-[#4A5568] hover:border-[#0AAFCE]"
                            >
                              <MessageSquare className="h-3.5 w-3.5" />
                              {t("moreData")}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(item.id)}
                              className="inline-flex items-center gap-1 rounded border border-[#E7C5C5] px-3 py-1.5 text-[12px] font-normal text-[#B42318] hover:border-[#B42318]"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              {t("delete")}
                            </button>
                          </div>
                          {messageFor === item.id && (
                            <div className="mt-3 w-[280px] space-y-2">
                              <textarea
                                value={message}
                                onChange={(event) => setMessage(event.target.value)}
                                rows={3}
                                placeholder={t("messagePlaceholder")}
                                className="w-full rounded border border-[#DDE3ED] px-3 py-2 text-[13px] outline-none focus:border-[#0AAFCE]"
                              />
                              <button
                                type="button"
                                onClick={() => requestMoreData(item.id)}
                                className="rounded bg-[#0AAFCE] px-3 py-1.5 text-[12px] font-normal text-white"
                              >
                                {t("sendRequest")}
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex flex-col items-center py-16 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-sm bg-[#F0F2F5]">
                  <Inbox className="h-6 w-6 text-[#8A94A6]" />
                </div>
                <h2 className="mt-4 text-[20px] font-normal">{submissions.length ? t("noSearchResults") : t("emptyTitle")}</h2>
                <p className="mt-1.5 text-[14px] text-[#4A5568]">{submissions.length ? t("clearSearch") : t("emptyDesc")}</p>
              </div>
            )}
          </div>
        </main>
      </div>
    </RoleGuard>
  );
}
