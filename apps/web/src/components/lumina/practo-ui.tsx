"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { useAuth, useUser } from "@clerk/nextjs";
import { Check, FileText, FlaskConical, Image as ImageIcon, PencilLine, ShieldCheck, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslations, useLocale } from "next-intl";
import { readStoredUserRole } from "@/lib/user-role";

/* -- Logo -------------------------------------------------------------------- */
export function LuminaLogo({ className, footer = false }: { className?: string; footer?: boolean }) {
  const size = footer ? 36 : 28;
  const t = useTranslations("common");
  const brandName = t("brandName");
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 select-none",
        footer ? "gap-3" : "gap-2",
        className
      )}
      aria-label={brandName}
    >
      <svg width={size} height={size} viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
        <path d="M14 0L16.2 11.8L28 14L16.2 16.2L14 28L11.8 16.2L0 14L11.8 11.8L14 0Z" fill="#06B6D4"/>
        <circle cx="14" cy="14" r="3" fill={footer ? "#0f172a" : "#FFFFFF"}/>
      </svg>
      <span className={cn(
        "font-normal tracking-tight leading-none",
        footer ? "text-white text-[24px]" : "text-slate-900 dark:text-white text-[20px]"
      )}>
        {brandName}
      </span>
    </span>
  );
}

