import Image from "next/image";
import Link from "next/link";
import { Nav } from "@/components/nav";
import { useTranslations } from "next-intl";

export function ProductPage({
  title,
  subtitle,
  image,
  imagePosition = "center 14%",
  cards,
}: {
  title: string;
  subtitle: string;
  image: string;
  imagePosition?: string;
  cards: Array<{ title: string; text: string }>;
}) {
  const t = useTranslations("landing");
  return (
    <div className="min-h-screen bg-white text-[#2f3037]">
      <Nav />
      <main className="mx-auto max-w-6xl px-6 pb-24 pt-24">
        <section className="grid min-h-[520px] items-center gap-12 lg:grid-cols-[0.85fr_1fr]">
          <div>
            <h1 className="text-[44px] font-normal leading-tight tracking-[-0.04em]">{title}</h1>
            <p className="mt-5 max-w-xl text-[18px] leading-8 text-[#555b6d]">{subtitle}</p>
            <Link href="/en/dashboard" className="mt-8 inline-flex rounded bg-[#38b6e8] px-6 py-3 text-[14px] font-normal text-white">
              {t("loginToContinue")}
            </Link>
            <div className="mt-8 grid max-w-xl grid-cols-3 gap-4">
              {[
                ["100%", t("reviewableEvidence")],
                ["FHIR", t("structuredExport")],
                ["HPO", t("acceptedTermsOnly")],
              ].map(([value, label]) => (
                <div key={value} className="border border-[#e5e8f0] p-5">
                  <p className="text-[28px] font-normal text-[#2536a0]">{value}</p>
                  <p className="text-[13px] text-[#62687a]">{label}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="relative min-h-[390px] overflow-hidden rounded shadow-[0_16px_40px_rgba(0,0,0,0.12)]">
            <Image
              src={image}
              alt=""
              fill
              sizes="(max-width: 1024px) 90vw, 640px"
              className="scale-[1.06] object-cover"
              style={{ objectPosition: imagePosition }}
              priority
            />
          </div>
        </section>

        <section className="grid gap-6 md:grid-cols-3">
          {cards.map((card) => (
            <article key={card.title} className="border border-[#e5e8f0] p-7">
              <h2 className="text-[24px] font-normal tracking-[-0.02em]">{card.title}</h2>
              <p className="mt-3 text-[15px] leading-7 text-[#62687a]">{card.text}</p>
              <Link href="/en/new-case" className="mt-5 inline-flex text-[16px] font-normal text-[#20aeea]">
                {t("viewWorkflow")}
              </Link>
            </article>
          ))}
        </section>
      </main>
    </div>
  );
}
