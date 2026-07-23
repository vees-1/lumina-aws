"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, useInView, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useTranslations, useLocale, useMessages } from "next-intl";
import { DashboardNav } from "@/components/nav";
import {
  ReferralLetterSheet,
  downloadLetterPdf,
  printWithTitle,
  renderLetterSheetHtml,
  useDoctorLetterProfile,
  type DoctorLetterProfile,
} from "@/components/lumina/referral-letter-sheet";
import { Button } from "@/components/ui/button";
import { localizeHpoLabel, type HpoLabelMessages } from "@/lib/hpo";
import { formatConfidence, formatNumber } from "@/lib/formatters";
import {
  generatePatientSummary,
  getCaseById,
  getAgentSuggestion,
  getCaseRemote,
  getPatientSubmissionRemote,
  releaseSubmissionToPatient,
  requestMoreSubmissionData,
  streamLetter,
  updateCaseInStorage,
  updateCaseRemote,
} from "@/lib/api";
import type { AgentSuggestion } from "@/lib/api";
import { useApiActor } from "@/lib/use-api-actor";
import type { CaseData, HPOTerm, InputSnapshot, PatientSubmission, RankResult, RankTermContext, VisitRecommendation } from "@/types/lumina";

const ease = [0.25, 0.46, 0.45, 0.94] as const;

const CONFIDENCE_CAPS: Record<number, number> = { 1: 40, 2: 55, 3: 65, 4: 80 };
const CLOSE_CONFIDENCE_GAP = 10;
const RANK_COLOR = "#0D1B2A";

function isAbsentTerm(term: Pick<HPOTerm, "assertion" | "confidence">) {
  return term.assertion === "absent" || term.confidence < 0;
}

function formatHpoLabel(
  term: Pick<RankTermContext, "hpo_id" | "label" | "matched_hpo_id" | "matched_label">,
  messages: HpoLabelMessages,
) {
  const id = term.matched_hpo_id ?? term.hpo_id;
  const fallback = term.matched_label?.trim() || term.label?.trim();
  const label = localizeHpoLabel(id, fallback, messages);
  return label ? `${label} (${id})` : id;
}

function getTermDetails(
  result: RankResult,
  kind: "contributing" | "missing" | "distinguishing",
): RankTermContext[] {
  const detailMap = {
    contributing: result.contributing_term_details,
    missing: result.missing_term_details,
    distinguishing: result.distinguishing_term_details,
  } as const;
  const idMap = {
    contributing: result.contributing_terms,
    missing: result.missing_terms,
    distinguishing: result.distinguishing_terms,
  } as const;

  const details = detailMap[kind];
  if (details?.length) return details;
  return (idMap[kind] ?? []).map((hpoId) => ({ hpo_id: hpoId, label: "" }));
}

function ConfidenceTooltip({ confidence, modalities, children }: { confidence: number; modalities: number; children: React.ReactNode }) {
  const t = useTranslations("case");
  const locale = useLocale();
  const [visible, setVisible] = useState(false);
  const cap = CONFIDENCE_CAPS[modalities] ?? 80;
  return (
    <span
      className="relative inline-block"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onClick={() => setVisible(!visible)}
    >
      {children}
      {visible && (
        <span className="absolute bottom-full left-0 mb-2 w-64 bg-foreground text-background text-[12px] leading-relaxed rounded-sm px-3 py-2.5 shadow-lg z-50 pointer-events-auto sm:pointer-events-none">
          {t("confidenceTooltip", {
            confidence: formatConfidence(locale, confidence),
            modalities,
            cap
          })}
          <span className="absolute top-full left-4 border-4 border-transparent border-t-foreground" />
        </span>
      )}
    </span>
  );
}


function HPOChip({ term }: { term: HPOTerm }) {
  const t = useTranslations("case");
  const messages = useMessages() as HpoLabelMessages;
  const label = localizeHpoLabel(term.hpo_id, term.label, messages);

  return (
    <motion.span
      key={`${term.hpo_id}-${term.source}-${term.assertion ?? "present"}`}
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      className="group relative cursor-default rounded-none border border-[#dfe5f0] bg-[#fbfcfe] px-2.5 py-1 text-[11px] text-[#62687a] transition-colors hover:border-[#0AAFCE]/40 hover:bg-[#f2fbff]"
    >
      <span className="font-normal">{label}</span>{" "}
      <span className="font-mono text-[10px] opacity-75">{term.hpo_id}</span>
      {term.source && (
        <span className="absolute bottom-full left-1/2 mb-2 w-60 max-w-[calc(100vw-2rem)] -translate-x-1/2 bg-foreground text-background text-[11px] leading-relaxed rounded-sm px-2.5 py-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-[100] pointer-events-none whitespace-normal font-sans shadow-xl">
          <span className="font-normal">{t("fromLabel")}</span> {term.source}
          <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-foreground" />
        </span>
      )}
    </motion.span>
  );
}

function RankTermChip({
  term,
  tone = "default",
}: {
  term: Pick<RankTermContext, "hpo_id" | "label" | "matched_hpo_id" | "matched_label">;
  tone?: "default" | "missing" | "distinguishing";
}) {
  const messages = useMessages() as HpoLabelMessages;
  const toneClasses = {
    default: "border border-[#dfe5f0] bg-[#fbfcfe] text-[#62687a]",
    missing: "border border-dashed border-[#dfe5f0] bg-white text-[#73798a]",
    distinguishing: "border border-[#bceafd] bg-[#f2fbff] text-[#0D1B2A]",
  } as const;

  const id = tone === "default" ? term.matched_hpo_id ?? term.hpo_id : term.hpo_id;
  const fallbackLabel = tone === "default" ? term.matched_label?.trim() || term.label?.trim() : term.label?.trim();
  const label = localizeHpoLabel(id, fallbackLabel, messages);

  return (
    <span className={`rounded px-2 py-1 text-[11px] ${toneClasses[tone]}`}>
      {label ? (
        <>
          <span className="font-normal">{label}</span>{" "}
          <span className="font-mono text-[10px] opacity-75">{id}</span>
        </>
      ) : (
        <span className="font-mono">{id}</span>
      )}
    </span>
  );
}

// -- Confidence bar ------------------------------------------------------------

function ConfidenceBar({ value, color, delay }: { value: number; color: string; delay: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true });
  return (
    <div ref={ref} className="h-1.5 overflow-hidden rounded-none bg-[#edf2f8]">
      <motion.div
        initial={{ width: 0 }}
        animate={inView ? { width: `${value}%` } : { width: 0 }}
        transition={{ duration: 1.0, ease, delay }}
        className="h-full rounded-none"
        style={{ background: color }}
      />
    </div>
  );
}

// -- Rank card -----------------------------------------------------------------

