export type HpoLabelMessages = Record<string, unknown> & {
  hpoLabels?: Record<string, string>;
};

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

