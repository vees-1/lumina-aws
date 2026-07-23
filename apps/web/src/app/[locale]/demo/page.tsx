/* eslint-disable react/no-unescaped-entities */
"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Nav } from "@/components/nav";
import { Button } from "@/components/ui/button";
import { DEMO_CASES, type DemoCase } from "@/lib/demo-cases";
import { formatNumber } from "@/lib/formatters";
import { useLocale, useTranslations } from "next-intl";

const ease = [0.25, 0.46, 0.45, 0.94] as const;

function DemoCaseCard({ demo, index }: { demo: DemoCase; index: number }) {
  const t = useTranslations("demoPage");
  const tc = useTranslations("common");
  const locale = useLocale();

  const MODALITY_LABEL: Record<string, string> = {
    notes: tc("modalityNotes"),
    photo: tc("modalityPhoto"),
    lab: tc("modalityLab"),
    vcf: tc("modalityVcf"),
  };

  const MODALITY_COLORS: Record<string, { bg: string; color: string }> = {
    notes: { bg: "oklch(0.52 0.21 255 / 0.08)", color: "oklch(0.38 0.21 255)" },
    photo: { bg: "oklch(0.55 0.18 200 / 0.08)", color: "oklch(0.38 0.18 200)" },
    lab: { bg: "oklch(0.52 0.20 285 / 0.08)", color: "oklch(0.38 0.20 285)" },
    vcf: { bg: "oklch(0.46 0.19 160 / 0.08)", color: "oklch(0.32 0.19 160)" },
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, ease, delay: index * 0.07 }}
      whileHover={{ y: -3, boxShadow: "0 12px 48px oklch(0 0 0/0.08)" }}
      className="bg-white rounded-2xl border border-black/[0.06] p-6 flex flex-col transition-shadow"
    >
      {/* ORPHA badge */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-[11px] font-mono text-muted-foreground px-2 py-0.5 rounded-full bg-[oklch(0.97_0_0)] border border-black/[0.06]">
          ORPHA:{formatNumber(locale, demo.orpha_code)}
        </span>
        <span className="text-[11px] font-normal px-2 py-0.5 rounded-full bg-[oklch(0.52_0.21_255/0.08)] text-[oklch(0.38_0.21_255)]">
          {t("match", { percent: demo.confidence_expected })}
        </span>
      </div>

      {/* Title + description */}
      <h3 className="serif text-[18px] tracking-tight mb-2 leading-snug">
        {t(`caseTitles.${demo.id}`)}
      </h3>
      <p className="text-[13px] text-muted-foreground leading-relaxed flex-1 mb-4">
        {t(`caseDescriptions.${demo.id}`)}
      </p>

      {/* Modalities */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {demo.modalities.map((m) => {
          const colors = MODALITY_COLORS[m] ?? { bg: "oklch(0.97 0 0)", color: "oklch(0.46 0 0)" };
          return (
            <span
              key={m}
              className="text-[11px] font-normal px-2 py-0.5 rounded-full"
              style={{ background: colors.bg, color: colors.color }}
            >
              {MODALITY_LABEL[m] ?? m}
            </span>
          );
        })}
      </div>

      {/* Teaching point */}
      <div className="rounded-xl bg-[oklch(0.975_0_0)] border border-black/[0.05] p-3 mb-5">
        <p className="text-[11px] font-normal text-muted-foreground uppercase tracking-wider mb-1">
          {t("teachingPoint")}
        </p>
        <p className="text-[12px] text-foreground leading-relaxed">
          {t(`caseTeaching.${demo.id}`)}
        </p>
      </div>

      {/* CTA */}
      <Link href="/sign-up" className="block">
        <Button
          variant="outline"
          className="w-full rounded-xl h-9 text-[13px] border-black/10 hover:bg-[oklch(0.52_0.21_255/0.05)] hover:border-[oklch(0.52_0.21_255/0.3)] transition-colors"
        >
          {t("viewWalkthrough")}
        </Button>
      </Link>
    </motion.div>
  );
}

