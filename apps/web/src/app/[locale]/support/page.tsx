/* eslint-disable react/no-unescaped-entities */
 
"use client";

import { DashboardNav } from "@/components/nav";
import { Mail, BookOpen, MessageCircle, AlertCircle } from "lucide-react";

import { useTranslations } from "next-intl";

export default function SupportPage() {
  const t = useTranslations("supportPage");
  const tc = useTranslations("common");
  const brandName = tc("brandName");

  const supportChannels = [
    {
      icon: <Mail className="h-6 w-6 text-[#0AAFCE]" />,
      title: t("chan1Title"),
      desc: t("chan1Desc"),
      action: "support@lumina-health.example.com"
    },
    {
      icon: <BookOpen className="h-6 w-6 text-[#0AAFCE]" />,
      title: t("chan2Title"),
      desc: t("chan2Desc", { brandName }),
      action: t("chan2Action")
    },
    {
      icon: <MessageCircle className="h-6 w-6 text-[#0AAFCE]" />,
      title: t("chan3Title"),
      desc: t("chan3Desc"),
      action: t("chan3Action")
    },
    {
      icon: <AlertCircle className="h-6 w-6 text-[#D4860A]" />,
      title: t("chan4Title"),
      desc: t("chan4Desc"),
      action: t("chan4Action")
    }
  ];

  return (
    <div className="min-h-screen bg-[#F7F8FA] font-sans text-slate-900">
      <DashboardNav />
      
      {/* Hero Section */}
      <div className="bg-slate-900 text-white py-24 lg:py-32 px-6 lg:px-8 text-center shadow-inner">
        <h1 className="text-4xl lg:text-6xl font-normal mb-6">{t("heroTitle", { brandName })}</h1>
        <p className="text-lg lg:text-xl text-cyan-200 max-w-3xl mx-auto leading-relaxed">
          {t("heroSubtitle", { brandName })}
        </p>
      </div>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-6 lg:px-8 py-16">
        
        {/* Support Channels */}
        <div className="grid md:grid-cols-2 gap-6 mb-16">
          {supportChannels.map((channel, idx) => (
            <div key={idx} className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
              <div className="h-12 w-12 bg-[#E5F8FC] rounded-lg flex items-center justify-center mb-6">
                {channel.icon}
              </div>
              <h3 className="text-xl font-normal mb-3">{channel.title}</h3>
              <p className="text-slate-600 leading-relaxed mb-6">{channel.desc}</p>
              <button className="text-[14px] font-normal text-[#0AAFCE] hover:text-[#0997B3] transition-colors">
                {channel.action} &rarr;
              </button>
            </div>
          ))}
        </div>

        {/* FAQ Section */}
        <div className="bg-white rounded-xl border border-slate-200 p-8 md:p-12 shadow-sm">
          <h2 className="text-2xl font-normal mb-8">{t("faqTitle")}</h2>
          
          <div className="space-y-6">
            <div className="pb-6 border-b border-slate-100">
              <h4 className="text-lg font-normal mb-2">{t("faq1Q")}</h4>
              <p className="text-slate-600">{t("faq1A", { brandName })}</p>
            </div>
            
            <div className="pb-6 border-b border-slate-100">
              <h4 className="text-lg font-normal mb-2">{t("faq2Q")}</h4>
              <p className="text-slate-600">{t("faq2A")}</p>
            </div>

            <div>
              <h4 className="text-lg font-normal mb-2">{t("faq3Q")}</h4>
              <p className="text-slate-600">{t("faq3A", { brandName })}</p>
            </div>
          </div>
        </div>

      </main>
    </div>
  );
}