function RankCard({ result, rank, delay }: { result: RankResult; rank: number; delay: number }) {
  const t = useTranslations("case");
  const locale = useLocale();
  const color = RANK_COLOR;
  const isTop = rank === 1;
  const contributingTerms = getTermDetails(result, "contributing").slice(0, 5);
  const missingTerms = getTermDetails(result, "missing").slice(0, 4);
  const distinguishingTerms = getTermDetails(result, "distinguishing").slice(0, 3);

  return (
    <motion.div
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, ease, delay }}
      className={`relative rounded-sm border bg-white p-5 transition-shadow hover:shadow-[0_8px_26px_rgba(34,45,74,0.08)] ${isTop ? "border-[#bceafd] shadow-[0_8px_26px_rgba(56,182,232,0.12)]" : "border-[#e6eaf2]"}`}
    >
      {isTop && (
        <div className="absolute -top-2.5 left-4">
          <span className="text-[11px] font-normal px-2.5 py-0.5 rounded-none text-white" style={{ background: color }}>
            {t("topMatch")}
          </span>
        </div>
      )}

      <div className="flex items-start gap-4">
        <div
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded bg-[#0D1B2A] text-[15px] font-normal text-white"
          style={{ background: color }}
        >
          {rank}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h3 className="text-[16px] font-normal leading-tight tracking-[-0.01em] text-[#2f3037]">{result.name}</h3>
            <span className="flex-shrink-0 text-[13px] font-normal" style={{ color }}>
              {formatNumber(locale, Math.round(result.confidence))}%
            </span>
          </div>
          <Link href={`/${locale}/disease/${result.orpha_code}`} className="mb-3 inline-block text-[12px] font-normal text-[#0AAFCE] transition-colors hover:text-[#0D1B2A]">
            ORPHA:{formatNumber(locale, result.orpha_code)} ↗
          </Link>
          <ConfidenceBar value={result.confidence} color={color} delay={delay + 0.2} />
          {contributingTerms.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {contributingTerms.map((term) => (
                <RankTermChip key={`${result.orpha_code}-contrib-${term.hpo_id}`} term={term} />
              ))}
            </div>
          )}
          {missingTerms.length > 0 && (
            <div className="mt-3 border-t border-[#edf0f5] pt-3">
              <p className="mb-1.5 text-[10px] font-normal uppercase tracking-wider text-[#73798a]">
                {t("missingFindings")}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {missingTerms.map((term) => (
                  <RankTermChip key={`${result.orpha_code}-missing-${term.hpo_id}`} term={term} tone="missing" />
                ))}
              </div>
            </div>
          )}
          {distinguishingTerms.length > 0 && (
            <div className="mt-2">
              <p className="mb-1.5 text-[10px] font-normal uppercase tracking-wider text-[#0D1B2A]">
                {t("distinguishingFeatures")}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {distinguishingTerms.map((term) => (
                  <RankTermChip key={`${result.orpha_code}-dist-${term.hpo_id}`} term={term} tone="distinguishing" />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// -- Agent suggestion banner ---------------------------------------------------

function AgentBanner({
  suggestion,
  onDismiss,
  caseId,
}: {
  suggestion: AgentSuggestion;
  onDismiss: () => void;
  caseId: string;
}) {
  const t = useTranslations("case");
  const locale = useLocale();
  const modalityNextLabel: Record<string, string> = {
    notes: t("modalityNextNotes"),
    photo: t("modalityNextPhoto"),
    lab: t("modalityNextLab"),
    vcf: t("modalityNextVcf"),
  };
  const nextLabel = modalityNextLabel[suggestion.modality] ?? suggestion.modality;
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.35, ease }}
      className="rounded-sm border border-[rgba(13,27,42,0.15)] bg-[rgba(13,27,42,0.03)] p-4 flex items-start gap-3 mb-6"
    >
      <div className="w-8 h-8 rounded-sm bg-[rgba(13,27,42,0.08)] flex items-center justify-center flex-shrink-0 mt-0.5">
        <svg className="w-4 h-4 text-[var(--lumina-navy)]" fill="none" viewBox="0 0 16 16">
          <path d="M8 2l1.1 3.4H13l-2.9 2.1 1.1 3.4L8 8.8 4.8 10.9l1.1-3.4L3 5.4h3.9L8 2z"
            stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" fill="currentColor" fillOpacity="0.2" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-normal text-[#0D1B2A] mb-0.5">
          {t("aiSuggests", { modality: nextLabel })}
        </p>
        <p className="text-[12px] text-muted-foreground leading-relaxed">{suggestion.reasoning}</p>
        <div className="flex items-center gap-2 mt-3">
          <Link href={`/${locale}/new-case?addTo=${caseId}`}>
            <button className="text-[12px] font-normal px-3 py-1.5 rounded-sm bg-[var(--lumina-navy)] text-white hover:bg-[#0D1B2A] transition-colors">
              {t("addNow")}
            </button>
          </Link>
          <button
            onClick={onDismiss}
            className="text-[12px] text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-sm hover:bg-black/[0.05] transition-colors"
          >
            {t("dismiss")}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// -- Explainability panel ------------------------------------------------------

function ExplainabilityPanel({ result, caseData }: { result: RankResult; caseData: CaseData }) {
  const t = useTranslations("case");
  const messages = useMessages() as HpoLabelMessages;
  const hpoMap = new Map(caseData.hpoTerms.map((t) => [t.hpo_id, t]));
  const modalityLabel: Record<string, string> = {
    notes: t("modalityNotes"),
    photo: t("modalityPhoto"),
    lab: t("modalityLab"),
    genetic: t("geneticEvidence"),
    vcf: t("geneticEvidence"),
  };
  const terms = getTermDetails(result, "contributing").slice(0, 5);

  const modalityColor: Record<string, string> = {
    notes: "var(--lumina-navy)",
    photo: "#0AAFCE",
    lab: "#0D1B2A",
    vcf: "#1A7F4B",
  };
  const modalityBg: Record<string, string> = {
    notes: "rgba(13,27,42,0.1)",
    photo: "rgba(10,175,206,0.1)",
    lab: "rgba(13,27,42,0.1)",
    vcf: "rgba(26,127,75,0.1)",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease, delay: 0.35 }}
      className="bg-white rounded-sm border border-black/[0.06] overflow-hidden"
    >
      <div className="px-5 py-3 border-b border-black/[0.06]">
        <h2 className="text-[13px] font-normal text-muted-foreground uppercase tracking-wider">
          {t("whyThis")}
        </h2>
        <p className="text-[12px] text-muted-foreground mt-0.5">
          {t("topDiscriminating")}
        </p>
      </div>
      <div className="divide-y divide-black/[0.04]">
        {terms.map((detail, i) => {
          const patientHpoId = detail.matched_hpo_id ?? detail.hpo_id;
          const term = hpoMap.get(patientHpoId);
          const src = term?.source_type ?? "unknown";
          const color = modalityColor[src] ?? "#8A94A6";
          const bg = modalityBg[src] ?? "rgba(138,148,166,0.08)";
          return (
            <motion.div
              key={`${result.orpha_code}-why-${patientHpoId}-${detail.hpo_id}`}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 + i * 0.06, duration: 0.3 }}
              className="flex items-center gap-3 px-5 py-3"
            >
              <span className="text-[12px] text-muted-foreground w-56 flex-shrink-0 truncate">
                {formatHpoLabel(detail, messages)}
              </span>
              <div className="flex-1 min-w-0">
                <div className="h-1 bg-[#F0F2F5] rounded-none overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.abs(term?.confidence ?? detail.patient_confidence ?? 0.5) * 100}%` }}
                    transition={{ duration: 0.8, ease, delay: 0.5 + i * 0.06 }}
                    className="h-full rounded-none"
                    style={{ background: color }}
                  />
                </div>
              </div>
              {src !== "unknown" && (
                <span
                  className="text-[11px] font-normal px-2 py-0.5 rounded-none flex-shrink-0"
                  style={{ background: bg, color }}
                >
                  {modalityLabel[src] ?? src}
                </span>
              )}
            </motion.div>
          );
        })}
      </div>
      {terms.length === 0 && (
        <p className="px-5 py-4 text-[13px] text-muted-foreground">{t("noContributing")}</p>
      )}
    </motion.div>
  );
}

