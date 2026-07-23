"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { v4 as uuid } from "uuid";
import { useLocale, useMessages, useTranslations } from "next-intl";
import { DashboardNav } from "@/components/nav";
import { RoleGuard } from "@/components/lumina/role-guard";
import { Button } from "@/components/ui/button";
import { localizeHpoLabel, type HpoLabelMessages } from "@/lib/hpo";
import { formatFileSize, formatNumber } from "@/lib/formatters";
import {
  downloadSubmissionFile,
  completeSubmissionReview,
  getCaseById,
  getPatientSubmissionRemote,
  saveCaseRemote,
  saveCaseToStorage,
  scoreCase,
  startSubmissionReview,
  suggestLab,
  suggestNotes,
  suggestPhoto,
  updateCaseInStorage,
} from "@/lib/api";
import { useApiActor } from "@/lib/use-api-actor";
import type { GeneticEvidence, HPOTerm, PatientSubmission } from "@/types/lumina";

const ease = [0.25, 0.46, 0.45, 0.94] as const;

const SYMPTOM_CATEGORIES = [
  {
    id: "growth",
    i18nKey: "catGrowth",
    canonicalLabel: "Growth",
    symptoms: [
      { id: "shortStature", labelKey: "symptomShortStature", canonical: "Short stature" },
      { id: "failureToThrive", labelKey: "symptomFailureToThrive", canonical: "Failure to thrive" },
      { id: "microcephaly", labelKey: "symptomMicrocephaly", canonical: "Microcephaly" },
      { id: "macrocephaly", labelKey: "symptomMacrocephaly", canonical: "Macrocephaly" },
      { id: "tallStature", labelKey: "symptomTallStature", canonical: "Tall stature" },
      { id: "obesity", labelKey: "symptomObesity", canonical: "Obesity" },
    ],
  },
  {
    id: "neurological",
    i18nKey: "catNeurological",
    canonicalLabel: "Neurological",
    symptoms: [
      { id: "seizures", labelKey: "symptomSeizures", canonical: "Seizures" },
      { id: "developmentalDelay", labelKey: "symptomDevelopmentalDelay", canonical: "Developmental delay" },
      { id: "intellectualDisability", labelKey: "symptomIntellectualDisability", canonical: "Intellectual disability" },
      { id: "hypotonia", labelKey: "symptomHypotonia", canonical: "Hypotonia" },
      { id: "ataxia", labelKey: "symptomAtaxia", canonical: "Ataxia" },
      { id: "spasticity", labelKey: "symptomSpasticity", canonical: "Spasticity" },
      { id: "nystagmus", labelKey: "symptomNystagmus", canonical: "Nystagmus" },
    ],
  },
  {
    id: "facial",
    i18nKey: "catFacial",
    canonicalLabel: "Facial",
    symptoms: [
      { id: "hypertelorism", labelKey: "symptomHypertelorism", canonical: "Hypertelorism" },
      { id: "lowSetEars", labelKey: "symptomLowSetEars", canonical: "Low-set ears" },
      { id: "epicanthalFolds", labelKey: "symptomEpicanthalFolds", canonical: "Epicanthal folds" },
      { id: "broadNasalBridge", labelKey: "symptomBroadNasalBridge", canonical: "Broad nasal bridge" },
      { id: "upslantedPalpebralFissures", labelKey: "symptomUpslantedPalpebralFissures", canonical: "Upslanted palpebral fissures" },
      { id: "downslantedPalpebralFissures", labelKey: "symptomDownslantedPalpebralFissures", canonical: "Downslanted palpebral fissures" },
      { id: "shortPhiltrum", labelKey: "symptomShortPhiltrum", canonical: "Short philtrum" },
      { id: "micrognathia", labelKey: "symptomMicrognathia", canonical: "Micrognathia" },
    ],
  },
  {
    id: "skeletal",
    i18nKey: "catSkeletal",
    canonicalLabel: "Skeletal",
    symptoms: [
      { id: "clinodactyly", labelKey: "symptomClinodactyly", canonical: "Clinodactyly" },
      { id: "brachydactyly", labelKey: "symptomBrachydactyly", canonical: "Brachydactyly" },
      { id: "scoliosis", labelKey: "symptomScoliosis", canonical: "Scoliosis" },
      { id: "jointHypermobility", labelKey: "symptomJointHypermobility", canonical: "Joint hypermobility" },
      { id: "polydactyly", labelKey: "symptomPolydactyly", canonical: "Polydactyly" },
      { id: "syndactyly", labelKey: "symptomSyndactyly", canonical: "Syndactyly" },
    ],
  },
  {
    id: "metabolic",
    i18nKey: "catMetabolic",
    canonicalLabel: "Metabolic",
    symptoms: [
      { id: "hypoglycemia", labelKey: "symptomHypoglycemia", canonical: "Hypoglycemia" },
      { id: "lacticAcidosis", labelKey: "symptomLacticAcidosis", canonical: "Lactic acidosis" },
      { id: "metabolicAcidosis", labelKey: "symptomMetabolicAcidosis", canonical: "Metabolic acidosis" },
      { id: "hyperammonemia", labelKey: "symptomHyperammonemia", canonical: "Hyperammonemia" },
      { id: "developmentalRegression", labelKey: "symptomDevelopmentalRegression", canonical: "Developmental regression" },
      { id: "hepatomegaly", labelKey: "symptomHepatomegaly", canonical: "Hepatomegaly" },
    ],
  },
  {
    id: "renalHearing",
    i18nKey: "catRenalHearing",
    canonicalLabel: "Renal / Hearing",
    symptoms: [
      { id: "renalAnomaly", labelKey: "symptomRenalAnomaly", canonical: "Renal anomaly" },
      { id: "hydronephrosis", labelKey: "symptomHydronephrosis", canonical: "Hydronephrosis" },
      { id: "proteinuria", labelKey: "symptomProteinuria", canonical: "Proteinuria" },
      { id: "hearingImpairment", labelKey: "symptomHearingImpairment", canonical: "Hearing impairment" },
      { id: "sensorineuralHearingLoss", labelKey: "symptomSensorineuralHearingLoss", canonical: "Sensorineural hearing loss" },
    ],
  },
  {
    id: "cardiac",
    i18nKey: "catCardiac",
    canonicalLabel: "Cardiac",
    symptoms: [
      { id: "ventricularSeptalDefect", labelKey: "symptomVentricularSeptalDefect", canonical: "Ventricular septal defect" },
      { id: "atrialSeptalDefect", labelKey: "symptomAtrialSeptalDefect", canonical: "Atrial septal defect" },
      { id: "cardiomyopathy", labelKey: "symptomCardiomyopathy", canonical: "Cardiomyopathy" },
      { id: "arrhythmia", labelKey: "symptomArrhythmia", canonical: "Arrhythmia" },
      { id: "congenitalHeartDisease", labelKey: "symptomCongenitalHeartDisease", canonical: "Congenital heart disease" },
    ],
  },
] as const;

