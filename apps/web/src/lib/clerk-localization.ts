import { enUS, frFR, deDE, esES, jaJP, zhCN } from "@clerk/localizations";

export function getClerkLocalization(locale: string) {
  switch (locale) {
    case "fr": return frFR;
    case "de": return deDE;
    case "es": return esES;
    case "ja": return jaJP;
    case "zh": return zhCN;
    default: return enUS;
  }
}