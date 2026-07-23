"use client";

import { useTranslations } from "next-intl";
import { DashboardNav } from "@/components/nav";
import { LucideIcon } from "lucide-react";

interface InfoPageProps {
  namespace: string;
  icons: LucideIcon[];
}

export function InfoPage({ namespace, icons }: InfoPageProps) {
  const t = useTranslations(namespace);
  const tc = useTranslations("common");
  const brandName = tc("brandName");

  const getT = (key: string, fallbackKey?: string) => {
    try {
      return t(key, { brandName });
    } catch {
      if (fallbackKey) {
        try {
          return t(fallbackKey, { brandName });
        } catch {
          return "";
        }
      }
      return "";
    }
  };

  const features = [
    {
      title: getT("feat1Title", "s1Title"),
      description: getT("feat1Desc", "s1P1"),
      icon: icons[0],
    },
    {
      title: getT("feat2Title", "s2Title"),
      description: getT("feat2Desc", "s2P1"),
      icon: icons[1],
    },
    {
      title: getT("feat3Title", "s3Title"),
      description: getT("feat3Desc", "s3P1"),
      icon: icons[2],
    }
  ];

  return (
    <div className="min-h-screen bg-[#F7F8FA] font-sans text-slate-900">
      <DashboardNav />
      
      {/* Hero Section */}
      <section className="bg-slate-900 px-6 py-24 text-center text-white lg:px-8 lg:py-32 shadow-inner">
        <h1 className="mb-6 text-4xl font-normal lg:text-6xl">
          {getT("heroTitle", "heroHeadline") || getT("title")}
        </h1>
        <p className="mx-auto max-w-3xl text-lg leading-relaxed text-cyan-200 lg:text-xl">
          {getT("heroSubtitle", "heroSub") || getT("hero")}
        </p>
      </section>

      {/* Main Content */}
      <main className="mx-auto max-w-5xl px-6 py-16 lg:px-8">
        
        {/* Intro Section */}
        <div className="mb-16 text-center">
          <h2 className="mb-4 text-3xl font-normal tracking-tight text-slate-900">{getT("overviewTitle")}</h2>
          <p className="mx-auto max-w-3xl text-[16px] leading-relaxed text-slate-600">
            {getT("overviewText")}
          </p>
        </div>

        {/* Feature Grid */}
        <div className="grid gap-6 md:grid-cols-2">
          {features.map((feature, i) => {
            const Icon = feature.icon;
            if (!feature.title) return null;
            return (
              <div 
                key={i} 
                className="group rounded-xl border border-slate-200 bg-white p-8 shadow-sm transition-all hover:border-[#0AAFCE] hover:shadow-md"
              >
                <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-[#E5F8FC] transition-colors group-hover:bg-[#0AAFCE]/20">
                  <Icon className="h-6 w-6 text-[#0AAFCE]" />
                </div>
                <h3 className="mb-3 text-xl font-normal tracking-tight text-slate-900">{feature.title}</h3>
                <p className="text-[15px] leading-relaxed text-slate-600">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>

      </main>
    </div>
  );
}
