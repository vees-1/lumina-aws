"use client";

import { useTranslations } from "next-intl";
import { renderToStaticMarkup } from "react-dom/server";
import type { CaseData, PatientSubmission } from "@/types/lumina";

export interface DoctorLetterProfile {
  name?: string;
  specialty?: string;
  specialization?: string;
  degree?: string;
  clinic?: string;
  license?: string;
  contact?: string;
  signature?: string;
  signatureImage?: string;
}

interface LetterSheetLabels {
  brandTitle: string;
  patientId: string;
  license: string;
  patient: string;
  age: string;
  sex: string;
}

const DEFAULT_LABELS: LetterSheetLabels = {
  brandTitle: "Lumina Clinical Referral",
  patientId: "Patient ID",
  license: "License",
  patient: "Patient",
  age: "Age",
  sex: "Sex",
};

function stripMarkdown(line: string) {
  return line.replace(/^#{1,6}\s*/, "").replace(/\*\*/g, "").trim();
}

function renderLine(line: string, index: number) {
  const trimmed = line.trim();
  if (!trimmed) return null;
  if (/^#\s+/.test(trimmed)) {
    return <h1 key={index} className="letter-title">{stripMarkdown(trimmed)}</h1>;
  }
  if (/^#{2,6}\s+/.test(trimmed)) {
    return <h2 key={index} className="letter-heading">{stripMarkdown(trimmed)}</h2>;
  }
  if (/^[-*]\s+/.test(trimmed)) {
    return <li key={index}>{stripMarkdown(trimmed.replace(/^[-*]\s+/, ""))}</li>;
  }
  if (trimmed === "---") return <div key={index} className="letter-rule" />;
  return <p key={index}>{stripMarkdown(trimmed)}</p>;
}

const LETTER_PRINT_CSS = `
body{margin:0;background:#f3f4f6;padding:24px}
.referral-sheet{position:relative;width:794px;min-height:1123px;margin:0 auto;overflow:hidden;background:#fff;border:1px solid #E1E6EF;color:#111827;font-family:"Times New Roman",Georgia,serif;font-size:12px;line-height:1.34;padding:34px 42px;box-sizing:border-box}
.letter-watermark{position:absolute;inset:43% auto auto 50%;transform:translate(-50%,-50%) rotate(-28deg);font-size:86px;letter-spacing:.08em;color:rgba(6,182,212,.055);text-transform:uppercase;pointer-events:none}
.letter-top{display:flex;justify-content:space-between;gap:28px;border-bottom:1px solid #111827;padding-bottom:10px}
.letter-brand{margin:0 0 4px;font-family:Arial,sans-serif;font-size:14px;font-weight:700;letter-spacing:.08em;text-transform:uppercase}
.letter-meta{margin:0;font-family:Arial,sans-serif;font-size:10px;color:#4B5563}
.letter-doctor{display:grid;gap:1px;max-width:260px;text-align:right;font-family:Arial,sans-serif;font-size:10px;color:#374151}
.letter-patient-strip{display:flex;flex-wrap:wrap;gap:6px 16px;margin:10px 0 12px;border:1px solid #D7DEE9;background:#F8FAFC;padding:7px 9px;font-size:10.5px}
.letter-title{margin:2px 0 10px!important;text-align:center;font-size:17px;letter-spacing:.08em;text-transform:uppercase}
.letter-heading{margin:8px 0 4px!important;border-bottom:1px solid #E5E7EB;padding-bottom:2px;font-family:Arial,sans-serif;font-size:10px;letter-spacing:.08em;text-transform:uppercase}
.letter-body p,.letter-body h1,.letter-body h2,.letter-body li{margin:0 0 6px}
.letter-body ul{margin:3px 0 6px 18px;padding:0}
.letter-rule{height:1px;margin:8px 0;background:#E5E7EB}
.letter-signature{position:absolute;right:42px;bottom:26px;left:42px;display:flex;justify-content:flex-end;border-top:1px solid #E5E7EB;padding-top:8px;font-size:10px}
.letter-signature img{display:block;max-height:42px;max-width:170px;object-fit:contain;margin-left:auto}
.letter-signature-text{max-width:240px;margin:0 0 3px;white-space:pre-wrap;color:#4B5563}
@page{size:A4;margin:8mm}
@media print{body{background:#fff!important;padding:0!important}.referral-sheet{border:0;width:194mm;min-height:281mm;padding:8mm 10mm}}
@media print{body.lumina-letter-printing>*:not(#lumina-print-root){display:none!important}#lumina-print-root{display:block!important}}
`;

export function printWithTitle(title: string, html?: string) {
  const previousTitle = document.title;
  const existingRoot = document.getElementById("lumina-print-root");
  existingRoot?.remove();
  document.getElementById("lumina-print-style")?.remove();

  const style = document.createElement("style");
  style.id = "lumina-print-style";
  style.textContent = LETTER_PRINT_CSS;
  document.head.appendChild(style);

  const root = document.createElement("div");
  root.id = "lumina-print-root";
  root.style.display = "none";
  root.innerHTML = html ?? "";
  document.body.appendChild(root);

  const cleanup = () => {
    document.body.classList.remove("lumina-letter-printing");
    document.title = previousTitle;
    window.setTimeout(() => {
      root.remove();
      style.remove();
    }, 250);
  };

  document.title = title;
  document.body.classList.add("lumina-letter-printing");
  window.onafterprint = cleanup;
  window.print();
  window.setTimeout(cleanup, 1500);
}

export async function downloadLetterPdf(fileName: string, payload: {
  letter: string;
  caseData?: CaseData | null;
  doctorProfile?: DoctorLetterProfile | null;
  submissionId?: string | null;
}) {
  const res = await fetch("/api/agent/letter-pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      letter: payload.letter,
      case_data: payload.caseData ?? {},
      doctor_profile: payload.doctorProfile ?? {},
      submission_id: payload.submissionId ?? undefined,
    }),
  });
  if (!res.ok) throw new Error("PDF generation failed");
  const blob = await res.blob();
  if (blob.type && !blob.type.includes("pdf")) throw new Error("PDF generation failed");
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function useDoctorLetterProfile(): DoctorLetterProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const saved = localStorage.getItem("lumina_doc_info") ?? localStorage.getItem("lumina_doctor_profile");
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
}

