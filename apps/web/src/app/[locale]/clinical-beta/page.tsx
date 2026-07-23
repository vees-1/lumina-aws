/* eslint-disable react/no-unescaped-entities */
/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import { useTranslations } from "next-intl";
import { DashboardNav } from "@/components/nav";
import { FileText, CheckCircle, Activity, Database, Shield, Globe2 } from "lucide-react";

export default function Page() {
  const t = useTranslations("clinicalBeta");
  const tc = useTranslations("common");
  const brandName = tc("brandName");

  const features = [
    {
      title: t("s1Title"),
      description: t("s1P1"),
      icon: <FileText className="h-6 w-6 text-[#0AAFCE]" />,
    },
    {
      title: t("s2Title"),
      description: t("s2P1"),
      icon: <CheckCircle className="h-6 w-6 text-[#0AAFCE]" />,
    },
    {
      title: t("s3Title"),
      description: t("s3P1", { brandName }),
      icon: <Activity className="h-6 w-6 text-[#0AAFCE]" />,
    },
    {
      title: t("s4Title"),
      description: t("s4Desc", { brandName }),
      icon: <Database className="h-6 w-6 text-[#0AAFCE]" />,
    },
    {
      title: t("s5Title"),
      description: t("s5Desc"),
      icon: <Shield className="h-6 w-6 text-[#0AAFCE]" />,
    }
  ];

  return (
    <div className="min-h-screen bg-[#F7F8FA] font-sans text-slate-900">
      <DashboardNav />
      
      {/* Hero Section */}
      <section className="bg-slate-900 px-6 py-24 text-center text-white lg:px-8 lg:py-32 shadow-inner">
        <h1 className="mb-6 text-4xl font-normal lg:text-6xl">
          {t("title")}
        </h1>
        <p className="mx-auto max-w-3xl text-lg leading-relaxed text-cyan-200 lg:text-xl">
          {t("hero", { brandName })}
        </p>
      </section>

      {/* Main Content */}
      <main className="mx-auto max-w-5xl px-6 py-16 lg:px-8">
        
        {/* Intro Section */}
        <div className="mb-16 text-center">
          <h2 className="mb-4 text-3xl font-normal tracking-tight text-slate-900">{tc("overview")}</h2>
          <p className="mx-auto max-w-2xl text-[16px] leading-relaxed text-slate-600">
            {t("s1P1")} {t("s1P2")} {t("s1P3")}
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