function CandidateComparisonPanel({ rankings }: { rankings: RankResult[] }) {
  const t = useTranslations("case");
  const locale = useLocale();
  const messages = useMessages() as HpoLabelMessages;
  const [first, second] = rankings;

  if (!first || !second) return null;

  const gap = Math.abs(first.confidence - second.confidence);
  if (gap > CLOSE_CONFIDENCE_GAP) return null;

  const firstHighlights = getTermDetails(first, "distinguishing").slice(0, 3);
  const secondHighlights = getTermDetails(second, "distinguishing").slice(0, 3);
  const firstQuestions = (firstHighlights.length ? firstHighlights : getTermDetails(first, "missing")).slice(0, 2);
  const secondQuestions = (secondHighlights.length ? secondHighlights : getTermDetails(second, "missing")).slice(0, 2);
  const questions = [
    ...firstQuestions.map((term) => ({ disease: first.name, term })),
    ...secondQuestions.map((term) => ({ disease: second.name, term })),
  ];

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease, delay: 0.18 }}
      className="bg-white rounded-sm border border-black/[0.06] p-5"
    >
      <div className="mb-4">
        <h2 className="text-[14px] font-normal">{t("compareTopCandidates")}</h2>
        <p className="text-[12px] text-muted-foreground mt-1">
          {t("compareTopCandidatesSub", { gap: formatNumber(locale, Math.round(gap)) })}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {[first, second].map((result, index) => {
          const highlights = getTermDetails(result, "distinguishing").slice(0, 3);
          const missing = getTermDetails(result, "missing").slice(0, 2);
          return (
            <div key={result.orpha_code} className="rounded-sm border border-black/[0.06] bg-[#FAFBFC] p-4">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <p className="text-[11px] font-normal uppercase tracking-wider text-muted-foreground">
                    #{index + 1}
                  </p>
                  <h3 className="text-[14px] font-normal leading-tight">{result.name}</h3>
                </div>
                <span className="text-[12px] font-normal text-muted-foreground">
                  {formatNumber(locale, Math.round(result.confidence))}%
                </span>
              </div>

              {highlights.length > 0 && (
                <div className="mb-3">
                  <p className="text-[10px] font-normal text-[rgba(13,27,42,0.65)] uppercase tracking-wider mb-1.5">
                    {t("distinguishingFeatures")}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {highlights.map((term) => (
                      <RankTermChip key={`${result.orpha_code}-compare-dist-${term.hpo_id}`} term={term} tone="distinguishing" />
                    ))}
                  </div>
                </div>
              )}

              {missing.length > 0 && (
                <div>
                  <p className="text-[10px] font-normal text-muted-foreground/60 uppercase tracking-wider mb-1.5">
                    {t("missingFindings")}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {missing.map((term) => (
                      <RankTermChip key={`${result.orpha_code}-compare-missing-${term.hpo_id}`} term={term} tone="missing" />
                    ))}
                  </div>
                </div>
              )}

              {highlights.length === 0 && missing.length === 0 && (
                <p className="text-[12px] text-muted-foreground">{t("noComparisonDetails")}</p>
              )}
            </div>
          );
        })}
      </div>

      {questions.length > 0 && (
        <div className="mt-4 pt-4 border-t border-black/[0.06]">
          <h3 className="text-[12px] font-normal text-muted-foreground uppercase tracking-wider mb-2">
            {t("nextClinicalQuestions")}
          </h3>
          <div className="space-y-2">
            {questions.map(({ disease, term }) => (
              <p key={`${disease}-${term.hpo_id}`} className="text-[12px] text-foreground leading-relaxed">
                {t("askAboutFinding", { feature: formatHpoLabel(term, messages), disease })}
              </p>
            ))}
          </div>
        </div>
      )}
    </motion.section>
  );
}

// -- PubMed citations ----------------------------------------------------------

interface PubMedArticle {
  pmid: string;
  title: string;
  authors: string;
  year: string;
}

function PubMedCitations({ diseaseName }: { diseaseName: string }) {
  const t = useTranslations("case");
  const [articles, setArticles] = useState<PubMedArticle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function fetchCitations() {
      try {
        const query = encodeURIComponent(`"${diseaseName}"[Title/Abstract] rare disease`);
        const searchRes = await fetch(
          `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${query}&retmax=3&retmode=json&sort=relevance`
        );
        const searchData = await searchRes.json();
        const ids: string[] = searchData.esearchresult?.idlist ?? [];
        if (!ids.length || cancelled) { setLoading(false); return; }

        const summaryRes = await fetch(
          `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${ids.join(",")}&retmode=json`
        );
        const summaryData = await summaryRes.json();
        if (cancelled) return;

        const parsed: PubMedArticle[] = ids.map((id) => {
          const doc = summaryData.result?.[id];
          const authors = (doc?.authors ?? []).slice(0, 2).map((a: { name: string }) => a.name).join(", ");
          return {
            pmid: id,
            title: doc?.title ?? "Untitled",
            authors: authors + ((doc?.authors?.length ?? 0) > 2 ? " et al." : ""),
            year: doc?.pubdate?.slice(0, 4) ?? "",
          };
        });
        setArticles(parsed);
      } catch {
        // PubMed unavailable — silently skip
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchCitations();
    return () => { cancelled = true; };
  }, [diseaseName]);

  if (!loading && articles.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, ease, delay: 0.35 }}
      className="bg-white rounded-sm border border-black/[0.06] p-4"
    >
      <h3 className="text-[12px] font-normal text-muted-foreground uppercase tracking-wider mb-3">
        {t("pubmedReferences")}
      </h3>
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 rounded-sm shimmer" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {articles.map((a, i) => (
            <motion.a
              key={a.pmid}
              href={`https://pubmed.ncbi.nlm.nih.gov/${a.pmid}/`}
              target="_blank"
              rel="noopener noreferrer"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07 }}
              className="block group"
            >
              <p className="text-[12px] font-normal leading-snug group-hover:text-[var(--lumina-navy)] transition-colors line-clamp-2">
                {a.title}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {a.authors}{a.year ? ` · ${a.year}` : ""} · PMID {a.pmid}
              </p>
            </motion.a>
          ))}
        </div>
      )}
    </motion.div>
  );
}

