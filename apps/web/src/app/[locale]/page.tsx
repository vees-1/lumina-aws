"use client";

import Image from "next/image";
import Link from "next/link";
import { Nav } from "@/components/nav";
import { EvidenceModuleCard, MarketingFooter, ServiceCard } from "@/components/lumina/practo-ui";
import { useTranslations } from "next-intl";
import { useParams } from "next/navigation";

export default function LandingPage() {
  const t = useTranslations("landing");
  const tc = useTranslations("common");
  const { locale } = useParams();
  const brandName = tc("brandName");

  const services = [
    {
      title: t("step1Title"),
      description: t("step1Desc"),
      image: "/docimages/Gemini_Generated_Image_4wscuc4wscuc4wsc.png",
      href: `/${locale}/new-case`,
      objectPosition: "center 20%",
    },
    {
      title: t("step2Title"),
      description: t("step2Desc"),
      image: "/docimages/Gemini_Generated_Image_f4e6hqf4e6hqf4e6.png",
      href: `/${locale}/clinical-reviewer`,
      objectPosition: "center 20%",
    },
    {
      title: t("step3Title"),
      description: t("step3Desc"),
      image: "/docimages/Gemini_Generated_Image_knf3dqknf3dqknf3.png",
      href: `/${locale}/rare-disease-scoring`,
      objectPosition: "center 18%",
    },
    {
      title: t("step4Title"),
      description: t("step4Desc"),
      image: "/docimages/Gemini_Generated_Image_q00gsdq00gsdq00g.png",
      href: `/${locale}/referral-letters`,
      objectPosition: "center 10%",
    },
  ];

  const evidence = [
    { kind: "notes" as const, title: t("modalityNoteTitle"), action: t("pipelineTerms") },
    { kind: "photos" as const, title: t("modalityPhotoTitle"), action: t("pipelineTerms") },
    { kind: "labs" as const, title: t("modalityLabTitle"), action: t("pipelineTerms") },
    { kind: "genetics" as const, title: t("modalityDnaTitle"), action: t("pipelineTerms") },
    { kind: "approval" as const, title: t("modalityChatTitle"), action: t("pipelineTerms") },
    { kind: "letter" as const, title: t("referralLetter.title"), action: t("pipelineTerms") },
  ];

  const workflowSteps = [
    { n: "01", title: t("step1Title"), body: t("step1Desc") },
    { n: "02", title: t("step2Title"), body: t("step2Desc") },
    { n: "03", title: t("step3Title"), body: t("step3Desc") },
    { n: "04", title: t("step4Title"), body: t("step4Desc") },
    { n: "05", title: t("referralLetter.title"), body: t("referralLetter.hero") },
  ];

  const trustPoints = [
    { label: tc("orphanet"), desc: t("orphanetDesc") },
    { label: tc("hpoOntology"), desc: t("hpoOntologyDesc") },
    { label: tc("clinvar"), desc: t("clinvarDesc") },
    { label: t("deterministicBadge"), desc: t("statsDesc", { brandName }) },
    { label: t("securityTitle"), desc: t("securityDesc") },
  ];

  return (
    <div className="min-h-screen bg-[#F7F8FA] text-[#0D1B2A]">
      <Nav />

      <main>
        {/* -- HERO ------------------------------------------------------- */}
        <section className="mx-auto max-w-[1200px] px-4 pb-10 pt-12 sm:px-6 sm:pb-14 sm:pt-16 lg:pt-24">
          <div className="grid items-center gap-8 lg:grid-cols-[1fr_1.1fr] lg:gap-10">

            {/* Text block */}
            <div className="text-center lg:text-left">
              <p className="section-label mb-3 justify-center lg:justify-start">
                {t("betaPill", { brandName })}
              </p>
              <h1 className="text-[36px] font-normal leading-[1.08] text-[#0D1B2A] sm:text-[46px] lg:text-[58px] whitespace-pre-line">
                {t("heroHeadline", { brandName })}
              </h1>
              <p className="mx-auto mt-4 max-w-[480px] text-[15px] leading-7 text-[#4A5568] lg:mx-0">
                {t("heroSub", { brandName })}
              </p>
              <div className="mt-7 flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start">
                <Link
                  href={`/${locale}/new-case`}
                  className="flex w-full items-center justify-center rounded-lg bg-[#0AAFCE] px-7 py-3.5 text-[15px] font-normal text-white transition-colors hover:bg-[#0997B3] sm:w-auto"
                >
                  {t("getStartedFree")}
                </Link>
                <Link
                  href={`/${locale}/how-it-works`}
                  className="flex w-full items-center justify-center rounded-lg border border-[#DDE3ED] bg-white px-7 py-3.5 text-[15px] font-normal text-[#0D1B2A] transition-colors hover:border-[#0D1B2A] sm:w-auto"
                >
                  {t("howItWorks")}
                </Link>
              </div>
            </div>

            {/* Hero image — explicit h-64 on mobile so it never collapses */}
            <div className="relative mx-auto h-64 w-full max-w-[500px] overflow-hidden rounded-xl shadow-[0_20px_60px_rgba(13,27,42,0.16)] sm:aspect-[1.5] sm:h-auto lg:max-w-none">
              <Image
                src="/docimages/Gemini_Generated_Image_qqlsmiqqlsmiqqls.png"
                alt={t("heroAlt")}
                fill
                sizes="(max-width: 640px) 90vw, (max-width: 1024px) 90vw, 580px"
                className="object-cover"
                style={{ objectPosition: "center 14%" }}
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0D1B2A]/60 via-transparent to-transparent" />
              {/* Badge — always visible, slightly smaller text on mobile */}
              <div className="absolute bottom-3 left-3 rounded-lg bg-white px-3 py-2.5 shadow-[0_8px_24px_rgba(13,27,42,0.18)] sm:bottom-6 sm:left-6 sm:px-4 sm:py-3">
                <p className="text-[12px] font-normal text-[#0D1B2A] sm:text-[13px]">{t("poweredBy")}</p>
                <p className="text-[11px] text-[#4A5568] sm:text-[12px]">{t("poweredByDesc")}</p>
              </div>
            </div>
          </div>
        </section>

        {/* -- SERVICE CARDS ------------------------------------------------ */}
        <section className="mx-auto max-w-[1200px] px-4 pb-14 sm:px-6">
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {services.map((service) => (
              <ServiceCard key={service.title} {...service} />
            ))}
          </div>
        </section>

        {/* -- EVIDENCE MODULE ROW ------------------------------------------- */}
        <section className="border-y border-[#DDE3ED] bg-white">
          <div className="mx-auto max-w-[1200px] px-4 py-10 sm:px-6 sm:py-14">

            {/* Header row */}
            <div className="mb-8 flex flex-col gap-4 sm:mb-10 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="section-label mb-2">{t("workflowLabel", { brandName })}</p>
                <h2 className="text-[20px] font-normal leading-snug tracking-[-0.01em] text-[#0D1B2A] sm:text-[24px] lg:text-[26px]">
                  {t("workflowHeadline", { brandName })}
                </h2>
                <p className="mt-1.5 text-[13px] text-[#4A5568] sm:text-[14px]">
                  {t("workflowSub", { brandName })}
                </p>
              </div>
              <Link
                href={`/${locale}/new-case`}
                className="shrink-0 self-start rounded-lg border border-[#0AAFCE] px-5 py-2.5 text-[13px] font-normal text-[#0AAFCE] transition-colors hover:bg-[#E5F8FC] sm:self-auto"
              >
                {t("newCase")}
              </Link>
            </div>

            <div className="grid grid-cols-3 justify-items-center gap-x-4 gap-y-7 sm:gap-x-6 sm:gap-y-10 lg:grid-cols-6">
              {evidence.map((item) => (
                <EvidenceModuleCard key={item.title} {...item} />
              ))}
            </div>
          </div>
        </section>

        {/* -- WORKFLOW ----------------------------------------------------- */}
        <section className="mx-auto max-w-[1200px] px-4 py-14 sm:px-6 sm:py-20">
          <div className="mb-10 text-center sm:mb-12">
            <p className="section-label mb-3">{t("technologyLabel")}</p>
            <h2 className="text-[26px] font-normal tracking-[-0.03em] text-[#0D1B2A] sm:text-[32px] lg:text-[38px]">
              {t("technologyHeadline")}
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-[14px] leading-7 text-[#4A5568] sm:text-[15px]">
              {t("technologySub", { brandName })}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-5">
            {workflowSteps.map((step) => (
              <div key={step.n} className="flex gap-4 rounded-xl border border-[#DDE3ED] bg-white p-5 sm:block sm:gap-0">
                <p className="shrink-0 text-[13px] font-normal tabular-nums text-[#0AAFCE] sm:shrink">{step.n}</p>
                <div>
                  <h3 className="text-[14px] font-normal leading-snug text-[#0D1B2A] sm:mt-3">{step.title}</h3>
                  <p className="mt-1.5 text-[12.5px] leading-5 text-[#4A5568] sm:mt-2">{step.body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* -- TRUST BAND --------------------------------------------------- */}
        <section className="bg-[#0D1B2A]">
          <div className="mx-auto max-w-[1200px] px-4 py-10 sm:px-6 sm:py-14">
            <p className="section-label mb-6 text-center" style={{ color: "#0AAFCE" }}>
              {t("scienceLabel")}
            </p>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              {trustPoints.map((point) => (
                <div key={point.label} className="rounded-xl border border-white/10 px-4 py-4 text-center">
                  <p className="text-[13px] font-normal text-white sm:text-[14px]">{point.label}</p>
                  <p className="mt-1 text-[11px] text-white/50 sm:text-[12px]">{point.desc}</p>
                </div>
              ))}
            </div>

            <div className="mt-8 grid grid-cols-1 gap-4 sm:mt-10 sm:gap-5 md:grid-cols-3">
              {[
                [t("nlpTitle"), t("nlpDesc")],
                [t("visionTitle"), t("visionDesc")],
                [t("graphTitle"), t("graphDesc")],
              ].map(([title, text]) => (
                <div key={title} className="rounded-xl border border-white/10 p-5 text-left sm:p-6">
                  <p className="text-[13px] leading-6 text-white/65">{text}</p>
                  <p className="mt-4 text-[13px] font-normal text-[#0AAFCE]">{title}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* -- FINAL CTA ---------------------------------------------------- */}
        <section className="mx-auto max-w-[1200px] px-4 py-14 sm:px-6 sm:py-20">
          <div className="overflow-hidden rounded-2xl shadow-[0_20px_60px_rgba(13,27,42,0.14)] lg:grid lg:grid-cols-[1.22fr_1fr]">

            {/* Left — doctor image */}
            <div className="relative h-56 w-full sm:h-72 lg:h-auto lg:min-h-[380px]">
              <Image
                src="/docimages/pleased-young-female-doctor-wearing-medical-robe-stethoscope-around-neck-standing-with-closed-posture_409827-254.jpg.avif"
                alt={t("ctaAlt")}
                fill
                sizes="(max-width: 1024px) 100vw, 650px"
                className="object-cover object-top"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0D1B2A]/50 via-transparent to-transparent lg:bg-gradient-to-r lg:from-transparent lg:to-[#0D1B2A]/10" />
            </div>

            {/* Right — text + buttons */}
            <div className="flex flex-col justify-center bg-[#0D1B2A] px-8 py-10 sm:px-10 sm:py-12 lg:px-12">
              <p className="mb-3 text-[11px] font-normal uppercase tracking-[0.14em] text-[#0AAFCE]">
                {t("ctaHeadline")}
              </p>
              <h2 className="text-[26px] font-normal leading-tight tracking-[-0.03em] text-white sm:text-[32px] lg:text-[36px]">
                {t("ctaSub", { brandName })}
              </h2>
              <p className="mt-4 max-w-sm text-[14px] leading-7 text-white/60 sm:text-[15px]">
                {t("heroSub", { brandName })}
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href={`/${locale}/new-case`}
                  className="flex items-center justify-center rounded-lg bg-[#0AAFCE] px-8 py-3.5 text-[15px] font-normal text-white transition-colors hover:bg-[#0997B3]"
                >
                  {t("newCase")}
                </Link>
                <Link
                  href={`/${locale}/about`}
                  className="flex items-center justify-center rounded-lg border border-white/20 px-8 py-3.5 text-[15px] font-normal text-white transition-colors hover:border-white/50"
                >
                  {t("about.title", { brandName })}
                </Link>
              </div>

              <p className="mt-6 text-[12px] text-white/35">
                {t("betaPill")}
              </p>
            </div>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}
