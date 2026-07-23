/* eslint-disable react/no-unescaped-entities */
/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import { DashboardNav } from "@/components/nav";
import { FileText, CheckCircle, Activity, Database, Shield, Globe2 } from "lucide-react";
import { useTranslations } from "next-intl";

export default function Page() {
  const t = useTranslations("referralLettersPage");
  const tc = useTranslations("common");
  const brandName = tc("brandName");

  const features = [
    {
      title: t("feat1Title"),
      description: t("feat1Desc"),
      icon: <FileText className="h-6 w-6 text-[#0AAFCE]" />,
    },
    {
      title: t("feat2Title"),
      description: t("feat2Desc", { brandName }),
      icon: <CheckCircle className="h-6 w-6 text-[#0AAFCE]" />,
    },
    {
      title: t("feat3Title"),
      description: t("feat3Desc", { brandName }),
      icon: <Activity className="h-6 w-6 text-[#0AAFCE]" />,
    }
  ];

  return (
    <div className="min-h-screen bg-[#F7F8FA] font-sans text-slate-900">
      <DashboardNav />
      
      {/* Hero Section */}
      <section className="bg-slate-900 px-6 py-24 text-center text-white lg:px-8 lg:py-32 shadow-inner">
        <h1 className="mb-6 text-4xl font-normal lg:text-6xl">
          {t("heroTitle")}
        </h1>
        <p className="mx-auto max-w-3xl text-lg leading-relaxed text-cyan-200 lg:text-xl">
          {t("heroSubtitle", { brandName })}
        </p>
      </section>

      {/* Main Content */}
      <main className="mx-auto max-w-5xl px-6 py-16 lg:px-8">
        
        {/* Intro Section */}
        <div className="mb-16 text-center">
          <h2 className="mb-4 text-3xl font-normal tracking-tight text-slate-900">{t("overviewTitle")}</h2>
          <p className="mx-auto max-w-2xl text-[16px] leading-relaxed text-slate-600">
            {t("overviewText", { brandName })}
          </p>
        </div>

        {/* Feature Grid */}
        <div className="grid gap-6 md:grid-cols-2">
          {features.map((feature, i) => (
            <div 
              key={i} 
              className="group rounded-xl border border-slate-200 bg-white p-8 shadow-sm transition-all hover:border-[#0AAFCE] hover:shadow-md"
            >
              <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-[#E5F8FC] transition-colors group-hover:bg-[#0AAFCE]/20">
                {feature.icon}
              </div>
              <h3 className="mb-3 text-xl font-normal tracking-tight text-slate-900">{feature.title}</h3>
              <p className="text-[15px] leading-relaxed text-slate-600">
                {feature.description}
              </p>
            </div>
          ))}
        </div>

      </main>
    </div>
  );
}
