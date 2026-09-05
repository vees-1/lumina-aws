import { NextIntlClientProvider } from "next-intl";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { loadMessages } from "@/i18n/messages";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const messages = await loadMessages(locale);
  const common = messages.common as Record<string, string>;
  const t = (key: string) => common[key];
  return {
    title: t("metaTitle"),
    description: t("metaDesc"),
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) notFound();
  const messages = await loadMessages(locale);
  return (
    <NextIntlClientProvider locale={locale} messages={messages} now={new Date()} timeZone="UTC">
      {children}
    </NextIntlClientProvider>
  );
}
