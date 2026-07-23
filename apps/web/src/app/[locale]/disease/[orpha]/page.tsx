"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useLocale, useMessages, useTranslations } from "next-intl";
import { DashboardNav } from "@/components/nav";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { localizeHpoLabel, type HpoLabelMessages } from "@/lib/hpo";

const ease = [0.25, 0.46, 0.45, 0.94] as const;
const API = "/api";

interface Phenotype {
  hpo_id: string;
  hpo_term: string;
  frequency_label: string;
  frequency_weight: number;
}

interface Gene {
  gene_symbol: string;
  gene_name: string;
  ensembl_id: string;
}

interface Prevalence {
  prevalence_type: string;
  prevalence_class: string;
  val_moy: number | null;
  geographic: string;
}

interface DiseaseDetail {
  orpha_code: string;
  name: string;
  disorder_type: string;
  disorder_group: string;
  icd10: string[];
  omim: string[];
  phenotypes: Phenotype[];
  genes: Gene[];
  prevalence: Prevalence[];
  clinical_summary: {
    inheritance: string | null;
    confirmatory_workup: string | null;
    typical_age_of_onset: string | null;
    prevalence_summary: string | null;
  };
}

const FREQ_COLORS: Record<string, { bg: string; color: string }> = {
  Obligate: { bg: "oklch(0.52 0.21 255 / 0.1)", color: "oklch(0.38 0.21 255)" },
  "Very frequent": { bg: "oklch(0.52 0.19 200 / 0.1)", color: "oklch(0.40 0.19 200)" },
  Frequent: { bg: "oklch(0.52 0.19 160 / 0.1)", color: "oklch(0.38 0.19 160)" },
  Occasional: { bg: "oklch(0.75 0.18 90 / 0.12)", color: "oklch(0.48 0.16 80)" },
  Rare: { bg: "oklch(0.72 0.18 50 / 0.12)", color: "oklch(0.48 0.18 40)" },
  Excluded: { bg: "oklch(0.65 0.22 25 / 0.1)", color: "oklch(0.50 0.22 25)" },
};

function FreqBadge({ label }: { label: string }) {
  const t = useTranslations("disease");
  const colors = FREQ_COLORS[label] ?? { bg: "oklch(0.97 0 0)", color: "oklch(0.46 0 0)" };
  
  const labelMap: Record<string, string> = {
    "Obligate": t("freqObligate"),
    "Very frequent": t("freqVeryFrequent"),
    "Frequent": t("freqFrequent"),
    "Occasional": t("freqOccasional"),
    "Rare": t("freqRare"),
    "Excluded": t("freqExcluded")
  };

  return (
    <span
      className="text-[11px] font-normal px-2 py-0.5 rounded-full whitespace-nowrap"
      style={{ background: colors.bg, color: colors.color }}
    >
      {labelMap[label] || label}
    </span>
  );
}

function SkeletonBlock({ className }: { className?: string }) {
  return <div className={`shimmer rounded-xl ${className ?? ""}`} />;
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <SkeletonBlock className="h-8 w-64" />
        <SkeletonBlock className="h-4 w-40" />
      </div>
      <div className="bg-white rounded-2xl border border-black/[0.06] p-6 space-y-3">
        <SkeletonBlock className="h-5 w-32" />
        <SkeletonBlock className="h-4 w-full" />
        <SkeletonBlock className="h-4 w-5/6" />
        <SkeletonBlock className="h-4 w-3/4" />
      </div>
    </div>
  );
}

function ErrorState({ orpha, locale }: { orpha: string; locale: string }) {
  const t = useTranslations("disease");
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease }}
      className="flex flex-col items-center justify-center py-24 text-center"
    >
      <div className="w-14 h-14 rounded-2xl bg-[oklch(0.97_0_0)] flex items-center justify-center mb-4">
        <svg className="w-7 h-7 text-muted-foreground" fill="none" viewBox="0 0 24 24">
          <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <h2 className="text-[18px] font-normal mb-1">{t("notFound")}</h2>
      <p className="text-[13px] text-muted-foreground mb-6">
        {t("notFoundSub", { orpha: `ORPHA:${orpha}` })}
      </p>
      <Link href={`/${locale}/cases`}>
        <Button variant="outline" className="rounded-full">{t("backToCatalog")}</Button>
      </Link>
    </motion.div>
  );
}