export function ReferralLetterSheet({
  letter,
  caseData,
  submission,
  doctorProfile,
  className = "",
}: {
  letter: string;
  caseData?: CaseData | null;
  submission?: PatientSubmission | null;
  doctorProfile?: DoctorLetterProfile | null;
  className?: string;
}) {
  const t = useTranslations("letterSheet");
  return (
    <ReferralLetterSheetMarkup
      letter={letter}
      caseData={caseData}
      submission={submission}
      doctorProfile={doctorProfile}
      className={className}
      labels={{
        brandTitle: t("brandTitle"),
        patientId: t("patientId"),
        license: t("license"),
        patient: t("patient"),
        age: t("age"),
        sex: t("sex"),
      }}
    />
  );
}

function ReferralLetterSheetMarkup({
  letter,
  caseData,
  submission,
  doctorProfile,
  className = "",
  labels = DEFAULT_LABELS,
}: {
  letter: string;
  caseData?: CaseData | null;
  submission?: PatientSubmission | null;
  doctorProfile?: DoctorLetterProfile | null;
  className?: string;
  labels?: LetterSheetLabels;
}) {
  const patientId = submission?.id ?? caseData?.sourceSubmissionId ?? caseData?.id ?? "patient";
  const patientName = caseData?.patientContext?.patientName ?? submission?.patientName ?? "Patient";
  const doctorName = doctorProfile?.name || "Referring clinician";
  const specialty = doctorProfile?.specialty || doctorProfile?.specialization;

  return (
    <article className={`referral-sheet ${className}`}>
      <div className="letter-watermark">Lumina</div>
      <header className="letter-top">
        <div>
          <p className="letter-brand">{labels.brandTitle}</p>
          <p className="letter-meta">{labels.patientId}: {patientId}</p>
        </div>
        <div className="letter-doctor">
          <strong>{doctorName}</strong>
          {specialty && <span>{specialty}</span>}
          {doctorProfile?.clinic && <span>{doctorProfile.clinic}</span>}
          {doctorProfile?.license && <span>{labels.license}: {doctorProfile.license}</span>}
          {doctorProfile?.contact && <span>{doctorProfile.contact}</span>}
        </div>
      </header>
      <section className="letter-patient-strip">
        <span>{labels.patient}: {patientName}</span>
        {caseData?.patientContext?.age && <span>{labels.age}: {caseData.patientContext.age}</span>}
        {caseData?.patientContext?.sex && <span>{labels.sex}: {caseData.patientContext.sex}</span>}
      </section>
      <section className="letter-body">
        {letter.split("\n").map(renderLine)}
      </section>
      <footer className="letter-signature">
        <div>
          {doctorProfile?.signatureImage && (
            <img src={doctorProfile.signatureImage} alt="Doctor signature" />
          )}
          {doctorProfile?.signature && <p className="letter-signature-text">{doctorProfile.signature}</p>}
          <p>{doctorName}</p>
        </div>
      </footer>
    </article>
  );
}

export function renderLetterSheetHtml(props: Parameters<typeof ReferralLetterSheet>[0]) {
  return renderToStaticMarkup(<ReferralLetterSheetMarkup {...props} />);
}