type Tab = "notes" | "photo" | "lab" | "genetic";

const TAB_ICONS: Record<Tab, React.ReactNode> = {
  notes: (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 16 16">
      <rect x="2" y="1" width="12" height="14" rx="2" stroke="currentColor" strokeWidth="1.3" />
      <path d="M5 5h6M5 8h6M5 11h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  ),
  photo: (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 16 16">
      <rect x="1" y="3" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M5.5 3l1-2h3l1 2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  lab: (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 16 16">
      <path d="M6 1v6L2 13a1 1 0 00.9 1.5h10.2A1 1 0 0014 13L10 7V1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5.5 1h5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="6.5" cy="11" r="0.8" fill="currentColor" />
      <circle cx="9.5" cy="12" r="0.8" fill="currentColor" />
    </svg>
  ),
  genetic: (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 16 16">
      <path d="M8 1c0 0-2 2.5-2 5s2 5 2 5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M8 1c0 0 2 2.5 2 5s-2 5-2 5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M3 5.5h10M3 10.5h10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="8" cy="14.5" r="1" fill="currentColor" />
    </svg>
  ),
};

function DropZone({
  accept, label, hint, file, onFile, onClear,
}: {
  accept: string; label: string; hint: string;
  file: File | null; onFile: (f: File) => void; onClear: () => void;
}) {
  const locale = useLocale();
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) onFile(f);
  }, [onFile]);

  if (file) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex items-center gap-3 p-4 rounded-sm border border-[rgba(13,27,42,0.18)] bg-[rgba(13,27,42,0.02)]"
      >
        <div className="w-10 h-10 rounded-sm bg-[rgba(13,27,42,0.07)] flex items-center justify-center flex-shrink-0">
          <svg className="w-5 h-5 text-[var(--lumina-navy)]" fill="none" viewBox="0 0 20 20">
            <path d="M4 4a2 2 0 012-2h5l5 5v9a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" stroke="currentColor" strokeWidth="1.5" />
            <path d="M13 2v5h5" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-normal truncate">{file.name}</p>
          <p className="text-[12px] text-muted-foreground">{formatFileSize(locale, file.size)}</p>
        </div>
        <button onClick={onClear} className="text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-sm hover:bg-black/5">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 16 16">
            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </motion.div>
    );
  }

  return (
    <motion.div
      animate={dragging ? { scale: 1.01, borderColor: "var(--lumina-navy)" } : { scale: 1 }}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className="relative flex flex-col items-center justify-center gap-3 rounded border border-dashed border-[#d9dfeb] p-6 transition-all hover:border-[#bfc8d8] hover:bg-black/[0.01] cursor-pointer group"
    >
      <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
      <div className="flex h-10 w-10 items-center justify-center rounded-none bg-[#F7F8FA] transition-colors group-hover:bg-[#EEF0F4]">
        <svg className="h-5 w-5 text-muted-foreground" fill="none" viewBox="0 0 24 24">
          <path d="M12 16V8m0-4l4 4m-4-4L8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>
      <div className="text-center">
        <p className="text-[14px] font-normal">{label}</p>
        <p className="text-[12px] text-muted-foreground mt-0.5">{hint}</p>
      </div>
    </motion.div>
  );
}