export default function DiseaseDetailPage({ params }: { params: Promise<{ orpha: string }> }) {
  const t = useTranslations("disease");
  const locale = useLocale();
  const messages = useMessages() as HpoLabelMessages;
  const { orpha } = use(params);
  const [disease, setDisease] = useState<DiseaseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function fetchDisease() {
      try {
        const res = await fetch(`${API}/disease/${orpha}?lang=${encodeURIComponent(locale)}`);
        if (!res.ok) {
          if (!cancelled) setError(true);
          return;
        }
        const data: DiseaseDetail = await res.json();
        if (!cancelled) setDisease(data);
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchDisease();
    return () => { cancelled = true; };
  }, [locale, orpha]);

  return (
    <div className="min-h-screen bg-[oklch(0.975_0_0)]">
      <DashboardNav />

      <main className="max-w-4xl mx-auto px-6 pt-20 pb-16">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease }}
          className="pt-4"
        >
          {/* Back nav */}
          <div className="flex items-center gap-2 mb-6">
            <Link
              href={`/${locale}/cases`}
              className="text-[13px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 16 16">
                <path d="M10 4l-4 4 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {t("back")}
            </Link>
          </div>

          {loading && <LoadingSkeleton />}
          {!loading && error && <ErrorState orpha={orpha} locale={locale} />}

          {!loading && !error && disease && (
            <AnimatePresence mode="wait">
              <motion.div
                key="content"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, ease }}
              >
                <div className="mb-8">
                  <h1 className="font-normal text-[30px] mb-3">{disease.name}</h1>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[12px] font-mono font-normal px-2.5 py-1 rounded-full bg-[oklch(0.13_0_0/0.06)] text-foreground">
                      ORPHA:{disease.orpha_code}
                    </span>
                    {disease.disorder_type && (
                      <span className="text-[12px] font-normal px-2.5 py-1 rounded-full bg-[oklch(0.52_0.21_255/0.08)] text-[oklch(0.38_0.21_255)]">
                        {disease.disorder_type}
                      </span>
                    )}
                  </div>
                </div>

                {/* Clinical action summary */}
                <div className="mb-6 rounded-2xl border border-black/[0.06] bg-white p-4 sm:p-5">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <h2 className="text-[14px] font-normal">{t("clinicalSummary")}</h2>
                    <span className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                      {t("summaryAtGlance")}
                    </span>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {[
                      {
                        label: t("inheritance"),
                        value: disease.clinical_summary.inheritance,
                      },
                      {
                        label: t("confirmatoryWorkup"),
                        value: disease.clinical_summary.confirmatory_workup,
                      },
                      {
                        label: t("ageOfOnset"),
                        value: disease.clinical_summary.typical_age_of_onset,
                      },
                      {
                        label: t("prevalenceSummary"),
                        value: disease.clinical_summary.prevalence_summary,
                      },
                    ].map((item) => (
                      <div
                        key={item.label}
                        className="rounded-xl border border-black/[0.06] bg-[oklch(0.985_0_0)] px-4 py-3"
                      >
                        <p className="mb-1 text-[11px] font-normal uppercase tracking-[0.08em] text-muted-foreground">
                          {item.label}
                        </p>
                        <p className="text-[13px] leading-5 text-foreground">
                          {item.value?.trim() || t("notAvailable")}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Clinical Summary */}
                <div className="flex flex-wrap gap-2 mb-6">
                  {disease.disorder_type && (
                    <span className="text-[12px] px-3 py-1.5 rounded-full bg-white border border-black/[0.08] text-muted-foreground">
                      <span className="font-normal text-foreground">{t("disorderType")}:</span> {disease.disorder_type}
                    </span>
                  )}
                  {disease.disorder_group && (
                    <span className="text-[12px] px-3 py-1.5 rounded-full bg-white border border-black/[0.08] text-muted-foreground">
                      <span className="font-normal text-foreground">{t("disorderGroup")}:</span> {disease.disorder_group}
                    </span>
                  )}
                  {disease.omim.length > 0 && (
                    <span className="text-[12px] px-3 py-1.5 rounded-full bg-white border border-black/[0.08] text-muted-foreground">
                      <span className="font-normal text-foreground">{t("omim")}:</span>{" "}
                      {disease.omim.map((id, idx) => (
                        <a
                          key={id}
                          href={`https://omim.org/entry/${id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[oklch(0.38_0.21_255)] hover:underline"
                        >
                          {id}{idx < disease.omim.length - 1 ? ", " : ""}
                        </a>
                      ))}
                    </span>
                  )}
                  {disease.icd10.length > 0 && (
                    <span className="text-[12px] px-3 py-1.5 rounded-full bg-white border border-black/[0.08] text-muted-foreground">
                      <span className="font-normal text-foreground">{t("icd10")}:</span> {disease.icd10.join(", ")}
                    </span>
                  )}
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-3 mb-8">
                  <a
                    href={
                      disease.omim[0]
                        ? `https://omim.org/entry/${disease.omim[0]}`
                        : `https://www.google.com/search?q=${encodeURIComponent(`${disease.name} rare disease`)}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button className="rounded-full bg-foreground text-background h-9 px-5 text-[13px]">
                      {t("analyzeThis")}
                    </Button>
                  </a>
                </div>

                {/* Tabs */}
                <Tabs defaultValue="phenotypes">
                  <TabsList className="mb-6">
                    <TabsTrigger value="phenotypes">
                      {t("tabPhenotypes")}
                      {disease.phenotypes.length > 0 && (
                        <span className="ml-1.5 text-[11px] opacity-60">
                          {disease.phenotypes.length}
                        </span>
                      )}
                    </TabsTrigger>
                    <TabsTrigger value="overview">{t("tabOverview")}</TabsTrigger>
                    <TabsTrigger value="genes">
                      {t("tabGenes")}
                      {disease.genes.length > 0 && (
                        <span className="ml-1.5 text-[11px] opacity-60">
                          {disease.genes.length}
                        </span>
                      )}
                    </TabsTrigger>
                    <TabsTrigger value="prevalence">{t("tabPrevalence")}</TabsTrigger>
                  </TabsList>

                  {/* Phenotypes */}
                  <TabsContent value="phenotypes">
                    {disease.phenotypes.length === 0 ? (
                      <div className="bg-white rounded-2xl border border-black/[0.06] p-10 text-center">
                        <p className="text-[14px] text-muted-foreground">{t("noPhenotypeData")}</p>
                      </div>
                    ) : (
                      <div className="bg-white rounded-2xl border border-black/[0.06] overflow-hidden">
                        <div className="px-5 py-3 border-b border-black/[0.06] flex items-center gap-3">
                          <span className="text-[12px] font-normal text-muted-foreground uppercase tracking-wider">{t("hpoTerm")}</span>
                          <span className="ml-auto text-[12px] font-normal text-muted-foreground uppercase tracking-wider">{t("frequency")}</span>
                        </div>
                        <div className="divide-y divide-black/[0.04] max-h-[500px] overflow-y-auto">
                          {[...disease.phenotypes]
                            .sort((a, b) => b.frequency_weight - a.frequency_weight)
                            .map((p, i) => (
                              <motion.div
                                key={p.hpo_id}
                                initial={{ opacity: 0, x: -8 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.02, duration: 0.25 }}
                                className="flex items-center justify-between px-5 py-3 gap-4"
                              >
                                <div className="flex-1 min-w-0">
                                  <p className="text-[13px] font-normal">{localizeHpoLabel(p.hpo_id, p.hpo_term, messages)}</p>
                                  <p className="text-[11px] font-mono text-muted-foreground">{p.hpo_id}</p>
                                </div>
                                <FreqBadge label={p.frequency_label} />
                              </motion.div>
                            ))}
                        </div>
                      </div>
                    )}
                  </TabsContent>

                  {/* Overview */}
                  <TabsContent value="overview">
                    <div className="space-y-4">
                      <div className="bg-white rounded-2xl border border-black/[0.06] divide-y divide-black/[0.04]">
                        {[
                          { label: t("disorderType"), value: disease.disorder_type || "—" },
                          { label: t("disorderGroup"), value: disease.disorder_group || "—" },
                        ].map((row) => (
                          <div key={row.label} className="flex items-center justify-between px-5 py-4">
                            <span className="text-[13px] text-muted-foreground">{row.label}</span>
                            <span className="text-[13px] font-normal">{row.value}</span>
                          </div>
                        ))}

                        {/* ICD-10 */}
                        <div className="flex items-start justify-between px-5 py-4 gap-4">
                          <span className="text-[13px] text-muted-foreground flex-shrink-0">{t("icd10")}</span>
                          <div className="flex flex-wrap gap-1.5 justify-end">
                            {disease.icd10.length > 0 ? (
                              disease.icd10.map((code) => (
                                <span
                                  key={code}
                                  className="text-[12px] font-mono px-2 py-0.5 rounded-lg bg-[oklch(0.97_0_0)] border border-black/[0.06]"
                                >
                                  {code}
                                </span>
                              ))
                            ) : (
                              <span className="text-[13px] text-muted-foreground">—</span>
                            )}
                          </div>
                        </div>

                        {/* OMIM */}
                        <div className="flex items-start justify-between px-5 py-4 gap-4">
                          <span className="text-[13px] text-muted-foreground flex-shrink-0">{t("omim")}</span>
                          <div className="flex flex-wrap gap-1.5 justify-end">
                            {disease.omim.length > 0 ? (
                              disease.omim.map((id) => (
                                <a
                                  key={id}
                                  href={`https://omim.org/entry/${id}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[12px] font-mono px-2 py-0.5 rounded-lg bg-[oklch(0.52_0.21_255/0.06)] border border-[oklch(0.52_0.21_255/0.2)] text-[oklch(0.38_0.21_255)] hover:bg-[oklch(0.52_0.21_255/0.12)] transition-colors"
                                >
                                  {id} ↗
                                </a>
                              ))
                            ) : (
                              <span className="text-[13px] text-muted-foreground">—</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  {/* Genes */}
                  <TabsContent value="genes">
                    {disease.genes.length === 0 ? (
                      <div className="bg-white rounded-2xl border border-black/[0.06] p-10 text-center">
                        <p className="text-[14px] text-muted-foreground">{t("noGeneData")}</p>
                      </div>
                    ) : (
                      <div className="bg-white rounded-2xl border border-black/[0.06] overflow-hidden">
                        <div className="px-5 py-3 border-b border-black/[0.06]">
                          <span className="text-[12px] font-normal text-muted-foreground uppercase tracking-wider">
                            {t("associatedGenes")}
                          </span>
                        </div>
                        <div className="divide-y divide-black/[0.04]">
                          {disease.genes.map((g, i) => (
                            <motion.div
                              key={g.gene_symbol}
                              initial={{ opacity: 0, x: -8 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: i * 0.03, duration: 0.28 }}
                              className="flex items-center justify-between px-5 py-3.5 gap-4"
                            >
                              <div className="flex-1 min-w-0">
                                <span className="text-[14px] font-normal font-mono">{g.gene_symbol}</span>
                                {g.gene_name && (
                                  <p className="text-[12px] text-muted-foreground mt-0.5 truncate">{g.gene_name}</p>
                                )}
                              </div>
                              {g.ensembl_id && (
                                <a
                                  href={`https://www.ensembl.org/Human/Gene/Summary?g=${g.ensembl_id}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[12px] font-mono px-2.5 py-1 rounded-lg bg-[oklch(0.52_0.19_160/0.07)] border border-[oklch(0.52_0.19_160/0.2)] text-[oklch(0.38_0.19_160)] hover:bg-[oklch(0.52_0.19_160/0.12)] transition-colors whitespace-nowrap"
                                >
                                  {t("ensembl")}
                                </a>
                              )}
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    )}
                  </TabsContent>

                  {/* Prevalence */}
                  <TabsContent value="prevalence">
                    {disease.prevalence.length === 0 ? (
                      <div className="bg-white rounded-2xl border border-black/[0.06] p-10 text-center">
                        <p className="text-[14px] text-muted-foreground">{t("noPrevalenceData")}</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {disease.prevalence.map((p, i) => (
                          <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.06, duration: 0.3 }}
                            className="bg-white rounded-2xl border border-black/[0.06] p-5"
                          >
                            <div className="flex items-start justify-between gap-4 mb-3">
                              <div>
                                <p className="text-[14px] font-normal">{p.prevalence_type}</p>
                                {p.geographic && (
                                  <p className="text-[12px] text-muted-foreground mt-0.5">{p.geographic}</p>
                                )}
                              </div>
                              {p.prevalence_class && (
                                <span className="text-[12px] font-normal px-2.5 py-1 rounded-full bg-[oklch(0.97_0_0)] border border-black/[0.06] text-muted-foreground">
                                  {p.prevalence_class}
                                </span>
                              )}
                            </div>
                            {p.val_moy !== null && p.val_moy !== undefined && (
                              <p className="text-[13px] text-muted-foreground">
                                {t("meanValue")} <span className="font-normal text-foreground">{p.val_moy}</span>
                              </p>
                            )}
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </motion.div>
            </AnimatePresence>
          )}
        </motion.div>
      </main>
    </div>
  );
}
