/* eslint-disable react/no-unescaped-entities */
"use client";

import { DashboardNav } from "@/components/nav";
import { ShieldCheck, EyeOff, FileKey, Database } from "lucide-react";
import { useTranslations } from "next-intl";

export default function PrivacyPage() {
  const t = useTranslations("privacyPage");
  const tc = useTranslations("common");
  const brandName = tc("brandName");

  const policies = [
    {
      icon: <ShieldCheck className="h-6 w-6 text-[#0AAFCE]" />,
      title: t("f1Title"),
      desc: t("f1Desc"),
    },
    {
      icon: <EyeOff className="h-6 w-6 text-[#0AAFCE]" />,
      title: t("f2Title"),
      desc: t("f2Desc"),
    },
    {
      icon: <FileKey className="h-6 w-6 text-[#0AAFCE]" />,
      title: t("f3Title"),
      desc: t("f3Desc"),
    },
    {
      icon: <Database className="h-6 w-6 text-[#0AAFCE]" />,
      title: t("f4Title"),
      desc: t("f4Desc"),
    },
  ];

  return (
    <div className="min-h-screen bg-[#F7F8FA] font-sans text-slate-900">
      <DashboardNav />
      
      {/* Hero Section */}
      <div className="bg-slate-900 text-white py-24 lg:py-32 px-6 lg:px-8 text-center shadow-inner">
        <h1 className="text-4xl lg:text-6xl font-normal mb-6">{t("heroTitle")}</h1>
        <p className="text-lg lg:text-xl text-cyan-200 max-w-3xl mx-auto leading-relaxed">
          {t("heroSubtitle")}
        </p>
      </div>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-6 lg:px-8 py-16">
        
        {/* Core Principles */}
        <div className="grid md:grid-cols-2 gap-6 mb-16">
          {policies.map((policy, idx) => (
            <div key={idx} className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
              <div className="h-12 w-12 bg-[#E5F8FC] rounded-lg flex items-center justify-center mb-6">
                {policy.icon}
              </div>
              <h3 className="text-xl font-normal mb-3">{policy.title}</h3>
              <p className="text-slate-600 leading-relaxed">{policy.desc}</p>
            </div>
          ))}
        </div>

        {/* Detailed Policy Section */}
        <div className="bg-white rounded-xl border border-slate-200 p-8 md:p-12 shadow-sm max-w-4xl mx-auto">
          <h2 className="text-3xl font-normal mb-8">{t("collectionTitle")}</h2>
          
          <div className="space-y-8">
            <div>
              <h3 className="text-xl font-normal mb-3">{t("s1Title")}</h3>
              <p className="text-slate-600 leading-relaxed">
                {t("s1Desc", { brandName })}
              </p>
            </div>

            <div>
              <h3 className="text-xl font-normal mb-3">{t("s2Title")}</h3>
              <p className="text-slate-600 leading-relaxed">
                {t("s2Desc")}
              </p>
            </div>

            <div>
              <h3 className="text-xl font-normal mb-3">{t("s3Title")}</h3>
              <p className="text-slate-600 leading-relaxed">
                {t("s3Desc", { brandName })}
              </p>
            </div>
          </div>
        </div>

      </main>
    </div>
  );
}
