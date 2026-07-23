"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { v4 as uuid } from "uuid";
import { toast } from "sonner";
import { DashboardNav } from "@/components/nav";
import { RoleGuard } from "@/components/lumina/role-guard";
import { createPatientSubmissionRemote, savePatientSubmission } from "@/lib/api";
import { useApiActor } from "@/lib/use-api-actor";
import { AlertTriangle, Upload, Dna } from "lucide-react";

const inputClass = "h-11 w-full rounded-sm border border-[#DDE3ED] bg-white px-3.5 text-[13.5px] text-[#0D1B2A] placeholder:text-[#8A94A6] outline-none focus:border-[#0AAFCE] focus:ring-2 focus:ring-[#0AAFCE]/15 transition-colors";
const labelClass = "block text-[12px] font-normal uppercase tracking-[0.08em] text-[#8A94A6] mb-1.5";

export default function PatientNewSubmissionPage() {
  const locale = useLocale();
  const t = useTranslations("patientNewSubmission");
  const router = useRouter();
  const actor = useApiActor();
  const [patientName, setPatientName] = useState("");
  const [age, setAge] = useState("");
  const [sex, setSex] = useState("");
  const [notes, setNotes] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [lab, setLab] = useState<File | null>(null);
  const [gene, setGene] = useState("");
  const [variant, setVariant] = useState("");
  const [classification, setClassification] = useState("unknown");

  async function submit() {
    if (!notes.trim() && !photo && !lab && !gene.trim()) {
      toast.error(t("errorNoEvidence"));
      return;
    }
    const submission = {
      id: uuid(),
      timestamp: Date.now(),
      patientName: patientName || undefined,
      age: age || undefined,
      sex: sex || undefined,
      notes: notes.trim() || undefined,
      photoFileName: photo?.name,
      labFileName: lab?.name,
      geneticEvidence: gene.trim() ? { gene_symbol: gene.trim().toUpperCase(), variant: variant || undefined, classification } : undefined,
      status: "doctor_review_pending",
    } as const;
    if (actor) {
      try {
        await createPatientSubmissionRemote({
          patientName: submission.patientName,
          age: submission.age,
          sex: submission.sex,
          notes: submission.notes,
          photo,
          lab,
          geneticEvidence: submission.geneticEvidence,
        }, actor);
      } catch (err) {
        console.warn(err);
        savePatientSubmission(submission);
      }
    } else {
      savePatientSubmission(submission);
    }
    toast.success(t("successMessage"));
    router.push(`/${locale}/patient/submissions`);
  }

  return (
    <RoleGuard allowed={["patient"]} redirectTo="/dashboard">
      <div className="min-h-screen bg-[#F7F8FA] text-[#0D1B2A]">
        <DashboardNav />
        <main className="mx-auto max-w-[1200px] px-6 pb-24 pt-28">
          <div className="mb-8">
            <p className="section-label mb-2">{t("title")}</p>
            <h1 className="text-[36px] font-normal tracking-[-0.03em]">{t("headline")}</h1>
          </div>

          {/* Warning banner */}
          <div className="mb-8 flex gap-3 rounded-sm border border-[#D4860A]/30 bg-[#FEF8ED] px-5 py-4">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#D4860A]" />
            <p className="text-[13.5px] leading-6 text-[#0D1B2A]">
              <strong>{t("warningBold")}</strong>{t("warningText")}
            </p>
          </div>

          <section className="grid gap-6 lg:grid-cols-[1fr_300px]">
            <div className="space-y-5">
              {/* Patient context */}
              <div className="rounded-sm border border-[#DDE3ED] bg-white p-6">
                <h2 className="mb-5 text-[16px] font-normal tracking-[-0.02em]">{t("contextTitle")}</h2>
                <div className="grid gap-4 sm:grid-cols-3">
                  <label>
                    <span className={labelClass}>{t("fullName")}</span>
                    <input value={patientName} onChange={(e) => setPatientName(e.target.value)} placeholder={t("patientNamePlaceholder")} className={inputClass} />
                  </label>
                  <label>
                    <span className={labelClass}>{t("age")}</span>
                    <input value={age} onChange={(e) => setAge(e.target.value)} placeholder={t("agePlaceholder")} className={inputClass} />
                  </label>
                  <label>
                    <span className={labelClass}>{t("sex")}</span>
                    <select value={sex} onChange={(e) => setSex(e.target.value)} className={inputClass}>
                      <option value="">{t("unknown")}</option>
                      <option value="male">{t("male")}</option>
                      <option value="female">{t("female")}</option>
                    </select>
                  </label>
                </div>
              </div>

              {/* Evidence */}
              <div className="rounded-sm border border-[#DDE3ED] bg-white p-6">
                <h2 className="mb-5 text-[16px] font-normal tracking-[-0.02em]">{t("evidenceTitle")}</h2>
                <label className="block">
                  <span className={labelClass}>{t("notes")}</span>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={7}
                    placeholder={t("notesPlaceholder")}
                    className="w-full rounded-sm border border-[#DDE3ED] bg-white px-3.5 py-3 text-[13.5px] text-[#0D1B2A] placeholder:text-[#8A94A6] outline-none focus:border-[#0AAFCE] focus:ring-2 focus:ring-[#0AAFCE]/15 transition-colors"
                  />
                </label>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  {[
                    { label: t("patientPhoto"), accept: "image/*", state: photo, setter: setPhoto },
                    { label: t("labReport"), accept: "image/*,.pdf", state: lab, setter: setLab },
                  ].map(({ label, accept, state, setter }) => (
                    <label key={label} className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-sm border border-dashed border-[#DDE3ED] bg-[#F7F8FA] px-5 py-6 text-center transition-colors hover:border-[#0AAFCE]">
                      <Upload className="h-5 w-5 text-[#8A94A6]" />
                      <span className="text-[13px] font-normal text-[#0D1B2A]">{label}</span>
                      {state ? (
                        <span className="text-[12px] text-[#1A7F4B]">{(state as File).name}</span>
                      ) : (
                        <span className="text-[12px] text-[#8A94A6]">{t("clickToUpload")}</span>
                      )}
                      <input type="file" accept={accept} onChange={(e) => setter(e.target.files?.[0] ?? null)} className="sr-only" />
                    </label>
                  ))}
                </div>

                {/* Genetic */}
                <div className="mt-5">
                  <p className={labelClass + " flex items-center gap-1.5"}>
                    <Dna className="h-3.5 w-3.5" />
                    {t("geneticEvidence")}
                  </p>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <input value={gene} onChange={(e) => setGene(e.target.value)} placeholder={t("genePlaceholder")} className={inputClass} />
                    <input value={variant} onChange={(e) => setVariant(e.target.value)} placeholder={t("variantPlaceholder")} className={inputClass} />
                    <select value={classification} onChange={(e) => setClassification(e.target.value)} className={inputClass}>
                      <option value="unknown">{t("unknown")}</option>
                      <option value="pathogenic">{t("pathogenic")}</option>
                      <option value="likely_pathogenic">{t("likelyPathogenic")}</option>
                      <option value="vus">{t("vus")}</option>
                      <option value="benign">{t("benign")}</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <aside className="rounded-sm border border-[#DDE3ED] bg-white p-6">
              <h2 className="text-[15px] font-normal tracking-[-0.02em]">{t("gateTitle")}</h2>
              <p className="mt-3 text-[13.5px] leading-6 text-[#4A5568]">
                {t("gateDesc")}
              </p>
              <div className="my-5 border-t border-[#DDE3ED]" />
              <div className="space-y-2 text-[12.5px] text-[#4A5568]">
                <p className="flex items-center gap-2"><span className="status-dot-cyan" /> {t("notes")} {notes.trim() ? t("entered") : t("notEntered")}</p>
                <p className="flex items-center gap-2"><span className={photo ? "status-dot-green" : "status-dot-cyan"} /> {t("patientPhoto")} {photo ? photo.name : t("notUploaded")}</p>
                <p className="flex items-center gap-2"><span className={lab ? "status-dot-green" : "status-dot-cyan"} /> {t("labReport")} {lab ? lab.name : t("notUploaded")}</p>
                <p className="flex items-center gap-2"><span className={gene.trim() ? "status-dot-green" : "status-dot-cyan"} /> {t("geneticEvidence")} {gene.trim() ? gene.toUpperCase() : t("notEntered")}</p>
              </div>
              <button
                type="button"
                onClick={submit}
                className="mt-6 w-full rounded-none bg-[#0AAFCE] py-3 text-[14px] font-normal text-white transition-colors hover:bg-[#0997B3]"
              >
                {t("submitBtn")}
              </button>
            </aside>
          </section>
        </main>
      </div>
    </RoleGuard>
  );
}