function EmptyDemoCases() {
  const t = useTranslations("demoPage");
  return (
    <div className="col-span-3 flex flex-col items-center justify-center py-20 text-center">
      <div className="w-14 h-14 rounded-2xl bg-white border border-black/[0.06] flex items-center justify-center mb-4">
        <svg className="w-7 h-7 text-muted-foreground" fill="none" viewBox="0 0 24 24">
          <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <h3 className="text-[16px] font-normal mb-1">{t("emptyTitle")}</h3>
      <p className="text-[13px] text-muted-foreground">{t("emptyDesc")}</p>
    </div>
  );
}

export default function DemoPage() {
  const t = useTranslations("demoPage");
  const tc = useTranslations("common");
  const locale = useLocale();
  const brandName = tc("brandName");

  return (
    <div className="relative min-h-screen bg-[oklch(0.975_0_0)] overflow-hidden">
      {/* Background orbs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <div className="orb orb-3" />
      </div>

      <Nav transparent />

      <main className="relative z-10 max-w-5xl mx-auto px-6 pt-28 pb-20">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease }}
          className="text-center mb-16"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, ease, delay: 0.05 }}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[oklch(0.52_0.21_255/0.08)] border border-[oklch(0.52_0.21_255/0.2)] text-[12px] font-normal text-[oklch(0.38_0.21_255)] mb-6"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[oklch(0.52_0.21_255)] animate-pulse" />
            {t("badge")}
          </motion.div>

          <h1 className="serif text-[42px] md:text-[52px] tracking-tight leading-[1.1] mb-4">
            {t("heroTitle", { brandName })}
          </h1>
          <p className="text-[16px] text-muted-foreground max-w-xl mx-auto leading-relaxed">
            {t("heroSubtitle", { brandName })}
          </p>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.4, ease }}
            className="flex items-center justify-center gap-3 mt-8"
          >
            <Link href={`/${locale}/sign-up`}>
              <Button className="rounded-full bg-foreground text-background h-10 px-6 text-[14px]">
                {t("getStarted")}
              </Button>
            </Link>
            <Link href={`/${locale}/sign-in`}>
              <Button variant="outline" className="rounded-full h-10 px-6 text-[14px] border-black/10">
                {t("signIn")}
              </Button>
            </Link>
          </motion.div>
        </motion.div>

        {/* Stats strip */}
        {DEMO_CASES.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.4 }}
            className="grid grid-cols-3 gap-4 mb-12 max-w-lg mx-auto"
          >
            {[
              { label: t("statsCases"), value: DEMO_CASES.length },
              { label: t("statsModalities"), value: 4 },
              {
                label: t("statsConfidence"),
                value: Math.round(
                  DEMO_CASES.reduce((s, c) => s + c.confidence_expected, 0) /
                    DEMO_CASES.length
                ),
              },
            ].map((s) => (
              <div
                key={s.label}
                className="bg-white/70 backdrop-blur-sm rounded-2xl border border-black/[0.06] px-4 py-3 text-center"
              >
                <div className="text-[20px] font-normal tracking-tight">
                  {s.label === t("statsConfidence")
                    ? `${formatNumber(locale, s.value)}%`
                    : formatNumber(locale, s.value)}
                </div>
                <div className="text-[12px] text-muted-foreground">{s.label}</div>
              </div>
            ))}
          </motion.div>
        )}

        {/* Case grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {DEMO_CASES.length === 0 ? (
            <EmptyDemoCases />
          ) : (
            DEMO_CASES.map((demo, i) => (
              <DemoCaseCard key={demo.id} demo={demo} index={i} />
            ))
          )}
        </div>

        {/* Footer CTA */}
        {DEMO_CASES.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, ease }}
            className="text-center mt-16"
          >
            <h2 className="serif text-[26px] tracking-tight mb-3">
              {t("footerTitle")}
            </h2>
            <p className="text-[14px] text-muted-foreground mb-6">
              {t("footerDesc")}
            </p>
            <Link href={`/${locale}/sign-up`}>
              <Button className="rounded-full bg-foreground text-background h-10 px-8 text-[14px]">
                {t("footerBtn")}
              </Button>
            </Link>
          </motion.div>
        )}
      </main>
    </div>
  );
}
