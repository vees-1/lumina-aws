import { ClerkProvider } from "@clerk/nextjs";
import { NextIntlClientProvider } from "next-intl";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { getClerkLocalization } from "@/lib/clerk-localization";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const messages = (await import(`@/messages/${locale}.json`)).default;
  const t = (key: string) => messages.common[key];
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
  const messages = (await import(`@/messages/${locale}.json`)).default;
  const hpoLabels = (await import(`@/hpo-labels/${locale}.json`)).default;
  return (
    <ClerkProvider
      localization={getClerkLocalization(locale)}
      signInForceRedirectUrl={`/${locale}/dashboard`}
      signUpForceRedirectUrl={`/${locale}/dashboard`}
    >
      <NextIntlClientProvider locale={locale} messages={{ ...messages, hpoLabels }} now={new Date()} timeZone="UTC">
        {children}
      </NextIntlClientProvider>
    </ClerkProvider>
  );
}