function ProgressStep({ label, active, done }: { label: string; active: boolean; done: boolean }) {
  return (
    <motion.div
      animate={{ opacity: active || done ? 1 : 0.4 }}
      className="flex items-center gap-2"
    >
      <div className={`w-5 h-5 rounded-none flex items-center justify-center flex-shrink-0 transition-all duration-300 ${
        done ? "bg-[#1A7F4B]" :
        active ? "bg-[var(--lumina-navy)] ring-4 ring-[rgba(13,27,42,0.12)]" :
        "bg-[#E5E8EE]"
      }`}>
        {done ? (
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 12 12">
            <path d="M2.5 6l2.5 2.5 4.5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : active ? (
          <div className="w-2 h-2 rounded-none bg-white animate-pulse" />
        ) : null}
      </div>
      <span className="text-[13px] font-normal">{label}</span>
    </motion.div>
  );
}

export default function IntakePage() {
  const t = useTranslations("intake");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const messages = useMessages() as HpoLabelMessages;
  const router = useRouter();
  const searchParams = useSearchParams();
  const actor = useApiActor();
  const addToId = searchParams.get("addTo");
  const submissionId = searchParams.get("submission");
  const existingCase = addToId ? getCaseById(addToId) : null;
  const requestedTab = searchParams.get("tab");

  const usedModalities = addToId && existingCase ? existingCase.modalities : [];
  const firstUnused = (["notes", "photo", "lab", "genetic"] as Tab[]).find((m) => !usedModalities.includes(m)) ?? "notes";
  const validRequestedTab = requestedTab === "notes" || requestedTab === "photo" || requestedTab === "lab" || requestedTab === "genetic" ? requestedTab : null;

  const [tab, setTab] = useState<Tab>(validRequestedTab ?? firstUnused);
  const [showChecklist, setShowChecklist] = useState(false);
  const [openCategories, setOpenCategories] = useState<Set<string>>(new Set(["neurological"]));
  const [notes, setNotes] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [isFacial, setIsFacial] = useState(false);
  const [lab, setLab] = useState<File | null>(null);
  const [geneSymbol, setGeneSymbol] = useState("");
  const [variant, setVariant] = useState("");
  const [classification, setClassification] = useState("unknown");
  const [zygosity, setZygosity] = useState("");
  const [patientName, setPatientName] = useState(existingCase?.patientContext?.patientName ?? "");
  const [age, setAge] = useState(existingCase?.patientContext?.age ?? "");
  const [sex, setSex] = useState(existingCase?.patientContext?.sex ?? "");
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState<string[]>([]);
  const [activeStep, setActiveStep] = useState("");
  const [suggestions, setSuggestions] = useState<HPOTerm[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [submission, setSubmission] = useState<PatientSubmission | null>(null);

  const TABS: { id: Tab; label: string; hint: string }[] = [
    { id: "notes", label: t("tabNotesLabel"), hint: t("tabNotesHint") },
    { id: "photo", label: t("tabPhotoLabel"), hint: t("tabPhotoHint") },
    { id: "lab",   label: t("tabLabLabel"),   hint: t("tabLabHint")   },
    { id: "genetic", label: t("tabGeneticLabel"), hint: t("tabGeneticHint") },
  ];

  const geneticEvidence: GeneticEvidence[] = geneSymbol.trim()
    ? [{ gene_symbol: geneSymbol.trim().toUpperCase(), variant: variant.trim() || undefined, classification, zygosity: zygosity.trim() || undefined }]
    : [];
  const activeModalities = [!!notes.trim(), !!photo, !!lab, !!geneSymbol.trim()].filter(Boolean).length;
  const hasAnyInput = activeModalities > 0;
  const acceptedTerms = suggestions.filter((term) => term.review_status === "accepted");
  const pendingTerms = suggestions.filter((term) => term.review_status === "pending");
  const rejectedTerms = suggestions.filter((term) => term.review_status === "rejected");

  useEffect(() => {
    if (!submissionId || !actor || actor.role !== "doctor") return;
    const reviewSubmissionId = submissionId;
    const reviewActor = actor;
    let cancelled = false;
    async function loadSubmission() {
      try {
        const item = await startSubmissionReview(reviewSubmissionId, reviewActor);
        const full = await getPatientSubmissionRemote(item.id, reviewActor);
        if (cancelled) return;
        setSubmission(full);
        setPatientName(full.patientName ?? "");
        setAge(full.age ?? "");
        setSex(full.sex ?? "");
        setNotes(full.notes ?? "");
        if (full.geneticEvidence) {
          setGeneSymbol(full.geneticEvidence.gene_symbol ?? "");
          setVariant(full.geneticEvidence.variant ?? "");
          setClassification(full.geneticEvidence.classification ?? "unknown");
          setZygosity(full.geneticEvidence.zygosity ?? "");
        }
        if (full.photoFileName) {
          downloadSubmissionFile(full.id, "photo", full.photoFileName, reviewActor)
            .then((file) => { if (!cancelled) setPhoto(file); })
            .catch(() => {});
        }
        if (full.labFileName) {
          downloadSubmissionFile(full.id, "lab", full.labFileName, reviewActor)
            .then((file) => { if (!cancelled) setLab(file); })
            .catch(() => {});
        }
      } catch (err) {
        console.warn(err);
        toast.error("Could not load patient submission");
      }
    }
    void loadSubmission();
    return () => {
      cancelled = true;
    };
  }, [actor, submissionId]);

  const addProgress = (msg: string) => {
    setActiveStep(msg);
    setProgress((p) => [...p, msg]);
  };

  const updateSuggestion = (hpoId: string, status: "accepted" | "rejected") => {
    setSuggestions((items) =>
      items.map((item) => item.hpo_id === hpoId ? { ...item, review_status: status } : item)
    );
  };

  const handleSuggest = async () => {
    if (!hasAnyInput) {
      toast.error(t("errorNoInput"));
      return;
    }

    setAnalyzing(true);
    setProgress([]);
    const trimmedNotes = notes.trim();

    try {
      const allTerms: HPOTerm[] = [];

      if (trimmedNotes) {
        allTerms.push(...await suggestNotes(trimmedNotes));
        addProgress(t("progressNotes"));
      }
      if (photo) {
        allTerms.push(...await suggestPhoto(photo, isFacial));
        addProgress(t("progressPhoto"));
      }
      if (lab) {
        try {
          allTerms.push(...await suggestLab(lab));
          addProgress(t("progressLab"));
        } catch (err) {
          console.warn(err);
          toast.error(t("errorLabFailed"));
        }
      }

      if (allTerms.length === 0) {
        toast.error(t("errorNoHpo"));
        setAnalyzing(false);
        return;
      }

      const termMap = new Map<string, HPOTerm>();
      for (const term of [...suggestions, ...allTerms]) {
        const existing = termMap.get(term.hpo_id);
        if (!existing || Math.abs(term.confidence) > Math.abs(existing.confidence)) {
          termMap.set(term.hpo_id, term);
        }
      }
      setSuggestions(Array.from(termMap.values()));
      toast.success(t("suggestionsReady"));
    } catch (err) {
      console.error(err);
      toast.error(t("errorApiFailed"));
    } finally {
      setAnalyzing(false);
    }
  };

  const handleAnalyze = async () => {
    if (!acceptedTerms.length && !geneticEvidence.length) {
      toast.error(t("errorNoAcceptedFindings"));
      return;
    }

    setAnalyzing(true);
    setProgress([]);
    const trimmedNotes = notes.trim();
    const modalities = [
      trimmedNotes ? "notes" : null,
      photo ? "photo" : null,
      lab ? "lab" : null,
      geneticEvidence.length ? "genetic" : null,
    ].filter(Boolean) as string[];
    const analysisTimestamp = new Date().valueOf();
    const intakeSnapshot = {
      timestamp: analysisTimestamp,
      notes: trimmedNotes || undefined,
      photo: photo ? { fileName: photo.name, isFacial } : undefined,
      lab: lab ? { fileName: lab.name } : undefined,
      genetic: geneticEvidence[0],
    };

    try {
      addProgress(t("progressScoring"));
      const termsForScoring = addToId && existingCase
        ? [...existingCase.hpoTerms, ...acceptedTerms]
        : acceptedTerms;
      const termMap = new Map<string, HPOTerm>();
      for (const term of termsForScoring) {
        const existing = termMap.get(term.hpo_id);
        if (!existing || Math.abs(term.confidence) > Math.abs(existing.confidence)) {
          termMap.set(term.hpo_id, { ...term, review_status: "accepted" });
        }
      }
      const dedupedTerms = Array.from(termMap.values());
      const mergedModalities = addToId && existingCase
        ? [...new Set([...existingCase.modalities, ...modalities])]
        : modalities;

      const mergedGeneticEvidence = addToId && existingCase
        ? [...(existingCase.geneticEvidence ?? []), ...geneticEvidence]
        : geneticEvidence;
      const rankings = await scoreCase(dedupedTerms, 10, mergedModalities.length, mergedGeneticEvidence);
      addProgress(t("progressRanking"));

      if (addToId && existingCase) {
        const mergedNotes = [existingCase.notes?.trim(), trimmedNotes].filter(Boolean).join("\n\n");
        const updatedCase = {
          ...existingCase,
          timestamp: analysisTimestamp,
          notes: mergedNotes || existingCase.notes,
          modalities: mergedModalities,
          hpoTerms: dedupedTerms,
          rankings,
          inputHistory: [...(existingCase.inputHistory ?? []), intakeSnapshot],
          geneticEvidence: mergedGeneticEvidence,
          patientContext: { patientName: patientName || undefined, age: age || undefined, sex: sex || undefined },
        };
        updateCaseInStorage(addToId, updatedCase);
        router.push(`/${locale}/case/${addToId}`);
      } else {
        const caseId = uuid();
        const caseData = {
          id: caseId,
          timestamp: analysisTimestamp,
          sourceSubmissionId: submission?.id ?? submissionId ?? undefined,
          notes: trimmedNotes || undefined,
          inputHistory: [intakeSnapshot],
          modalities,
          hpoTerms: dedupedTerms,
          rankings,
          geneticEvidence: mergedGeneticEvidence,
          patientContext: { patientName: patientName || undefined, age: age || undefined, sex: sex || undefined },
        };
        if (actor?.role === "doctor") {
          try {
            await saveCaseRemote(caseData, actor, submission?.id ?? submissionId ?? undefined);
            if (submission?.id ?? submissionId) {
              await completeSubmissionReview(submission?.id ?? submissionId!, caseId, actor);
            }
          } catch (err) {
            console.warn(err);
            toast.error("Saved locally, but could not sync patient submission");
          }
        }
        saveCaseToStorage(caseData);
        router.push(`/${locale}/case/${caseId}`);
      }
    } catch (err) {
      console.error(err);
      toast.error(t("errorApiFailed"));
      setAnalyzing(false);
    }
  };

  function appendSymptom(categoryLabel: string, symptom: string, status: "present" | "absent") {
    const presentLabel = t("present");
    const absentLabel = t("absent");
    const statusLabel = status === "present" ? presentLabel : absentLabel;
    const nextLine = `${categoryLabel}: ${statusLabel} - ${symptom}.`;

    setNotes((prev) => {
      const lines = prev
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
      const symptomPattern = new RegExp(
        `^${categoryLabel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}:\\s+(?:${presentLabel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}|${absentLabel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})\\s+-\\s+${symptom.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\.$`,
        "i",
      );
      const nextLines = lines.filter((line) => !symptomPattern.test(line));
      nextLines.push(nextLine);
      return nextLines.join("\n");
    });

  }

  function symptomState(categoryLabel: string, symptom: string) {
    const normalized = notes.toLowerCase();
    if (normalized.includes(`${categoryLabel.toLowerCase()}: ${t("present").toLowerCase()} - ${symptom.toLowerCase()}.`)) {
      return "present";
    }
    if (normalized.includes(`${categoryLabel.toLowerCase()}: ${t("absent").toLowerCase()} - ${symptom.toLowerCase()}.`)) {
      return "absent";
    }
    return null;
  }

  function toggleCategory(id: string) {
    setOpenCategories((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function startVoiceInput() {
    type SpeechRecognitionCtor = new () => {
      lang: string;
      interimResults: boolean;
      onstart: (() => void) | null;
      onend: (() => void) | null;
      onerror: (() => void) | null;
      onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
      start: () => void;
    };
    const speechWindow = window as typeof window & {
      webkitSpeechRecognition?: SpeechRecognitionCtor;
      SpeechRecognition?: SpeechRecognitionCtor;
    };
    const SpeechRecognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error(t("voiceUnsupported"));
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => {
      setIsListening(false);
      toast.error(t("voiceStopped"));
    };
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0]?.transcript ?? "")
        .join(" ")
        .trim();
      if (transcript) setNotes((prev) => [prev.trim(), transcript].filter(Boolean).join("\n"));
    };
    recognition.start();
  }

  const modalityCards = TABS.map((tabItem) => {
    const state =
      tabItem.id === "notes" ? !!notes.trim() :
      tabItem.id === "photo" ? !!photo :
      tabItem.id === "lab" ? !!lab :
      !!geneSymbol.trim();
    return { ...tabItem, complete: state };
  });

  return (
    <RoleGuard allowed={["doctor"]} redirectTo="/patient">
      <div className="min-h-screen bg-[#fbfcfe] text-[#2f3037]">
      <DashboardNav />

      <main className="mx-auto max-w-6xl px-5 pb-28 pt-24 sm:px-6">
        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease }}
          className="rounded-sm border border-[#e6eaf2] bg-white px-6 py-7 shadow-[0_10px_30px_rgba(34,45,74,0.05)] sm:px-8"
        >
          <p className="text-[12px] font-normal uppercase tracking-[0.08em] text-[#0D1B2A]">{t("doctorWorkspace")}</p>
          <div className="mt-3 grid gap-6 lg:grid-cols-[1fr_320px] lg:items-end">
            <div>
              <h1 className="max-w-2xl text-[38px] font-normal leading-[1.05] tracking-[-0.04em] sm:text-[46px]">
                {addToId && existingCase ? t("titleAdd") : t("startRareDiseaseCase")}
              </h1>
              <p className="mt-4 max-w-2xl text-[16px] leading-7 text-[#5d6474]">
                {t("startRareDiseaseCaseDesc", { brandName: tCommon("brandName") })}
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 rounded-sm border border-[#e6eaf2] bg-[#fbfcfe] p-3">
              <div>
                <p className="text-[24px] font-normal text-[#0D1B2A]">{formatNumber(locale, activeModalities)}/4</p>
                <p className="text-[12px] text-[#667085]">{t("inputsLabel")}</p>
              </div>
              <div>
                <p className="text-[24px] font-normal text-[#0D1B2A]">{pendingTerms.length}</p>
                <p className="text-[12px] text-[#667085]">{t("pendingLabel")}</p>
              </div>
              <div>
                <p className="text-[24px] font-normal text-[#0D1B2A]">{acceptedTerms.length}</p>
                <p className="text-[12px] text-[#667085]">{t("acceptedLabel")}</p>
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <label className="block">
              <span className="mb-1.5 block text-[12px] font-normal text-[#6b7280]">{t("patientName")}</span>
              <input
                value={patientName}
                onChange={(event) => setPatientName(event.target.value)}
                placeholder={t("patientNamePlaceholder")}
                className="h-11 w-full rounded border border-[#d9dfeb] bg-white px-3 text-[14px] outline-none transition focus:border-[#0AAFCE] focus:ring-2 focus:ring-[#0AAFCE]/15"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[12px] font-normal text-[#6b7280]">{t("age")}</span>
              <input
                value={age}
                onChange={(event) => setAge(event.target.value)}
                placeholder={t("agePlaceholder")}
                className="h-11 w-full rounded border border-[#d9dfeb] bg-white px-3 text-[14px] outline-none transition focus:border-[#0AAFCE] focus:ring-2 focus:ring-[#0AAFCE]/15"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[12px] font-normal text-[#6b7280]">{t("sex")}</span>
              <select
                value={sex}
                onChange={(event) => setSex(event.target.value)}
                className="h-11 w-full rounded border border-[#d9dfeb] bg-white px-3 text-[14px] outline-none transition focus:border-[#0AAFCE] focus:ring-2 focus:ring-[#0AAFCE]/15"
              >
                <option value="">{t("sexUnknown")}</option>
                <option value="male">{t("sexMale")}</option>
                <option value="female">{t("sexFemale")}</option>
              </select>
            </label>
          </div>
        </motion.section>

        {addToId && existingCase && (
          <div className="mt-5 rounded border border-[#cfe6f5] bg-[#f2fbff] px-4 py-3 text-[13px] text-[#31566d]">
            {t("addingToCase")} {existingCase.patientContext?.patientName ? `for ${existingCase.patientContext.patientName}` : ""}
          </div>
        )}
        {submission && (
          <div className="mt-5 rounded border border-[#DDE3ED] bg-white px-4 py-3 text-[13px] text-[#31566d]">
            Reviewing patient submission {submission.id.slice(0, 8)}
            {submission.doctorMessage ? ` · last request: ${submission.doctorMessage}` : ""}
          </div>
        )}

        <section className="mt-6 grid items-start gap-6 lg:grid-cols-[1fr_340px]">
          <div className="self-start rounded-sm border border-[#e6eaf2] bg-white shadow-[0_10px_30px_rgba(34,45,74,0.05)]">
            <div className="flex flex-col gap-3 border-b border-[#edf0f5] p-5">
              <div className="flex min-w-0 items-center">
                <h2 className="text-[20px] font-normal tracking-[-0.03em]">{t("inputEvidence")}</h2>
              </div>
              <div className="grid min-w-0 grid-cols-2 gap-1.5 sm:grid-cols-4">
                {TABS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setTab(item.id)}
                    className={`inline-flex h-8 min-w-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-none border px-2 text-[11px] font-normal sm:text-[12px] ${
                      tab === item.id
                        ? "border-[#0D1B2A] bg-[#0D1B2A] text-white"
                        : "border-[#d9dfeb] bg-white text-[#50576a] hover:border-[#0AAFCE]"
                    }`}
                  >
                    <span className="shrink-0">{TAB_ICONS[item.id]}</span>
                    <span className="min-w-0">{item.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="p-5">
              <AnimatePresence mode="wait">
                <motion.div
                  key={tab}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                >
                  {tab === "notes" && (
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <button
                          type="button"
                          onClick={() => setShowChecklist((value) => !value)}
                          className="rounded border border-[#d9dfeb] px-4 py-2 text-[13px] font-normal text-[#343741] hover:border-[#0AAFCE]"
                        >
                          {showChecklist ? t("hideChecklist") : t("quickAdd")}
                        </button>
                        <button
                          type="button"
                          onClick={startVoiceInput}
                          className={`rounded px-4 py-2 text-[13px] font-normal ${
                            isListening ? "bg-emerald-600 text-white" : "bg-[#0AAFCE] text-white"
                          }`}
                        >
                          {isListening ? t("voiceListening") : t("voice")}
                        </button>
                      </div>

                      {showChecklist && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="max-h-[420px] overflow-auto rounded-sm border border-[#e6eaf2] bg-[#f8fbff] p-4"
                        >
                          <p className="mb-4 text-[13px] leading-6 text-[#5d6474]">{t("checklistDesc")}</p>
                          <div className="space-y-4">
                            {SYMPTOM_CATEGORIES.map((category) => (
                              <div key={category.id} className="rounded border border-[#e6eaf2] bg-white p-4">
                                <button
                                  type="button"
                                  onClick={() => toggleCategory(category.id)}
                                  className="flex w-full items-center justify-between text-left text-[13px] font-normal uppercase tracking-[0.04em] text-[#0D1B2A]"
                                >
                                  {t(category.i18nKey)}
                                  <span>{openCategories.has(category.id) ? "-" : "+"}</span>
                                </button>
                                {openCategories.has(category.id) && (
                                  <div className="mt-3 space-y-2">
                                    {category.symptoms.map((symptom) => {
                                      const categoryLabel = t(category.i18nKey);
                                      const symptomLabel = t(symptom.labelKey);
                                      const state = symptomState(categoryLabel, symptomLabel);
                                      return (
                                        <div key={symptom.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded bg-[#fbfcfe] px-3 py-2">
                                          <span className="min-w-0 text-[13px] leading-5 text-[#343741]">{symptomLabel}</span>
                                          <div className="flex shrink-0 gap-1">
                                            <button
                                              type="button"
                                              onClick={() => appendSymptom(categoryLabel, symptomLabel, "present")}
                                              className={`rounded-none px-2.5 py-1 text-[11px] font-normal ${
                                                state === "present" ? "bg-emerald-600 text-white" : "border border-[#d9dfeb] bg-white text-[#50576a]"
                                              }`}
                                            >
                                              {t("present")}
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => appendSymptom(categoryLabel, symptomLabel, "absent")}
                                              className={`rounded-none px-2.5 py-1 text-[11px] font-normal ${
                                                state === "absent" ? "bg-slate-700 text-white" : "border border-[#d9dfeb] bg-white text-[#50576a]"
                                              }`}
                                            >
                                              {t("absent")}
                                            </button>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      )}

                      <textarea
                        value={notes}
                        onChange={(event) => setNotes(event.target.value)}
                        placeholder={t("notesPlaceholder")}
                        rows={12}
                        className="w-full resize-none rounded-sm border border-[#d9dfeb] bg-white px-4 py-4 text-[15px] leading-7 outline-none transition placeholder:text-[#adb5c3] focus:border-[#0AAFCE] focus:ring-2 focus:ring-[#0AAFCE]/15"
                      />
                      <p className="text-[12px] text-[#73798a]">{notes.length} {t("charCount")}</p>
                    </div>
                  )}

                  {tab === "photo" && (
                    <div className="space-y-4">
                      <p className="text-[14px] leading-6 text-[#5d6474]">{t("photoDesc")}</p>
                      <DropZone accept="image/*" label={t("photoDropLabel")} hint={t("photoDropHint")} file={photo} onFile={setPhoto} onClear={() => setPhoto(null)} />
                      <label className="flex items-center gap-2 text-[14px] font-normal leading-6 text-[#5d6474]">
                        <input type="checkbox" checked={isFacial} onChange={(event) => setIsFacial(event.target.checked)} className="h-4 w-4 accent-[#0AAFCE]" />
                        {t("photoFacialToggle")}
                      </label>
                    </div>
                  )}

                  {tab === "lab" && (
                    <div className="space-y-4">
                      <p className="text-[14px] leading-6 text-[#5d6474]">{t("labDesc")}</p>
                      <DropZone accept="image/*,.pdf" label={t("labDropLabel")} hint={t("labDropHint")} file={lab} onFile={setLab} onClear={() => setLab(null)} />
                    </div>
                  )}

                  {tab === "genetic" && (
                    <div className="space-y-5">
                      <p className="text-[14px] leading-6 text-[#5d6474]">{t("geneticDesc")}</p>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <input value={geneSymbol} onChange={(event) => setGeneSymbol(event.target.value)} placeholder={t("genePlaceholder")} className="h-12 rounded border border-[#d9dfeb] px-3 text-[14px] outline-none focus:border-[#0AAFCE]" />
                        <input value={variant} onChange={(event) => setVariant(event.target.value)} placeholder={t("variantPlaceholder")} className="h-12 rounded border border-[#d9dfeb] px-3 text-[14px] outline-none focus:border-[#0AAFCE]" />
                        <select value={classification} onChange={(event) => setClassification(event.target.value)} className="h-12 rounded border border-[#d9dfeb] bg-white px-3 text-[14px] outline-none focus:border-[#0AAFCE]">
                          <option value="unknown">{t("classificationUnknown")}</option>
                          <option value="pathogenic">{t("classificationPathogenic")}</option>
                          <option value="likely_pathogenic">{t("classificationLikelyPathogenic")}</option>
                          <option value="vus">{t("classificationVus")}</option>
                          <option value="benign">{t("classificationBenign")}</option>
                        </select>
                        <input value={zygosity} onChange={(event) => setZygosity(event.target.value)} placeholder={t("zygosityPlaceholder")} className="h-12 rounded border border-[#d9dfeb] px-3 text-[14px] outline-none focus:border-[#0AAFCE]" />
                      </div>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          <aside className="space-y-5">
            <div className="rounded-sm border border-[#e6eaf2] bg-white p-5 shadow-[0_10px_30px_rgba(34,45,74,0.05)]">
              <h3 className="text-[13px] font-normal uppercase tracking-[0.08em] text-[#0D1B2A]">{t("sidebarInputs")}</h3>
              <div className="mt-4 space-y-3">
                {modalityCards.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setTab(item.id)}
                    className="flex w-full items-center justify-between rounded border border-[#edf0f5] px-3 py-3 text-left hover:border-[#0AAFCE]"
                  >
                    <span className="flex items-center gap-2 text-[14px] font-normal text-[#343741]">
                      {TAB_ICONS[item.id]}
                      {item.label}
                    </span>
                    <span className={`h-2.5 w-2.5 rounded-none ${item.complete ? "bg-emerald-500" : "bg-[#c8cfdd]"}`} />
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-sm border border-[#e6eaf2] bg-white p-5 shadow-[0_10px_30px_rgba(34,45,74,0.05)]">
              <h3 className="text-[13px] font-normal uppercase tracking-[0.08em] text-[#0D1B2A]">{t("reviewFindings")}</h3>
              <div className="mt-4 space-y-5">
                <div>
                  <p className="text-[12px] font-normal uppercase text-[#73798a]">{t("pendingSuggestions")} ({pendingTerms.length})</p>
                  <div className="mt-2 max-h-72 space-y-2 overflow-auto pr-1">
                    {pendingTerms.length === 0 && <p className="rounded border border-dashed border-[#d9dfeb] p-4 text-[13px] text-[#73798a]">{t("noPendingSuggestions")}</p>}
                    {pendingTerms.map((term) => (
                      <div key={term.hpo_id} className="rounded border border-[#e6eaf2] p-3">
                        <p className="text-[13px] font-normal" title={`${term.hpo_id}\n${term.definition ?? ""}\nSource: ${term.source}`}>
                          {localizeHpoLabel(term.hpo_id, term.label, messages)}
                        </p>
                        <p className="mt-1 truncate text-[11px] text-[#73798a]">{term.hpo_id} · {term.source}</p>
                        <div className="mt-3 flex gap-2">
                          <button type="button" onClick={() => updateSuggestion(term.hpo_id, "accepted")} className="rounded bg-emerald-600 px-3 py-1.5 text-[12px] font-normal text-white">{t("accept")}</button>
                          <button type="button" onClick={() => updateSuggestion(term.hpo_id, "rejected")} className="rounded border border-[#d9dfeb] px-3 py-1.5 text-[12px] font-normal text-[#50576a]">{t("reject")}</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[12px] font-normal uppercase text-[#73798a]">{t("acceptedFindings")} ({acceptedTerms.length})</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {acceptedTerms.map((term) => (
                      <span key={term.hpo_id} className="rounded-none border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-normal text-emerald-800">
                        {localizeHpoLabel(term.hpo_id, term.label, messages)}
                      </span>
                    ))}
                  </div>
                </div>
                <p className="text-[12px] font-normal uppercase text-[#73798a]">{t("rejectedFindings")} ({rejectedTerms.length})</p>
                {geneticEvidence.length > 0 && (
                  <div className="rounded bg-[#f8fbff] p-3 text-[13px]">
                    <p className="font-normal text-[#0D1B2A]">{geneticEvidence[0].gene_symbol} · {geneticEvidence[0].classification}</p>
                    {geneticEvidence[0].variant && <p className="mt-1 text-[#5d6474]">{geneticEvidence[0].variant}</p>}
                  </div>
                )}
              </div>
            </div>

            {analyzing && (
              <div className="rounded-sm border border-[#cfe6f5] bg-[#f3fbff] p-5">
                <h3 className="text-[13px] font-normal uppercase tracking-[0.08em] text-[#0D1B2A]">{t("sidebarProgress")}</h3>
                <div className="mt-4 space-y-2">
                  {progress.map((step) => (
                    <ProgressStep key={step} label={step} active={step === activeStep} done={step !== activeStep} />
                  ))}
                  {activeStep && progress[progress.length - 1] === activeStep && <ProgressStep label={activeStep} active done={false} />}
                </div>
              </div>
            )}
          </aside>
        </section>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#e6eaf2] bg-white/95 px-5 py-3 shadow-[0_-8px_28px_rgba(34,45,74,0.08)] backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-[13px] text-[#5d6474]">
            {t("modalitiesActive", { active: activeModalities, total: 4 })} · {t("pendingLabel")} {formatNumber(locale, pendingTerms.length)} · {t("acceptedLabel")} {formatNumber(locale, acceptedTerms.length)}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              onClick={handleSuggest}
              disabled={!hasAnyInput || analyzing}
              className="h-11 rounded bg-[#0AAFCE] px-6 text-[14px] font-normal text-white hover:bg-[#24a6dc] disabled:opacity-60"
            >
              {analyzing ? t("analyzing") : t("suggestFindings")}
            </Button>
            <Button
              onClick={handleAnalyze}
              disabled={(!acceptedTerms.length && !geneticEvidence.length) || analyzing}
              className="h-11 rounded bg-[#0D1B2A] px-6 text-[14px] font-normal text-white hover:bg-[#1f2d86] disabled:opacity-60"
            >
              {t("runDifferential")}
            </Button>
          </div>
        </div>
      </div>
      </div>
    </RoleGuard>
  );
}