// -- Letter view ---------------------------------------------------------------

function LetterView({
  letter,
  streaming,
  onChangeLetter,
  caseData,
}: {
  letter: string;
  streaming: boolean;
  onChangeLetter: (value: string) => void;
  caseData: CaseData;
}) {
  const t = useTranslations("case");
  const letterT = useTranslations("letter");
  const [editing, setEditing] = useState(false);
  const isEditing = editing && !streaming && Boolean(letter);
  const wordCount = letter.trim() ? letter.trim().split(/\s+/).length : 0;

  const doctorProfile = useDoctorLetterProfile() as DoctorLetterProfile | null;

  return (
    <div className="relative bg-[#F4F6F8] rounded-sm border border-black/[0.06] overflow-hidden print:border-none print:bg-white">
      <div className="flex items-center justify-between px-5 py-3 border-b border-black/[0.06] print:hidden">
        <div>
          <h3 className="text-[14px] font-normal">{t("clinicalReferralLetter")}</h3>
          {letter && (
            <p className={`mt-0.5 text-[11px] ${wordCount > 190 ? "text-[#B54708]" : "text-muted-foreground"}`}>
              {letterT("words", { count: wordCount })}
              {wordCount > 190 ? ` · ${letterT("shortenForOnePage")}` : ` · ${letterT("onePageTarget")}`}
            </p>
          )}
        </div>
        {streaming && (
          <span className="flex items-center gap-1.5 text-[12px] text-[var(--lumina-navy)]">
            <span className="w-1.5 h-1.5 rounded-none bg-[var(--lumina-navy)] animate-pulse" />
            {t("generating")}
          </span>
        )}
        {!streaming && letter && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setEditing((current) => !current)}
              className="text-[12px] text-muted-foreground hover:text-foreground transition-colors"
            >
              {isEditing ? letterT("doneEditing") : letterT("edit")}
            </button>
            <button
              onClick={() => {
                navigator.clipboard.writeText(letter);
                toast.success(t("copiedToClipboard"));
              }}
              className="text-[12px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors print:hidden"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 16 16">
                <rect x="2" y="5" width="9" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
                <path d="M5 5V3.5A1.5 1.5 0 016.5 2h6A1.5 1.5 0 0114 3.5v9A1.5 1.5 0 0112.5 14H11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
              {letterT("copy")}
            </button>
            <button
              onClick={() =>
                printWithTitle(
                  caseData.sourceSubmissionId ?? caseData.id,
                  renderLetterSheetHtml({ letter, caseData, doctorProfile }),
                )
              }
              className="text-[12px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors print:hidden"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 16 16">
                <path d="M4 4h8M4 7h8M4 10h5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                <path d="M2 4a2 2 0 012-2h5l3 3v9a2 2 0 01-2 2H4a2 2 0 01-2-2V4z" stroke="currentColor" strokeWidth="1.3" />
              </svg>
              {letterT("print")}
            </button>
            <button
              onClick={() =>
                downloadLetterPdf(`${caseData.sourceSubmissionId ?? caseData.id}.pdf`, {
                  letter,
                  caseData,
                  doctorProfile,
                  submissionId: caseData.sourceSubmissionId ?? caseData.id,
                }).catch(() => toast.error(letterT("downloadFailed")))
              }
              className="text-[12px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors print:hidden"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 16 16">
                <path d="M8 2v7m0 0l-2.5-2.5M8 9l2.5-2.5M3 11.5V13h10v-1.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {letterT("downloadPdf")}
            </button>
          </div>
        )}
      </div>
      <div className="p-4 overflow-x-auto print:overflow-visible print:p-0 print:m-0 print:border-none">

        {isEditing ? (
          <textarea
            value={letter}
            onChange={(e) => onChangeLetter(e.target.value)}
            className="mx-auto block min-h-[1123px] w-full max-w-[794px] rounded-sm border border-black/[0.08] bg-white px-10 py-8 text-[13px] leading-[1.55] font-serif resize-y outline-none shadow-[0_8px_28px_rgba(13,27,42,0.08)]"
          />
        ) : (
          <div>
            <ReferralLetterSheet letter={letter} caseData={caseData} doctorProfile={doctorProfile} />
            {streaming && <span className="cursor-blink" />}
          </div>
        )}
      </div>
    </div>

  );
}


// -- Page ----------------------------------------------------------------------