/* -- Footer ------------------------------------------------------------------ */
export function MarketingFooter() {
  const t = useTranslations("nav");
  const tc = useTranslations("common");
  const tl = useTranslations("landing");
  const { isSignedIn } = useAuth();
  const { user } = useUser();
  const locale = useLocale();
  const brandName = tc("brandName");
  const [storedRole] = useState<"doctor" | "patient">(() => readStoredUserRole());

  const role = user?.publicMetadata?.role === "patient" ? "patient" : user?.publicMetadata?.role === "doctor" ? "doctor" : storedRole;

  const clinicalLinks =
    isSignedIn && role === "patient"
      ? [
          { label: t("patientDashboard"), href: "patient" },
          { label: t("newSubmission"), href: "patient/new" },
          { label: t("submissions"), href: "patient/submissions" },
          { label: t("reports"), href: "patient/reports" },
        ]
      : isSignedIn
        ? [
            { label: t("docDashboard"), href: "dashboard" },
            { label: t("newCase"), href: "new-case" },
            { label: t("cases"), href: "cases" },
            { label: t("docProfile"), href: "settings/profile" },
          ]
        : [
            { label: t("doctorWorkspace"), href: "doctor-workspace" },
            { label: t("docProfile"), href: "doctor-profile-info" },
            { label: t("scorecardReview"), href: "scorecard-review" },
            { label: t("referralLetters"), href: "referral-letters" },
          ];

  const groups = [
    {
      title: brandName,
      links: [
        { label: t("about"), href: "about" },
        { label: t("clinicalBeta"), href: "clinical-beta" },
        { label: t("support"), href: "support" },
      ],
    },
    {
      title: isSignedIn && role === "patient" ? t("forPatients") : t("forClinics"),
      links:
        isSignedIn && role === "patient"
          ? [
              { label: t("patientPreIntake"), href: "patient-pre-intake" },
              { label: t("newSubmission"), href: "patient/new" },
              { label: t("submissions"), href: "patient/submissions" },
              { label: t("reports"), href: "patient/reports" },
            ]
          : [
              { label: tl("step1Title"), href: "doctor-workspace" },
              { label: t("hpoWorkflow"), href: "hpo-workflow" },
              { label: t("referralLetters"), href: "referral-letters" },
              { label: t("docDashboard"), href: "doctor-dashboard-info" },
            ],
    },
    {
      title: tl("modalityLabel"),
      links: [
        { label: tl("clinicalNotes.title"), href: "clinical-notes" },
        { label: tl("modalityPhotoTitle"), href: "clinical-photos" },
        { label: tl("modalityLabTitle"), href: "lab-reports" },
        { label: tl("modalityDnaTitle"), href: "genetic-evidence" },
      ],
    },
    {
      title: tl("scienceLabel"),
      links: [
        { label: tc("orphanet"), href: "orphanet" },
        { label: tc("hpoOntology"), href: "hpo-ontology" },
        { label: tc("clinvar"), href: "clinvar" },
      ],
    },
    {
      title: t("securityHelp"),
      links: [
        { label: t("support"), href: "support" },
        { label: t("privacy"), href: "privacy" },
        { label: t("terms"), href: "terms" },
        { label: t("security"), href: "security" },
      ],
    },
    {
      title: t("clinical"),
      links: clinicalLinks,
    },
  ];

  return (
    <footer className="mt-14 bg-[#0D1B2A] text-white sm:mt-20">
      <div className="mx-auto max-w-[1200px] px-4 py-10 sm:px-6 sm:py-14 lg:py-16">
        <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 sm:gap-x-6 sm:gap-y-10 lg:grid-cols-6">
          {groups.map((group) => (
            <div key={group.title}>
              <h3 className="mb-4 text-[13px] font-normal leading-tight text-white sm:text-[13.5px]">{group.title}</h3>
              <ul className="space-y-2.5 text-[13px] leading-tight text-white/75 sm:text-[13.5px]">
                {group.links.map((link) => (
                  <li key={link.label}>
                    <Link href={`/${locale}/${link.href}`} className="transition-colors hover:text-white">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-10 flex flex-col items-center gap-3 border-t border-white/10 pt-8 text-center sm:mt-14 sm:pt-10">
          <LuminaLogo footer />
          <p className="max-w-xs text-[11px] text-white/40 sm:max-w-none sm:text-[12px]">
            {tl("footerTagline")} · {tl("betaPill")}
          </p>
        </div>
      </div>
    </footer>
  );
}

/* -- Service card ------------------------------------------------------------ */
export function ServiceCard({
  image,
  title,
  description,
  href,
  objectPosition = "center center",
}: {
  image: string;
  title: string;
  description: string;
  href: string;
  objectPosition?: string;
}) {
  const tl = useTranslations("landing");
  return (
    <Link
      href={href}
      className="group overflow-hidden rounded-2xl border border-[#DDE3ED] bg-white transition-all hover:border-[#0AAFCE] hover:shadow-[0_6px_20px_rgba(10,175,206,0.12)]"
    >
      <div className="relative h-44 w-full bg-[#E5F8FC]">
        <Image
          src={image}
          alt=""
          fill
          sizes="(max-width: 640px) 47vw, (max-width: 1024px) 45vw, 260px"
          className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          style={{ objectPosition }}
        />
      </div>
      <div className="p-4 sm:p-5">
        <h3 className="text-[14px] font-normal leading-snug tracking-[-0.01em] text-[#0D1B2A] sm:text-[15px]">{title}</h3>
        <p className="mt-2 text-[12px] leading-5 text-[#4A5568] sm:text-[13px]">{description}</p>
        <span className="mt-3 inline-flex items-center gap-1 text-[12px] font-normal text-[#0AAFCE] sm:mt-4 sm:text-[12.5px]">
          {tl("howItWorks")}
          <svg className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 16 16" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 8h10m-4-4 4 4-4 4" />
          </svg>
        </span>
      </div>
    </Link>
  );
}

/* -- Evidence module icons --------------------------------------------------- */
type EvidenceKind = "notes" | "photos" | "labs" | "genetics" | "approval" | "letter";

const EVIDENCE_ILLUSTRATED: Record<EvidenceKind, { icon: ReactNode; circleBg: string }> = {
  notes: {
    circleBg: "#E9EEFC",
    icon: (
      <svg viewBox="0 0 124 124" fill="none" className="h-[124px] w-[124px]">
        <rect x="35" y="28" width="31" height="42" rx="4" fill="#FFFFFF" stroke="#C8D3EF" strokeWidth="2" />
        <path d="M44 42h17M44 52h17M44 62h12" stroke="#8FA3D8" strokeWidth="3" strokeLinecap="square" />
        <g transform="rotate(-26 70 75)">
          <rect x="66" y="63" width="9" height="27" rx="4.5" fill="#39B8EA" />
          <path d="M66 86h9l-4.5 8-4.5-8Z" fill="#218FBA" />
        </g>
      </svg>
    ),
  },

  photos: {
    circleBg: "#E9EEFC",
    icon: (
      <svg viewBox="0 0 124 124" fill="none" className="h-[124px] w-[124px]">
        <rect x="32" y="37" width="60" height="52" rx="7" fill="#FFFFFF" stroke="#C8D3EF" strokeWidth="2" />
        <circle cx="50" cy="55" r="9" fill="#39B8EA" />
        <path d="M38 82 57 64l12 14 10-10 17 14H38Z" fill="#39B8EA" />
        <path d="M38 82 57 64l12 14" stroke="#B9D9F1" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },

  labs: {
    circleBg: "#E9EEFC",
    icon: (
      <svg viewBox="0 0 124 124" fill="none" className="h-[124px] w-[124px]">
        <rect x="39" y="28" width="46" height="68" rx="6" fill="#FFFFFF" stroke="#C8D3EF" strokeWidth="2" />
        <path d="M51 45h26M51 58h22M51 71h12" stroke="#8FA3D8" strokeWidth="3" strokeLinecap="square" />
        <circle cx="54" cy="82" r="9" fill="#BDEAF6" />
        <circle cx="74" cy="82" r="9" fill="#39B8EA" />
      </svg>
    ),
  },

  genetics: {
    circleBg: "#E9EEFC",
    icon: (
      <svg viewBox="0 0 124 124" fill="none" className="h-[124px] w-[124px]">
        <path
          d="M48 24c23 22 33 53 12 76"
          stroke="#2D358F"
          strokeWidth="4"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M76 24C53 46 43 77 64 100"
          stroke="#39B8EA"
          strokeWidth="4"
          strokeLinecap="round"
          fill="none"
        />
        <path d="M49 35h27M44 51h38M43 68h38M49 85h27" stroke="#8FA3D8" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    ),
  },

  approval: {
    circleBg: "#E9EEFC",
    icon: (
      <svg viewBox="0 0 124 124" fill="none" className="h-[124px] w-[124px]">
        <circle cx="62" cy="62" r="33" fill="#FFFFFF" fillOpacity="0.65" stroke="#C8D3EF" strokeWidth="2" />
        <path
          d="M44 63 57 76 83 46"
          stroke="#39B8EA"
          strokeWidth="7"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
    ),
  },

  letter: {
    circleBg: "#E9EEFC",
    icon: (
      <svg viewBox="0 0 124 124" fill="none" className="h-[124px] w-[124px]">
        <rect x="33" y="43" width="58" height="38" rx="5" fill="#FFFFFF" stroke="#C8D3EF" strokeWidth="2" />
        <path d="M36 46 62 66 88 46" stroke="#C8D3EF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M36 79 56 62M88 79 68 62" stroke="#D9E1F4" strokeWidth="2" strokeLinecap="round" />
        <circle cx="88" cy="82" r="13" fill="#39B8EA" />
        <circle cx="88" cy="82" r="6" fill="#E9EEFC" />
      </svg>
    ),
  },
};

export function EvidenceModuleCard({
  kind,
  title,
  action,
}: {
  kind: EvidenceKind;
  title: string;
  action: string;
}) {
  const { icon, circleBg } = EVIDENCE_ILLUSTRATED[kind];
  return (
    <div className="flex w-[112px] flex-col items-center text-center sm:w-[170px]">
      <div
        className="flex h-[92px] w-[92px] items-center justify-center rounded-full sm:h-[124px] sm:w-[124px]"
        style={{ backgroundColor: circleBg }}
      >
        <span className="flex scale-[0.74] sm:scale-100">
          {icon}
        </span>
      </div>
      <span className="mt-3 flex h-10 w-full max-w-[150px] items-start justify-center text-[12px] font-normal leading-tight text-[#343741] sm:mt-4 sm:h-[34px] sm:text-[14px]">
        {title}
      </span>
      <span className="mt-2 text-[12px] font-normal leading-tight text-[#14AEEF] sm:text-[14px]">{action}</span>
    </div>
  );
}

/* -- Dashboard shell --------------------------------------------------------- */

export function DashboardShell({
  title,
  subtitle,
  tabs,
  activeTab,
  onTabChange,
  children,
}: {
  title: string;
  subtitle: string;
  tabs: string[];
  activeTab: string;
  onTabChange: (tab: string) => void;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto max-w-[1200px] px-6 pb-24 pt-28">
      <div className="mb-8 flex flex-col gap-1.5">
        <h1 className="text-[36px] font-normal tracking-[-0.03em] text-[#0D1B2A]">{title}</h1>
        <p className="max-w-2xl text-[15px] leading-7 text-[#4A5568]">{subtitle}</p>
      </div>
      <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
        <aside className="rounded-xl border border-[#DDE3ED] bg-white p-2 lg:sticky lg:top-24 lg:self-start">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => onTabChange(tab)}
              className={cn(
                "mb-0.5 flex w-full items-center rounded-lg px-4 py-2.5 text-left text-[13.5px] font-normal transition-colors",
                activeTab === tab
                  ? "bg-[#E5F8FC] text-[#0D1B2A]"
                  : "text-[#4A5568] hover:bg-[#F7F8FA] hover:text-[#0D1B2A]"
              )}
            >
              {tab}
            </button>
          ))}
        </aside>
        <section className="min-w-0">{children}</section>
      </div>
    </main>
  );
}

/* -- Case table -------------------------------------------------------------- */
export function CaseTable({
  rows,
}: {
  rows: Array<{ id: string; patient: string; status: string; updated: string; hpo: number; top: string }>;
}) {
  const t = useTranslations("landing");
  const headers = [t("case"), t("patient"), t("status"), t("acceptedHpo"), t("topResult"), t("updated")];
  return (
    <div className="overflow-hidden rounded-xl border border-[#DDE3ED] bg-white">
      <table className="w-full min-w-[720px] text-left text-[13.5px]">
        <thead className="border-b border-[#DDE3ED] bg-[#F7F8FA]">
          <tr>
            {headers.map((h) => (
              <th key={h} className="px-5 py-3 text-[11px] font-normal uppercase tracking-[0.08em] text-[#8A94A6]">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#F0F2F5]">
          {rows.map((row) => (
            <tr key={row.id} className="transition-colors hover:bg-[#F7F8FA]">
              <td className="px-5 py-4 font-normal text-[#0AAFCE]">{row.id}</td>
              <td className="px-5 py-4 text-[#0D1B2A]">{row.patient}</td>
              <td className="px-5 py-4">
                <span className="badge badge-cyan">{row.status}</span>
              </td>
              <td className="px-5 py-4 text-[#0D1B2A]">{row.hpo}</td>
              <td className="px-5 py-4 text-[#0D1B2A]">{row.top}</td>
              <td className="px-5 py-4 text-[#8A94A6]">{row.updated}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* -- HPO Approval queue ------------------------------------------------------ */
export function HpoApprovalQueue() {
  const t = useTranslations("landing");
  const [suggestions, setSuggestions] = useState([
    { term: t("hpoSuggestion1"), source: t("sourceNotes"), confidence: "High" },
    { term: t("hpoSuggestion2"), source: t("sourceHistory"), confidence: "Medium" },
    { term: t("hpoSuggestion3"), source: t("sourceGrowth"), confidence: "High" },
    { term: t("hpoSuggestion4"), source: t("sourceLab"), confidence: "Review" },
  ]);

  const confidenceLabels: Record<string, string> = {
    High: t("confHigh"),
    Medium: t("confMedium"),
    Review: t("confReview"),
  };
  const [accepted, setAccepted] = useState<string[]>([]);
  const [rejected, setRejected] = useState<string[]>([]);

  function mark(term: string, status: "accepted" | "rejected") {
    if (status === "accepted") {
      setAccepted((items) => [...new Set([...items, term])]);
      setRejected((items) => items.filter((item) => item !== term));
    } else {
      setRejected((items) => [...new Set([...items, term])]);
      setAccepted((items) => items.filter((item) => item !== term));
    }
  }

  return (
    <div className="space-y-2.5">
      {suggestions.map((item) => {
        const isAccepted = accepted.includes(item.term);
        const isRejected = rejected.includes(item.term);
        return (
          <div
            key={item.term}
            className={cn(
              "rounded-xl border bg-white p-4 transition-colors",
              isAccepted ? "border-[#1A7F4B]" : isRejected ? "border-[#C0392B]" : "border-[#DDE3ED]"
            )}
          >
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-[14px] font-normal text-[#0D1B2A]">{item.term}</h3>
                  {isAccepted && <span className="badge badge-accepted">{t("accepted")}</span>}
                  {isRejected && <span className="badge badge-rejected">{t("rejected")}</span>}
                </div>
                <p className="mt-1 text-[12.5px] text-[#8A94A6]">
                  {item.source} ·{" "}
                  <span className={cn(
                    "font-normal",
                    item.confidence === "High" ? "text-[#1A7F4B]" : item.confidence === "Medium" ? "text-[#D4860A]" : "text-[#8A94A6]"
                  )}>
                    {confidenceLabels[item.confidence]} {t("confidence")}
                  </span>
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => mark(item.term, "accepted")}
                  className="rounded-lg border border-[#1A7F4B] px-4 py-1.5 text-[12.5px] font-normal text-[#1A7F4B] transition-colors hover:bg-[#EDFAF3]"
                >
                  {t("accept")}
                </button>
                <button
                  type="button"
                  onClick={() => mark(item.term, "rejected")}
                  className="rounded-lg border border-[#C0392B] px-4 py-1.5 text-[12.5px] font-normal text-[#C0392B] transition-colors hover:bg-[#FDEEEC]"
                >
                  {t("reject")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const next = window.prompt(t("editHpoPrompt"), item.term);
                    if (!next) return;
                    setSuggestions((items) =>
                      items.map((s) => (s.term === item.term ? { ...s, term: next } : s))
                    );
                  }}
                  className="rounded-lg border border-[#DDE3ED] px-4 py-1.5 text-[12.5px] font-normal text-[#4A5568] transition-colors hover:bg-[#F7F8FA]"
                >
                  {t("edit")}
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* -- Patient status timeline ------------------------------------------------- */
export function PatientStatusTimeline({ status }: { status?: string }) {
  const t = useTranslations("landing");
  const steps = [t("submitted"), t("doctorReviewPending"), t("approved"), t("scorecardReady")];
  const activeIndex = Math.max(0, steps.indexOf(status || ""));
  return (
    <div className="rounded-xl border border-[#DDE3ED] bg-white p-6">
      <div className="relative flex items-start justify-between">
        {/* connecting line */}
        <div className="absolute left-4 right-4 top-4 h-px bg-[#DDE3ED]" />
        {steps.map((step, index) => {
          const done = index <= activeIndex;
          const active = index === activeIndex;
          return (
            <div key={step} className="relative z-10 flex flex-col items-center gap-2" style={{ flex: 1 }}>
              <span
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full border-2 text-[12px] font-normal transition-colors",
                  done
                    ? "border-[#1A7F4B] bg-[#1A7F4B] text-white"
                    : active
                    ? "border-[#0AAFCE] bg-[#0AAFCE] text-white"
                    : "border-[#DDE3ED] bg-white text-[#8A94A6]"
                )}
              >
                {done ? <Check className="h-3.5 w-3.5" /> : index + 1}
              </span>
              <span className={cn(
                "text-center text-[11.5px] font-normal leading-tight",
                active ? "text-[#0D1B2A]" : done ? "text-[#1A7F4B]" : "text-[#8A94A6]"
              )}>
                {step}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* -- Intake upload card ------------------------------------------------------ */
export function IntakeUploadCard({
  icon,
  title,
  description,
  href,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  href?: string;
}) {
  const t = useTranslations("landing");
  const body = (
    <>
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-[#E5F8FC] text-[#0AAFCE]">{icon}</div>
      <h3 className="text-[15px] font-normal tracking-[-0.01em] text-[#0D1B2A]">{title}</h3>
      <p className="mt-1.5 min-h-[44px] text-[13px] leading-5 text-[#4A5568]">{description}</p>
      <span className="mt-4 block w-full rounded-lg border border-dashed border-[#DDE3ED] bg-[#F7F8FA] px-4 py-3 text-center text-[13px] font-normal text-[#4A5568]">
        {t("uploadEvidence")}
      </span>
    </>
  );

  if (href) {
    return (
      <Link href={href} className="block rounded-xl border border-[#DDE3ED] bg-white p-5 transition-all hover:border-[#0AAFCE] hover:shadow-[0_4px_14px_rgba(10,175,206,0.10)]">
        {body}
      </Link>
    );
  }

  return (
    <div className="rounded-xl border border-[#DDE3ED] bg-white p-5">
      {body}
    </div>
  );
}

export const dashboardIcons = { FileText, ImageIcon, FlaskConical, PencilLine, ShieldCheck, Users };
