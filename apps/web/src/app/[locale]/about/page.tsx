"use client";

import { useTranslations } from "next-intl";
import { DashboardNav } from "@/components/nav";
import { Lightbulb, Target, Users, Zap } from "lucide-react";

export default function AboutPage() {
  const t = useTranslations("about");
  const tc = useTranslations("common");
  
  const features = [
    {
      icon: <Lightbulb className="h-6 w-6 text-[#0AAFCE]" />,
      title: t("f1Title"),
      desc: t("f1Desc"),
    },
    {
      icon: <Target className="h-6 w-6 text-[#0AAFCE]" />,
      title: t("f2Title"),
      desc: t("f2Desc", { brandName: tc("brandName") }),
    },
    {
      icon: <Users className="h-6 w-6 text-[#0AAFCE]" />,
      title: t("f3Title"),
      desc: t("f3Desc"),
    },
    {
      icon: <Zap className="h-6 w-6 text-[#0AAFCE]" />,
      title: t("f4Title"),
      desc: t("f4Desc"),
    },
  ];

  return (
    <div className="min-h-screen bg-[#F7F8FA] font-sans text-slate-900">
      <DashboardNav />
      
      {/* Hero Section */}
      <div className="bg-slate-900 text-white py-24 lg:py-32 px-6 lg:px-8 text-center shadow-inner">
        <h1 className="text-4xl font-normal lg:text-6xl mb-6">{t("heroHeadline", { brandName: tc("brandName") })}</h1>
        <p className="text-lg lg:text-xl text-cyan-200 max-w-3xl mx-auto leading-relaxed">
          {t("heroSub")}
        </p>
      </div>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-6 lg:px-8 py-16">
        
        {/* Feature Cards */}
        <div className="grid md:grid-cols-2 gap-6 mb-16">
          {features.map((feature, idx) => (
            <div key={idx} className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
              <div className="h-12 w-12 bg-[#E5F8FC] rounded-lg flex items-center justify-center mb-6">
                {feature.icon}
              </div>
              <h3 className="text-xl font-normal mb-3">{feature.title}</h3>
              <p className="text-slate-600 leading-relaxed">{feature.desc}</p>
            </div>
          ))}
        </div>

        {/* Story Section */}
        <div className="bg-white rounded-xl border border-slate-200 p-8 md:p-12 shadow-sm text-center max-w-4xl mx-auto">
          <h2 className="text-3xl font-normal mb-6">{t("storyTitle")}</h2>
          <p className="text-slate-600 leading-relaxed mb-6 italic text-lg">
            {t("storyP1")}
          </p>
          <p className="text-slate-600 leading-relaxed text-lg">
            {t("storyP2", { brandName: tc("brandName") })}
          </p>
        </div>

      </main>
    </div>
  );
}
