"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useLocale, useTranslations } from "next-intl";
import { Copy, Download, Edit3, Check, ArrowLeft, Printer, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCaseById, streamLetter } from "@/lib/api";
import { CaseData } from "@/types/lumina";
import { DashboardNav } from "@/components/nav";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

function MarkdownRenderer({ content }: { content: string }) {
  return (
    <ReactMarkdown 
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children }) => <h1 className="text-[20px] font-normal text-center mb-8 uppercase tracking-wide border-b-2 border-black pb-2">{children}</h1>,
        h2: ({ children }) => <h2 className="text-[15px] font-normal mt-6 mb-2 text-foreground border-b border-black/10 pb-0.5 uppercase tracking-tight">{children}</h2>,
        h3: ({ children }) => <h3 className="text-[14px] font-normal mt-4 mb-1 text-foreground uppercase tracking-tight">{children}</h3>,
        p: ({ children }) => <p className="text-[14px] leading-relaxed text-foreground/90 mb-2">{children}</p>,
        ul: ({ children }) => <ul className="my-2 space-y-0.5">{children}</ul>,
        li: ({ children }) => <li className="ml-5 text-[14px] leading-snug text-foreground/90 list-disc mb-1">{children}</li>,
        strong: ({ children }) => <strong className="font-normal text-foreground">{children}</strong>,
        hr: () => <hr className="my-6 border-black/20" />,
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

