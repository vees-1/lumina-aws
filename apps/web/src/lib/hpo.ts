import { useEffect, useState } from "react";

export type HpoLabelMessages = Record<string, unknown> & {
  hpoLabels?: Record<string, string>;
};

const EMPTY_HPO_LABELS: HpoLabelMessages = {};

/**
 * HPO labels are large (especially translated catalogues). Load them only for
 * clinical screens that render HPO terms, rather than serialising every label
 * into every statically exported page.
 */
export function useHpoLabels(locale: string): HpoLabelMessages {
  const [messages, setMessages] = useState<HpoLabelMessages>(EMPTY_HPO_LABELS);

  useEffect(() => {
    let active = true;
    import(`@/hpo-labels/${locale}.json`)
      .then((module) => {
        if (active) setMessages({ hpoLabels: module.default as Record<string, string> });
      })
      .catch(() => {
        // English source labels supplied by the API remain the safe fallback.
      });
    return () => {
      active = false;
    };
  }, [locale]);

  return messages;
}

export function localizeHpoLabel(
  hpoId: string,
  fallback: string | null | undefined,
  messages: HpoLabelMessages,
) {
  const translated = messages.hpoLabels?.[hpoId];
  if (translated?.trim()) return translated;
  if (fallback?.trim()) return fallback;
  return hpoId;
}