export default function CasePage({ params }: { params: Promise<{ id: string }> }) {
  const t = useTranslations("case");
  const locale = useLocale();
  const messages = useMessages() as HpoLabelMessages;
  const { id } = use(params);
  const actor = useApiActor();
  const [caseData, setCaseData] = useState<CaseData | null>(() => getCaseById(id));
  const [letter, setLetter] = useState(() => getCaseById(id)?.referralLetterDraft ?? "");
  const [streaming, setStreaming] = useState(false);
  const [letterStarted, setLetterStarted] = useState(() => Boolean(getCaseById(id)?.referralLetterDraft?.trim()));
  const [agentSuggestion, setAgentSuggestion] = useState<AgentSuggestion | null>(null);
  const [agentDismissed, setAgentDismissed] = useState(false);
  const [letterDob, setLetterDob] = useState(() => caseData?.patientContext?.dateOfBirth ?? "");
  const [referringPhysicianName, setReferringPhysicianName] = useState(() => caseData?.patientContext?.referringPhysicianName ?? "");
  const [referringClinic, setReferringClinic] = useState(() => caseData?.patientContext?.referringClinic ?? "");
  const [recipientSpecialist, setRecipientSpecialist] = useState(() => caseData?.patientContext?.recipientSpecialist ?? "");
  const [recipientHospital, setRecipientHospital] = useState(() => caseData?.patientContext?.recipientHospital ?? "");
  const [letterUrgency, setLetterUrgency] = useState(() => caseData?.patientContext?.urgency ?? "routine");
  const [showLetterForm, setShowLetterForm] = useState(false);
  const [releaseSubmission, setReleaseSubmission] = useState<PatientSubmission | null>(null);
  const [visitRecommendation, setVisitRecommendation] = useState<VisitRecommendation>("routine_specialist");
  const [releaseBusy, setReleaseBusy] = useState(false);
  const [moreDataMessage, setMoreDataMessage] = useState("");

  useEffect(() => {
    if (!actor) return;
    getCaseRemote(id, actor)
      .then((remoteCase) => {
        setCaseData(remoteCase);
        if (remoteCase.referralLetterDraft?.trim()) {
          setLetter(remoteCase.referralLetterDraft);
          setLetterStarted(true);
        }
      })
      .catch(() => {});
  }, [actor, id]);

  useEffect(() => {
    if (!actor || actor.role !== "doctor" || !caseData?.sourceSubmissionId) return;
    getPatientSubmissionRemote(caseData.sourceSubmissionId, actor)
      .then((submission) => {
        setReleaseSubmission(submission);
        if (submission.visitRecommendation) setVisitRecommendation(submission.visitRecommendation);
        if (submission.releasedLetterMarkdown) {
          setLetter(submission.releasedLetterMarkdown);
          setLetterStarted(true);
        }
      })
      .catch(() => {});
  }, [actor, caseData?.sourceSubmissionId]);

  useEffect(() => {
    if (!caseData) return;
    const topConf = caseData.rankings[0]?.confidence ?? 100;
    const allModalities = ["notes", "photo", "lab", "vcf"];
    const unused = allModalities.filter((m) => !caseData.modalities.includes(m));
    if (topConf < 85 && unused.length > 0) {
      getAgentSuggestion(caseData.rankings.slice(0, 5), caseData.modalities, 0, locale)
        .then((s) => { if (s.modality) setAgentSuggestion(s); })
        .catch(() => {});
    }
  }, [caseData, locale]);

  const persistCase = async (nextCase: CaseData) => {
    updateCaseInStorage(nextCase.id, nextCase);
    setCaseData(nextCase);
    if (actor?.role === "doctor") {
      try {
        await updateCaseRemote(nextCase, actor, nextCase.sourceSubmissionId);
      } catch {}
    }
  };

  const handleGenerateLetter = async (preference?: "shorter" | "fuller") => {
    if (!caseData) return;
    const patientContext = {
      ...(caseData.patientContext ?? {}),
      ...(letterDob.trim() ? { dateOfBirth: letterDob.trim() } : {}),
      ...(referringPhysicianName.trim() ? { referringPhysicianName: referringPhysicianName.trim() } : {}),
      ...(referringClinic.trim() ? { referringClinic: referringClinic.trim() } : {}),
      ...(recipientSpecialist.trim() ? { recipientSpecialist: recipientSpecialist.trim() } : {}),
      ...(recipientHospital.trim() ? { recipientHospital: recipientHospital.trim() } : {}),
      urgency: letterUrgency,
      visitRecommendation,
    };
    const updatedCase = { ...caseData, patientContext };
    await persistCase(updatedCase);
    setLetterStarted(true);
    setLetter("");
    setStreaming(true);
    let finalLetter = "";
    try {
      for await (const chunk of streamLetter(updatedCase, locale, {
        letterLengthPreference: preference,
      })) {
        finalLetter += chunk;
        setLetter((prev) => prev + chunk);
      }
      if (finalLetter.trim()) {
        await persistCase({ ...updatedCase, referralLetterDraft: finalLetter });
      }
    } catch {
      toast.error(t("letterGenerationFailed"));
    } finally {
      setStreaming(false);
    }
  };

  const handleReleaseToPatient = async () => {
    if (!actor || actor.role !== "doctor" || !caseData?.sourceSubmissionId) return;
    if (streaming) {
      toast.error(t("releaseWaitForLetter"));
      return;
    }
    if (!letter.trim()) {
      toast.error(t("releaseGenerateFirst"));
      return;
    }
    setReleaseBusy(true);
    try {
      const patientSummary = await generatePatientSummary(caseData, visitRecommendation, locale);
      const released = await releaseSubmissionToPatient({
        submissionId: caseData.sourceSubmissionId,
        caseId: caseData.id,
        patientSummary,
        letterMarkdown: letter,
        visitRecommendation,
      }, actor);
      setReleaseSubmission(released);
      toast.success(t("releaseSuccess"));
    } catch {
      toast.error(t("releaseError"));
    } finally {
      setReleaseBusy(false);
    }
  };

  const handleRequestMoreData = async () => {
    if (!actor || actor.role !== "doctor" || !caseData?.sourceSubmissionId) return;
    const message = moreDataMessage.trim() || t("requestMoreDataDefault");
    setReleaseBusy(true);
    try {
      const updated = await requestMoreSubmissionData(caseData.sourceSubmissionId, message, actor);
      setReleaseSubmission(updated);
      setMoreDataMessage("");
      toast.success(t("requestMoreDataSuccess"));
    } catch {
      toast.error(t("requestMoreDataError"));
    } finally {
      setReleaseBusy(false);
    }
  };

  const handleExportFHIR = async (data: CaseData, caseId: string) => {
    const API = "/api";
    try {
      const res = await fetch(`${API}/fhir/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          case_id: caseId,
          lang: locale,
          diagnoses: data.rankings.slice(0, 5).map((r) => ({
            orpha_code: r.orpha_code,
            name: r.name,
            confidence: r.confidence,
            contributing_terms: r.contributing_terms,
          })),
          hpo_terms: data.hpoTerms.map((term) => ({
            hpo_id: term.hpo_id,
            label: localizeHpoLabel(term.hpo_id, term.label, messages) || term.hpo_id,
            confidence: term.confidence,
          })),
        }),
      });
      if (!res.ok) throw new Error("FHIR export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `case_${caseId}_fhir.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      toast.success(t("fhirDownloaded"));
    } catch {
      toast.error(t("fhirExportFailed"));
    }
  };

  const handleChangeLetter = (value: string) => {
    setLetter(value);
  };

  useEffect(() => {
    if (!caseData || !letterStarted || streaming) return;
    if ((caseData.referralLetterDraft ?? "") === letter) return;
    const timeout = window.setTimeout(() => {
      void persistCase({ ...caseData, referralLetterDraft: letter });
    }, 400);
    return () => window.clearTimeout(timeout);
  }, [caseData, letter, letterStarted, streaming]);

  if (!caseData) {
    return (
      <div className="min-h-screen bg-[#F7F8FA]">
        <DashboardNav />
        <main className="max-w-3xl mx-auto px-6 pt-24 pb-16 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
            className="py-16"
          >
            <h2 className="text-[20px] font-normal mb-2">{t("notFound")}</h2>
            <p className="text-muted-foreground text-[14px] mb-6">{t("notFoundSub")}</p>
            <Link href={`/${locale}/dashboard`}>
              <Button variant="outline" className="rounded-none">{t("backToDashboard")}</Button>
            </Link>
          </motion.div>
        </main>
      </div>
    );
  }

  const topRank = caseData.rankings[0];
  const presentTerms = caseData.hpoTerms
    .filter((term) => !isAbsentTerm(term))
    .sort((a, b) => Math.abs(b.confidence) - Math.abs(a.confidence));
  const absentTerms = caseData.hpoTerms
    .filter((term) => isAbsentTerm(term))
    .sort((a, b) => Math.abs(b.confidence) - Math.abs(a.confidence));
  const analysisTimestamp = new Date(caseData.timestamp);
  const formattedAnalysisTimestamp = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(analysisTimestamp);
  const modalityLabel: Record<string, string> = {
    notes: t("modalityNotes"),
    photo: t("modalityPhoto"),
    lab: t("modalityLab"),
    vcf: t("modalityVcf"),
  };
  const originalNotes = caseData.notes?.trim();
  const inputHistory = caseData.inputHistory ?? [];
  const modalityMetadataSummary = inputHistory.reduce<Record<string, Set<string>>>((acc, snapshot) => {
    if (snapshot.photo?.fileName) {
      acc.photo ??= new Set();
      acc.photo.add(snapshot.photo.isFacial ? `${snapshot.photo.fileName} (${t("facialAnalysis")})` : snapshot.photo.fileName);
    }
    if (snapshot.lab?.fileName) {
      acc.lab ??= new Set();
      acc.lab.add(snapshot.lab.fileName);
    }
    if (snapshot.vcf?.fileName) {
      acc.vcf ??= new Set();
      acc.vcf.add(snapshot.vcf.fileName);
    }
    if (snapshot.genetic?.gene_symbol) {
      acc.genetic ??= new Set();
      acc.genetic.add([snapshot.genetic.gene_symbol, snapshot.genetic.variant, snapshot.genetic.classification].filter(Boolean).join(" · "));
    }
    return acc;
  }, {});
  const formatSnapshotTime = (snapshot: InputSnapshot) => new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(snapshot.timestamp));

  return (
    <div className="min-h-screen bg-white text-[#2f3037] print:min-h-0 print:bg-white">
      <div className="print:hidden">
        <DashboardNav />
      </div>

      <main className="mx-auto max-w-6xl px-5 pb-20 pt-24 sm:px-6 print:max-w-none print:px-0 print:pb-0 print:pt-0">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease }}
          className="mb-8 rounded-sm border border-[#e6eaf2] bg-white p-6 shadow-[0_10px_30px_rgba(34,45,74,0.05)] print:hidden sm:p-8"
        >

          <div className="flex items-center gap-2 mb-3">
            <Link href={`/${locale}/cases`} className="flex items-center gap-1 text-[13px] font-normal text-[#0AAFCE] transition-colors hover:text-[#0D1B2A]">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 16 16">
                <path d="M10 4l-4 4 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {t("cases")}
            </Link>
            <span className="text-[#c8cfdd]">/</span>
            <span className="font-mono text-[13px] text-[#73798a]">{id.slice(0, 8)}...</span>
          </div>

          {topRank ? (
            <>
              {caseData.patientContext?.patientName && (
                <p className="mb-1 flex items-center gap-1.5 text-[13px] font-normal text-[#62687a]">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 16 16">
                    <circle cx="8" cy="5" r="3" stroke="currentColor" strokeWidth="1.3" />
                    <path d="M2 14c0-3 2.7-5 6-5s6 2 6 5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                  </svg>
                  {caseData.patientContext.patientName}
                </p>
              )}
              <p className="text-[12px] font-normal uppercase tracking-[0.08em] text-[#0D1B2A]">{t("reviewedScorecard")}</p>
              <h1 className="mb-3 mt-2 text-[34px] font-normal leading-tight tracking-[-0.02em] sm:text-[44px]">{topRank.name}</h1>
              <div className="flex items-center gap-2 flex-wrap mb-4">
                <ConfidenceTooltip confidence={topRank.confidence} modalities={caseData.modalities.length}>
                  <span
                    className="cursor-help whitespace-nowrap rounded-none bg-[#f2fbff] px-3 py-1 text-[12px] font-normal text-[#0D1B2A] sm:text-[13px]"
                  >
                    {formatNumber(locale, Math.round(topRank.confidence))}% {t("confidenceLabel")}
                  </span>
                </ConfidenceTooltip>
                <span className="text-[12px] text-[#73798a] sm:text-[13px]">ORPHA:{formatNumber(locale, topRank.orpha_code)}</span>
                <div className="flex flex-wrap gap-1.5">
                  {caseData.modalities.map((m) => (
                    <span key={m} className="whitespace-nowrap rounded-none border border-[#dfe5f0] bg-white px-2 py-0.5 text-[11px] text-[#62687a] sm:text-[12px]">
                      {modalityLabel[m] ?? m}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#73798a] sm:text-[12px]">
                <time dateTime={analysisTimestamp.toISOString()}>{formattedAnalysisTimestamp}</time>
                <span className="text-[#c8cfdd]">•</span>
                <span className="inline-flex items-center rounded-none border border-[#dfe5f0] bg-[#fbfcfe] px-2 py-0.5 font-normal text-[#343741]">
                  {t("deterministicBadge")}
                </span>
              </div>
            </>
          ) : (
            <h1 className="text-[34px] font-normal tracking-[-0.02em] sm:text-[44px]">{t("caseTitle", { id: id.slice(0, 8) })}</h1>
          )}
        </motion.div>


        {/* Agent suggestion banner */}
        <AnimatePresence>
          {agentSuggestion && !agentDismissed && (
            <div className="print:hidden">
              <AgentBanner
                suggestion={agentSuggestion}
                onDismiss={() => setAgentDismissed(true)}
                caseId={id}
              />
            </div>
          )}
        </AnimatePresence>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] print:block">
          {/* Main column */}
          <div className="space-y-6">
            {(originalNotes || inputHistory.length > 0) && (
              <section className="rounded-sm border border-[#e6eaf2] bg-white p-5 shadow-[0_10px_30px_rgba(34,45,74,0.04)] print:hidden">
                <h2 className="mb-3 text-[13px] font-normal uppercase tracking-[0.08em] text-[#0D1B2A]">
                  {t("originalInput")}
                </h2>
                {originalNotes && (
                  <div className="mb-3">
                    <p className="mb-1.5 text-[11px] font-normal uppercase tracking-wider text-[#73798a]">
                      {t("originalNotes")}
                    </p>
                    <p className="whitespace-pre-wrap rounded border border-[#e6eaf2] bg-[#fbfcfe] px-3 py-2 text-[13px] leading-6 text-[#343741]">
                      {originalNotes}
                    </p>
                  </div>
                )}
                {!!Object.keys(modalityMetadataSummary).length && (
                  <div className="space-y-2">
                    <p className="text-[11px] font-normal uppercase tracking-wider text-[#73798a]">
                      {t("inputMetadata")}
                    </p>
                    {Object.entries(modalityMetadataSummary).map(([modality, values]) => (
                      <div key={modality} className="flex items-start justify-between gap-3">
                        <span className="text-[12px] text-[#73798a]">
                          {modalityLabel[modality] ?? modality}
                        </span>
                        <span className="text-right text-[12px] text-[#343741]">
                          {Array.from(values).join(" · ")}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {inputHistory.length > 1 && (
                  <div className="mt-3 pt-3 border-t border-black/[0.06] space-y-1">
                    <p className="text-[11px] font-normal text-muted-foreground uppercase tracking-wider">
                      {t("additions")}
                    </p>
                    {inputHistory.map((snapshot, idx) => (
                      <div key={`${snapshot.timestamp}-${idx}`} className="text-[12px] text-muted-foreground">
                        {formatSnapshotTime(snapshot)}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* Disease rankings */}
            <section className="print:hidden">
              <motion.h2
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="text-[13px] font-normal text-muted-foreground uppercase tracking-wider mb-3"
              >
                {t("differentialDiagnosis")}
              </motion.h2>
              <div className="space-y-3">
                {caseData.rankings.slice(0, 10).map((r, i) => (
                  <RankCard key={r.orpha_code} result={r} rank={i + 1} delay={i * 0.08} />
                ))}
              </div>
            </section>

            <div className="print:hidden">
              <CandidateComparisonPanel rankings={caseData.rankings.slice(0, 2)} />
            </div>

            {/* Explainability — why the top diagnosis? */}
            {topRank && topRank.contributing_terms.length > 0 && (
              <section className="print:hidden">
                <ExplainabilityPanel result={topRank} caseData={caseData} />
              </section>
            )}

            {/* Letter */}
            <section className="print:m-0">
              <div className="flex items-center justify-between mb-3 print:hidden">
                <h2 className="text-[13px] font-normal text-muted-foreground uppercase tracking-wider">
                  {t("clinicalLetter")}
                </h2>
              </div>
              {!letterStarted && (
                <div className="mb-3 print:hidden">
                  <button
                    onClick={() => setShowLetterForm((s) => !s)}
                    className="text-[12px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors mb-2"
                  >
                    <svg
                      className="w-3 h-3"
                      fill="none"
                      viewBox="0 0 12 12"
                    >
                      <path
                        d={showLetterForm ? "M2 4l4 4 4-4" : "M4 2l4 4-4 4"}
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    {t("customiseLetter")}
                  </button>
                  {showLetterForm && (
                    <div className="grid gap-3 p-3 rounded-sm bg-[#F7F8FA] border border-black/[0.06] sm:grid-cols-2">
                      <label className="grid gap-1.5">
                        <span className="text-[11px] font-normal text-muted-foreground">{t("patientDob")}</span>
                        <input
                          type="date"
                          value={letterDob}
                          onChange={(e) => setLetterDob(e.target.value)}
                          className="w-full h-8 px-3 rounded-sm border border-black/10 text-[12px] outline-none bg-white"
                        />
                      </label>
                      <label className="grid gap-1.5">
                        <span className="text-[11px] font-normal text-muted-foreground">{t("referringPhysicianName")}</span>
                        <input
                          value={referringPhysicianName}
                          onChange={(e) => setReferringPhysicianName(e.target.value)}
                          placeholder={t("referringPhysicianPlaceholder")}
                          className="w-full h-8 px-3 rounded-sm border border-black/10 text-[12px] outline-none bg-white"
                        />
                      </label>
                      <label className="grid gap-1.5">
                        <span className="text-[11px] font-normal text-muted-foreground">{t("referringClinic")}</span>
                        <input
                          value={referringClinic}
                          onChange={(e) => setReferringClinic(e.target.value)}
                          placeholder={t("referringClinicPlaceholder")}
                          className="w-full h-8 px-3 rounded-sm border border-black/10 text-[12px] outline-none bg-white"
                        />
                      </label>
                      <label className="grid gap-1.5">
                        <span className="text-[11px] font-normal text-muted-foreground">{t("recipientSpecialist")}</span>
                        <input
                          value={recipientSpecialist}
                          onChange={(e) => setRecipientSpecialist(e.target.value)}
                          placeholder={t("recipientSpecialistPlaceholder")}
                          className="w-full h-8 px-3 rounded-sm border border-black/10 text-[12px] outline-none bg-white"
                        />
                      </label>
                      <label className="grid gap-1.5 sm:col-span-2">
                        <span className="text-[11px] font-normal text-muted-foreground">{t("recipientHospital")}</span>
                        <input
                          value={recipientHospital}
                          onChange={(e) => setRecipientHospital(e.target.value)}
                          placeholder={t("recipientHospitalPlaceholder")}
                          className="w-full h-8 px-3 rounded-sm border border-black/10 text-[12px] outline-none bg-white"
                        />
                      </label>
                      <label className="grid gap-1.5 sm:col-span-2">
                        <span className="text-[11px] font-normal text-muted-foreground">{t("urgency")}</span>
                        <select
                          value={letterUrgency}
                          onChange={(e) => setLetterUrgency(e.target.value)}
                          className="w-full h-8 px-3 rounded-sm border border-black/10 text-[12px] outline-none bg-white"
                        >
                          <option value="routine">{t("urgencyRoutine")}</option>
                          <option value="urgent">{t("urgencyUrgent")}</option>
                          <option value="emergency">{t("urgencyEmergency")}</option>
                        </select>
                      </label>
                    </div>
                  )}
                </div>
              )}
              {!letterStarted && (
                <Button
                  onClick={() => handleGenerateLetter()}
                  disabled={streaming}
                  className="rounded-none bg-foreground text-background h-8 px-4 text-[13px]"
                >
                  {t("finalizeAndGenerate")}
                </Button>
              )}
              {letterStarted && (
                <LetterView
                  letter={letter}
                  streaming={streaming}
                  onChangeLetter={handleChangeLetter}
                  caseData={caseData}
                />
              )}
              {!letterStarted && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="bg-white rounded-sm border border-dashed border-black/10 p-10 text-center mt-3"
                >
                  <div className="w-12 h-12 rounded-none bg-[#F7F8FA] flex items-center justify-center mx-auto mb-3 float">
                    <svg className="w-6 h-6 text-muted-foreground" fill="none" viewBox="0 0 24 24">
                      <path d="M9 12h6M9 16h4M7 8h10M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </div>
                  <p className="text-[14px] text-muted-foreground">
                    {t("generateWithClaude")}
                  </p>
                </motion.div>
              )}
            </section>
          </div>

          {/* Right sidebar */}
          <div className="space-y-4 print:hidden">
            {/* HPO terms */}
            <motion.div
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, ease, delay: 0.15 }}
              className="bg-white rounded-sm border border-black/[0.06] p-4"
            >
              <h3 className="text-[12px] font-normal text-muted-foreground uppercase tracking-wider mb-3">
                {t("hpoPhenotypes")} ({caseData.hpoTerms.length})
              </h3>
              <div className="space-y-3">
                <div>
                  <p className="text-[10px] font-normal text-muted-foreground/60 uppercase tracking-wider mb-1.5">
                    {t("presentFindings")} ({presentTerms.length})
                  </p>
                  <div className="flex flex-wrap gap-1.5 overflow-visible">
                    {presentTerms.map((term, i) => (
                      <motion.div key={`${term.hpo_id}-present`} transition={{ delay: i * 0.025, duration: 0.2 }}>
                        <HPOChip term={term} />
                      </motion.div>
                    ))}
                  </div>
                </div>

                {absentTerms.length > 0 && (
                  <div className="pt-3 border-t border-black/[0.06]">
                    <p className="text-[10px] font-normal text-muted-foreground/60 uppercase tracking-wider mb-1.5">
                      {t("excludedFindings")} ({absentTerms.length})
                    </p>
                    <div className="flex flex-wrap gap-1.5 overflow-visible">
                      {absentTerms.map((term, i) => (
                        <motion.div key={`${term.hpo_id}-absent`} transition={{ delay: i * 0.025, duration: 0.2 }}>
                          <HPOChip term={term} />
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>

            {/* Evidence summary */}
            <motion.div
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, ease, delay: 0.2 }}
              className="bg-white rounded-sm border border-black/[0.06] p-4"
            >
              <h3 className="text-[12px] font-normal text-muted-foreground uppercase tracking-wider mb-3">{t("evidence")}</h3>
              <div className="space-y-2">
                {[
                  { label: t("hpoExtracted"), value: formatNumber(locale, caseData.hpoTerms.length) },
                  { label: t("modalitiesUsed"), value: formatNumber(locale, caseData.modalities.length) },
                  { label: t("diseasesRanked"), value: formatNumber(locale, caseData.rankings.length) },
                  { label: t("topConfidence"), value: topRank ? `${formatNumber(locale, topRank.confidence, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%` : "—" },
                ].map((row) => (
                  <div key={row.label} className="flex justify-between items-center">
                    <span className="text-[12px] text-muted-foreground">{row.label}</span>
                    <span className="text-[13px] font-normal">{row.value}</span>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* PubMed citations */}
            {topRank && <PubMedCitations diseaseName={topRank.name} />}

            {/* Patient context */}
            {(caseData.patientContext?.age || caseData.patientContext?.sex) && (
              <motion.div
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, ease, delay: 0.25 }}
                className="bg-white rounded-sm border border-black/[0.06] p-4"
              >
                <h3 className="text-[12px] font-normal text-muted-foreground uppercase tracking-wider mb-3">{t("patient")}</h3>
                <div className="space-y-2">
                  {caseData.patientContext?.age && (
                    <div className="flex justify-between">
                      <span className="text-[12px] text-muted-foreground">{t("age")}</span>
                      <span className="text-[13px] font-normal">{caseData.patientContext.age}</span>
                    </div>
                  )}
                  {caseData.patientContext?.sex && (
                    <div className="flex justify-between">
                      <span className="text-[12px] text-muted-foreground">{t("sex")}</span>
                      <span className="text-[13px] font-normal capitalize">{caseData.patientContext.sex}</span>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {actor?.role === "doctor" && caseData.sourceSubmissionId && (
              <motion.div
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, ease, delay: 0.28 }}
                className="bg-white rounded-sm border border-[#DDE3ED] p-4"
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-[12px] font-normal text-muted-foreground uppercase tracking-wider">
                      {t("patientRelease")}
                    </h3>
                    <p className="mt-1 text-[12px] leading-5 text-[#62687a]">
                      {t("patientReleaseDesc")}
                    </p>
                  </div>
                  <span className="whitespace-nowrap rounded-sm bg-[#F3F6FA] px-2 py-1 text-[10px] uppercase tracking-wider text-[#4A5568]">
                    {releaseSubmission?.status === "released_to_patient"
                      ? t("releaseStatusReleased")
                      : releaseSubmission?.status === "needs_more_data"
                        ? t("releaseStatusNeedsMoreData")
                        : releaseSubmission?.status === "in_review"
                          ? t("releaseStatusInReview")
                          : t("releaseStatusDoctorCompleted")}
                  </span>
                </div>
                <label className="mb-3 block">
                  <span className="mb-1 block text-[11px] text-muted-foreground">{t("recommendedNextStep")}</span>
                  <select
                    value={visitRecommendation}
                    onChange={(event) => setVisitRecommendation(event.target.value as VisitRecommendation)}
                    className="h-9 w-full rounded-sm border border-black/10 bg-white px-3 text-[12px] outline-none"
                  >
                    <option value="urgent_clinic">{t("visitUrgentClinic")}</option>
                    <option value="nearest_clinic">{t("visitNearestClinic")}</option>
                    <option value="routine_specialist">{t("visitRoutineSpecialist")}</option>
                    <option value="more_data_first">{t("visitMoreDataFirst")}</option>
                    <option value="no_visit_needed">{t("visitNoVisitNeeded")}</option>
                  </select>
                </label>
                <div className="space-y-2">
                  <Button
                    variant="outline"
                    className="w-full rounded-sm h-9 text-[13px] border-black/10"
                    onClick={() => handleGenerateLetter()}
                    disabled={streaming || releaseBusy}
                  >
                    {t("generateRefineReferralLetter")}
                  </Button>
                  <Button
                    className="w-full rounded-sm h-9 text-[13px] bg-[#0D1B2A] text-white hover:bg-[#14283D]"
                    onClick={handleReleaseToPatient}
                    disabled={streaming || releaseBusy}
                  >
                    {t("releaseSummaryLetter")}
                  </Button>
                </div>
                <div className="mt-4 border-t border-black/[0.06] pt-3">
                  <label className="block">
                    <span className="mb-1 block text-[11px] text-muted-foreground">{t("askForMoreData")}</span>
                    <textarea
                      value={moreDataMessage}
                      onChange={(event) => setMoreDataMessage(event.target.value)}
                      placeholder={t("askForMoreDataPlaceholder")}
                      className="min-h-20 w-full resize-none rounded-sm border border-black/10 bg-[#FBFCFE] px-3 py-2 text-[12px] leading-5 outline-none"
                    />
                  </label>
                  <Button
                    variant="outline"
                    className="mt-2 w-full rounded-sm h-9 text-[13px] border-black/10"
                    onClick={handleRequestMoreData}
                    disabled={releaseBusy}
                  >
                    {t("sendDataRequest")}
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Actions */}
            <motion.div
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, ease, delay: 0.3 }}
              className="space-y-2"
            >
              {caseData.modalities.length < 4 && (
                <Link href={`/${locale}/new-case?addTo=${id}`} className="block">
                  <Button variant="outline" size="sm" className="w-full rounded-sm h-9 text-[13px] border-black/10 gap-1.5">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 16 16">
                      <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                    {t("addData")}
                  </Button>
                </Link>
              )}
              <Button
                variant="outline"
                className="w-full rounded-sm h-9 text-[13px] border-black/10"
                onClick={() => handleExportFHIR(caseData, id)}
              >
                {t("exportFhir")}
              </Button>
              <Link href={`/${locale}/new-case`} className="block">
                <Button variant="outline" className="w-full rounded-sm h-9 text-[13px] border-black/10">
                  {t("newCase")}
                </Button>
              </Link>
              <Link href={`/${locale}/cases`} className="block">
                <Button variant="ghost" className="w-full rounded-sm h-9 text-[13px]">
                  {t("allCases")}
                </Button>
              </Link>
            </motion.div>
          </div>
        </div>
      </main>
    </div>
  );
}
