import { getRequestConfig } from 'next-intl/server';
import { routing } from './src/i18n/routing';
import { loadMessages } from './src/i18n/messages';
export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;
  if (!locale || !routing.locales.includes(locale as (typeof routing.locales)[number])) locale = routing.defaultLocale;
  return { locale, messages: await loadMessages(locale) };
});
