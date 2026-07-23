"use client";

import { useState } from "react";
import { Save, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { DashboardNav } from "@/components/nav";
import { RoleGuard } from "@/components/lumina/role-guard";
import { useTranslations } from "next-intl";

interface DoctorProfile {
  name: string;
  specialty: string;
  clinic: string;
  license: string;
  contact: string;
  signature: string;
  signatureImage?: string;
  referralTo: string;
  letterTone: string;
}

const emptyProfile: DoctorProfile = {
  name: "",
  specialty: "",
  clinic: "",
  license: "",
  contact: "",
  signature: "",
  signatureImage: "",
  referralTo: "Rare disease genetics clinic",
  letterTone: "Concise specialist referral",
};

const inputClass = "h-11 w-full rounded-sm border border-[#DDE3ED] bg-white px-3.5 text-[13.5px] text-[#0D1B2A] placeholder:text-[#8A94A6] outline-none focus:border-[#0AAFCE] focus:ring-2 focus:ring-[#0AAFCE]/15 transition-colors";
const labelClass = "block text-[12px] font-normal uppercase tracking-[0.08em] text-[#8A94A6] mb-1.5";

export default function ProfilePage() {
  const t = useTranslations("doctorProfile");
  const tc = useTranslations("common");
  const brandName = tc("brandName");

  const [profile, setProfile] = useState<DoctorProfile>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("lumina_doc_info");
      if (saved) return JSON.parse(saved);
    }
    return {
      ...emptyProfile,
      referralTo: t("referralToPlaceholder"),
      letterTone: "Concise specialist referral"
    };
  });
  const [saved, setSaved] = useState(false);

  function update<K extends keyof DoctorProfile>(key: K, value: DoctorProfile[K]) {
    setProfile((current) => ({ ...current, [key]: value }));
    setSaved(false);
  }

  function save() {
    localStorage.setItem("lumina_doc_info", JSON.stringify(profile));
    localStorage.setItem("lumina_doctor_profile", JSON.stringify(profile));
    toast.success(t("saved"));
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  function uploadSignature(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error(t("signatureImageError"));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => update("signatureImage", String(reader.result));
    reader.readAsDataURL(file);
  }

  return (
    <RoleGuard allowed={["doctor"]} redirectTo="/patient">
      <div className="min-h-screen bg-[#F7F8FA]">
        <DashboardNav />
        <main className="mx-auto max-w-[820px] px-6 pb-24 pt-28">
          <div className="mb-8">
            <p className="section-label mb-2">{t("settings")}</p>
            <h1 className="text-[36px] font-normal tracking-[-0.03em] text-[#0D1B2A]">{t("title")}</h1>
            <p className="mt-2 max-w-xl text-[14px] leading-6 text-[#4A5568]">
              {t("desc")}
            </p>
          </div>

          <div className="rounded-sm border border-[#DDE3ED] bg-white p-7 shadow-[0_2px_8px_rgba(13,27,42,0.04)]">
            <h2 className="mb-6 text-[15px] font-normal tracking-[-0.01em] text-[#0D1B2A]">{t("profDetails")}</h2>
            <div className="grid gap-5 md:grid-cols-2">
              {[
                { key: "name", label: t("name"), placeholder: t("namePlaceholder") },
                { key: "specialty", label: t("specialty"), placeholder: t("specialtyPlaceholder") },
                { key: "clinic", label: t("clinic"), placeholder: t("clinicPlaceholder", { brandName }) },
                { key: "license", label: t("license"), placeholder: t("licensePlaceholder") },
                { key: "contact", label: t("contact"), placeholder: t("contactPlaceholder") },
                { key: "referralTo", label: t("referralTo"), placeholder: t("referralToPlaceholder") },
              ].map(({ key, label, placeholder }) => (
                <label key={key} className="block">
                  <span className={labelClass}>{label}</span>
                  <input
                    value={profile[key as keyof DoctorProfile]}
                    onChange={(event) => update(key as keyof DoctorProfile, event.target.value)}
                    placeholder={placeholder}
                    className={inputClass}
                  />
                </label>
              ))}
            </div>

            <label className="mt-5 block">
              <span className={labelClass}>{t("signatureLabel")}</span>
              <textarea
                value={profile.signature}
                onChange={(event) => update("signature", event.target.value)}
                placeholder={t("signaturePlaceholder", { brandName })}
                rows={4}
                className="w-full rounded-sm border border-[#DDE3ED] bg-white px-3.5 py-3 text-[13.5px] text-[#0D1B2A] placeholder:text-[#8A94A6] outline-none focus:border-[#0AAFCE] focus:ring-2 focus:ring-[#0AAFCE]/15 transition-colors"
              />
            </label>

            <div className="mt-5 rounded-sm border border-[#DDE3ED] bg-[#FBFCFE] p-4">
              <span className={labelClass}>{t("signatureImageLabel")}</span>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) => uploadSignature(event.target.files?.[0] ?? null)}
                  className="block w-full text-[13px] text-[#4A5568] file:mr-4 file:h-9 file:rounded-sm file:border-0 file:bg-[#0D1B2A] file:px-4 file:text-[13px] file:text-white"
                />
                {profile.signatureImage && (
                  <div className="rounded-sm border border-[#DDE3ED] bg-white px-4 py-2">
                    <img src={profile.signatureImage} alt={t("signatureImageAlt")} className="h-12 max-w-[180px] object-contain" />
                  </div>
                )}
              </div>
            </div>

            <label className="mt-5 block">
              <span className={labelClass}>{t("letterToneLabel")}</span>
              <select
                value={profile.letterTone}
                onChange={(event) => update("letterTone", event.target.value)}
                className={inputClass}
              >
                <option value="Concise specialist referral">{t("toneConcise")}</option>
                <option value="Detailed evidence summary">{t("toneDetailed")}</option>
                <option value="Patient-friendly summary">{t("tonePatient")}</option>
              </select>
            </label>

            <div className="mt-7 flex items-center gap-4">
              <button
                onClick={save}
                className="inline-flex h-10 items-center gap-2 rounded-none bg-[#0D1B2A] px-6 text-[13.5px] font-normal text-white transition-colors hover:bg-[#1C3352]"
              >
                <Save className="h-3.5 w-3.5" />
                {t("save")}
              </button>
              {saved && (
                <span className="flex items-center gap-1.5 text-[13px] font-normal text-[#1A7F4B]">
                  <CheckCircle2 className="h-4 w-4" />
                  {t("saved")}
                </span>
              )}
            </div>
          </div>
        </main>
      </div>
    </RoleGuard>
  );
}
