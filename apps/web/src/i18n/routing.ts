import { defineRouting } from 'next-intl/routing';
export const routing = defineRouting({
  locales: ['en', 'hi', 'de', 'fr', 'es', 'zh', 'ja'],
  defaultLocale: 'en'
});
