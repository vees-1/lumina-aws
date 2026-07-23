"use client";

import { useTranslations } from "next-intl";
import { DashboardNav } from "@/components/nav";
import { AlertTriangle, CheckCircle, Scale, Users } from "lucide-react";

export default function TermsPage() {
  const t = useTranslations("termsPage");
  const tc = useTranslations("common");
  
  const principles = [
    {
      icon: <Scale className="h-6 w-6 text-[#0AAFCE]" />,
      title: t("p1Title"),
      desc: t("p1Desc", { brandName: tc("brandName") }),
    },
    {
      icon: <Users className="h-6 w-6 text-[#0AAFCE]" />,
      title: t("p2Title"),
      desc: t("p2Desc"),
    },
    {
      icon: <CheckCircle className="h-6 w-6 text-[#0AAFCE]" />,
      title: t("p3Title"),
      desc: t("p3Desc", { brandName: tc("brandName") }),
    },
    {
      icon: <AlertTriangle className="h-6 w-6 text-[#D4860A]" />,
      title: t("p4Title"),
      desc: t("p4Desc", { brandName: tc("brandName") }),
    },
  ];

  return (
    <div className="min-h-screen bg-[#F7F8FA] font-sans text-slate-900">
      <DashboardNav />
      
      {/* Hero Section */}
      <div className="bg-slate-900 text-white py-24 lg:py-32 px-6 lg:px-8 text-center shadow-inner">
        <h1 className="text-4xl lg:text-6xl font-normal mb-6">{t("heroHeadline")}</h1>
        <p className="text-lg lg:text-xl text-cyan-200 max-w-3xl mx-auto leading-relaxed">
          {t("heroSub", { brandName: tc("brandName") })}
        </p>
      </div>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-6 lg:px-8 py-16">
        
        {/* Core Principles */}
        <div className="grid md:grid-cols-2 gap-6 mb-16">
          {principles.map((principle, idx) => (
            <div key={idx} className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
              <div className="h-12 w-12 bg-[#E5F8FC] rounded-lg flex items-center justify-center mb-6">
                {principle.icon}
              </div>
              <h3 className="text-xl font-normal mb-3">{principle.title}</h3>
              <p className="text-slate-600 leading-relaxed">{principle.desc}</p>
            </div>
          ))}
        </div>

        {/* Detailed Terms Section */}
        <div className="bg-white rounded-xl border border-slate-200 p-8 md:p-12 shadow-sm max-w-4xl mx-auto">
          <h2 className="text-3xl font-normal mb-8">{t("detailedTermsTitle")}</h2>
          
          <div className="space-y-8">
            <div>
              <h3 className="text-xl font-normal mb-3">{t("s1Title")}</h3>
              <p className="text-slate-600 leading-relaxed">
                {t("s1Desc", { brandName: tc("brandName") })}
              </p>
            </div>

            <div>
              <h3 className="text-xl font-normal mb-3">{t("s2Title")}</h3>
              <p className="text-slate-600 leading-relaxed">
                {t("s2Desc", { brandName: tc("brandName") })}
              </p>
            </div>

            <div>
              <h3 className="text-xl font-normal mb-3">{t("s3Title")}</h3>
              <p className="text-slate-600 leading-relaxed">
                {t("s3Desc", { brandName: tc("brandName") })}
              </p>
            </div>
          </div>
        </div>

      </main>
    </div>
  );
}