export default function LetterPage({ params }: { params: Promise<{ id: string }> }) {
  const t = useTranslations("letter");
  const tc = useTranslations("case");
  const locale = useLocale();
  const { id } = use(params);
  const [caseData] = useState<CaseData | null>(() => getCaseById(id));
  const [letter, setLetter] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const hasStarted = useRef(false);

  useEffect(() => {
    if (!caseData || hasStarted.current) return;
    hasStarted.current = true;
    (async () => {
      setStreaming(true);
      try {
        for await (const chunk of streamLetter(caseData, locale)) {
          setLetter((prev) => prev + chunk);
        }
        setDone(true);
      } catch {
        setError(t("errorApi"));
      } finally {
        setStreaming(false);
      }
    })();
  }, [caseData, locale]);

  const handleCopy = () => {
    navigator.clipboard.writeText(letter);
  };

  const handleDownload = () => {
    const clean = letter
      .replace(/^#{1,3}\s+/gm, "")
      .replace(/\*\*/g, "")
      .replace(/^[-*]\s+/gm, "• ")
      .trim();
    const blob = new Blob([clean], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = t("filename", { id: id.slice(0, 8).toUpperCase() });
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    const win = window.open("", "_blank");
    if (!win) return;
    
    const htmlContent = letter
      .split("\n")
      .map(line => {
        if (/^#\s/.test(line)) return `<h1 style="font-size: 15pt; text-align: center; border-bottom: 2pt solid black; padding-bottom: 5pt; margin-bottom: 15pt; text-transform: uppercase; font-family: 'Times New Roman', serif;">${line.replace(/^#\s+/, "")}</h1>`;
        if (/^##\s/.test(line)) return `<h2 style="font-size: 11pt; font-weight: bold; border-bottom: 0.5pt solid #000; margin-top: 12pt; margin-bottom: 4pt; text-transform: uppercase;">${line.replace(/^##\s+/, "")}</h2>`;
        if (/^###\s/.test(line)) return `<h3 style="font-size: 10pt; font-weight: bold; margin-top: 8pt; margin-bottom: 3pt; text-transform: uppercase;">${line.replace(/^###\s+/, "")}</h3>`;
        if (/^[-*]\s/.test(line)) return `<li style="margin-left: 12pt; margin-bottom: 2pt; font-size: 10pt;">${line.replace(/^[-*]\s+/, "")}</li>`;
        if (line.trim() === "---") return `<hr style="border: 0; border-top: 0.5pt solid #000; margin: 10pt 0;">`;
        if (line.trim() === "") return `<div style="height: 3pt;"></div>`;
        const boldified = line.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
        return `<p style="margin-bottom: 5pt; font-size: 10pt; line-height: 1.2;">${boldified}</p>`;
      })
      .join("")
      .replace(/(<li.*?>.*?<\/li>)+/g, '<ul style="margin: 4pt 0; padding: 0;">$&</ul>');

    win.document.write(`
      <!DOCTYPE html>
      <html lang="${locale}">
      <head>
        <meta charset="utf-8">
        <title>${t("printTitle", { name: caseData?.patientContext?.patientName || id.slice(0, 8).toUpperCase() })}</title>
        <style>
          @page {
            size: A4;
            margin: 10mm 15mm;
          }
          * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          html, body {
            margin: 0;
            padding: 0;
            background: white !important;
            color: black !important;
          }
          body {
            font-family: "Times New Roman", Times, serif;
            line-height: 1.2;
          }
          .letter-wrapper {
            width: 100%;
            background: white !important;
          }
          .letter-header {
            display: flex;
            justify-content: space-between;
            margin-bottom: 15pt;
            font-size: 8.5pt;
          }
          .patient-box {
            border: 0.5pt solid #000;
            padding: 6pt 10pt;
            margin-bottom: 12pt;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 3pt;
            font-size: 8.5pt;
            background: white !important;
          }
          .letter-content { margin-bottom: 15pt; }
          [lang="hi"], [lang="ja"], [lang="zh"] { line-height: 1.4; }
          @media print {
            .no-print { display: none !important; }
            body, .letter-wrapper, .patient-box { background: white !important; background-color: white !important; border-color: black !important; color: black !important; }
          }
        </style>
      </head>
      <body>
        <div class="letter-wrapper">
          <div class="letter-header">
            <div>
              <strong>${caseData?.patientContext?.referringPhysicianName || t("practitioner")}</strong><br />
              ${caseData?.patientContext?.referringClinic || t("clinicalDept")}<br />
              ${new Date().toLocaleDateString(locale, { dateStyle: 'long' })}
            </div>
            <div style="text-align: right;">
              ${t("toLabel")} <strong>${caseData?.patientContext?.recipientSpecialist || t("consultant")}</strong><br />
              ${caseData?.patientContext?.recipientHospital || t("medicalCenter")}
            </div>
          </div>

          <div class="patient-box">
            <div><strong>${tc("patient")}:</strong> ${caseData?.patientContext?.patientName || t("anonymous")}</div>
            <div><strong>${tc("age")}:</strong> ${caseData?.patientContext?.age || tc("notApplicable")}</div>
            <div><strong>${tc("sex")}:</strong> ${caseData?.patientContext?.sex || tc("notApplicable")}</div>
            <div><strong>${t("ref")}:</strong> ${id.slice(0, 8).toUpperCase()}</div>
          </div>

          <div class="letter-content">
            ${htmlContent}
          </div>
        </div>
        <script>window.onload = () => { window.print(); };</script>
      </body>
      </html>
    `);
    win.document.close();
  };

  const topDx = caseData?.rankings?.[0]?.name ?? t("unknown");
  const wordCount = letter.split(/\s+/).filter(Boolean).length;

  return (
    <div className="min-h-screen bg-[#fafafa]">
      <DashboardNav />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 pt-24 pb-16">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link 
              href={`/${locale}/case/${id}`}
              className="w-9 h-9 rounded-full bg-white border border-black/5 flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-black/10 transition-all shadow-sm"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <h1 className="text-xl font-normal">{t("title")}</h1>
              <p className="text-[13px] text-muted-foreground mt-0.5">{topDx}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditing(!editing)}
              className={cn(
                "h-9 rounded-full px-4 text-[13px] font-normal transition-all",
                editing ? "bg-black text-white border-black hover:bg-black/90" : "bg-white"
              )}
            >
              {editing ? (
                <>
                  <Check className="w-3.5 h-3.5 mr-1.5" />
                  {t("doneEditing")}
                </>
              ) : (
                <>
                  <Edit3 className="w-3.5 h-3.5 mr-1.5" />
                  {t("edit")}
                </>
              )}
            </Button>

            <div className="h-4 w-px bg-black/10 mx-1" />

            <Button
              variant="outline"
              size="sm"
              onClick={handleCopy}
              className="h-9 w-9 rounded-full p-0 bg-white shadow-sm"
            >
              <Copy className="w-3.5 h-3.5" />
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              className="h-9 w-9 rounded-full p-0 bg-white shadow-sm"
            >
              <Printer className="w-3.5 h-3.5" />
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleDownload}
              className="h-9 w-9 rounded-full p-0 bg-white shadow-sm"
            >
              <Download className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-[24px] border border-black/[0.03] shadow-sm overflow-hidden"
        >
          {/* Status bar */}
          <div className="flex items-center gap-2 px-5 py-3 border-b border-black/[0.02] bg-black/[0.01]">
            <div className={cn(
              "w-1.5 h-1.5 rounded-full",
              streaming ? "bg-blue-500 animate-pulse" : done ? "bg-green-500" : "bg-gray-300"
            )} />
            <span className="text-[11px] font-normal text-muted-foreground uppercase tracking-wider">
              {streaming ? t("generating") : done ? t("complete") : t("waiting")}
            </span>
          </div>

          <div className="p-8 sm:p-12 min-h-[600px]">
            {error ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center text-red-500 mb-4">
                  <RefreshCw className="w-6 h-6" />
                </div>
                <p className="text-[14px] text-muted-foreground max-w-xs">{error}</p>
                <Button 
                  variant="link" 
                  onClick={() => window.location.reload()}
                  className="mt-2 text-blue-600"
                >
                  {t("tryAgain")}
                </Button>
              </div>
            ) : streaming && letter === "" ? (
              <div className="flex flex-col items-center justify-center py-32 space-y-4">
                <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
                <p className="text-[13px] text-muted-foreground font-normal">{t("generating")}</p>
              </div>
            ) : (
              <div className="max-w-none font-document">
                {editing ? (
                  <textarea
                    value={letter}
                    onChange={(e) => setLetter(e.target.value)}
                    className="w-full min-h-[600px] p-0 border-none outline-none text-[15px] leading-relaxed resize-none font-mono"
                    autoFocus
                  />
                ) : (
                  <MarkdownRenderer content={letter} />
                )}
              </div>
            )}
          </div>
        </motion.div>

        {done && !editing && (
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-[12px] text-muted-foreground mt-3 text-right"
          >
            {t("words", { count: wordCount })}
          </motion.p>
        )}
      </main>
    </div>
  );
}
