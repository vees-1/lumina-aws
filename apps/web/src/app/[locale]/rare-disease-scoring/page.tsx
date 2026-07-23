"use client";

import { useTranslations } from "next-intl";
import { DashboardNav } from "@/components/nav";
import { FileText, CheckCircle, Activity } from "lucide-react";

export default function Page() {
  const t = useTranslations("rareDiseaseScoring");
  const tc = useTranslations("common");
  
  const features = [
    {
      title: t("f1Title"),
      description: t("f1Desc"),
      icon: <FileText className="h-6 w-6 text-[#0AAFCE]" />,
    },
    {
      title: t("f2Title"),
      description: t("f2Desc"),
      icon: <CheckCircle className="h-6 w-6 text-[#0AAFCE]" />,
    },
    {
      title: t("f3Title"),
      description: t("f3Desc"),
      icon: <Activity className="h-6 w-6 text-[#0AAFCE]" />,
    }
  ];

  return (
    <div className="min-h-screen bg-[#F7F8FA] font-sans text-slate-900">
      <DashboardNav />
      
      {/* Hero Section */}
      <section className="bg-slate-900 px-6 py-24 text-center text-white lg:px-8 lg:py-32 shadow-inner">
        <h1 className="mb-6 text-4xl font-normal lg:text-6xl">
          {t("heroHeadline")}
        </h1>
        <p className="mx-auto max-w-3xl text-lg leading-relaxed text-cyan-200 lg:text-xl">
          {t("heroSub", { brandName: tc("brandName") })}
        </p>
      </section>

      {/* Main Content */}
      <main className="mx-auto max-w-5xl px-6 py-16 lg:px-8">
        
        {/* Intro Section */}
        <div className="mb-16 text-center">
          <h2 className="mb-4 text-3xl font-normal tracking-tight text-slate-900">{t("overviewTitle")}</h2>
          <p className="mx-auto max-w-2xl text-[16px] leading-relaxed text-slate-600">
            {t("overviewP1", { brandName: tc("brandName") })}
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
